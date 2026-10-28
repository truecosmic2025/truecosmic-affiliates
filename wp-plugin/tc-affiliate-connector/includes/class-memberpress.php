<?php
if (!defined('ABSPATH')) exit;

/**
 * MemberPress support: memberships are sold through MemberPress's own checkout, not WooCommerce.
 *
 * - At signup (a browser request, so the referral cookie is present) the referral is remembered on the user.
 * - When a transaction completes (often later, from a Stripe/PayPal webhook with no cookies) it is reported
 *   to the app as an order with id "mepr-<transaction id>", so it can't collide with WooCommerce order numbers.
 * - Renewals of a subscription are flagged so the app can credit the affiliate who referred the first payment.
 * - Refunds reverse the commission.
 * - Memberships are synced as products (they're posts in the same site, so their IDs never clash with products).
 */
class TCAFF_MemberPress {
    const MAX_ATTEMPTS = 6;
    const META_REF = '_tc_aff_mepr_ref'; // user meta: array(ref, visit, time)

    public static function active() {
        return class_exists('MeprTransaction');
    }

    public static function init() {
        if (!self::active()) return;
        add_action('mepr-signup', array(__CLASS__, 'remember_referral'), 10, 1);
        add_action('mepr-txn-status-complete', array(__CLASS__, 'queue_paid'), 20, 1);
        add_action('mepr-txn-status-refunded', array(__CLASS__, 'queue_reversed'), 20, 1);
        add_action('tcaff_mepr_send_paid', array(__CLASS__, 'send_paid'), 10, 2);
        add_action('tcaff_mepr_send_reversed', array(__CLASS__, 'send_reversed'), 10, 2);
        add_action('save_post_memberpressproduct', array(__CLASS__, 'push_membership'), 20, 1);
    }

    /** Checkout submitted: remember who referred this user while the cookie is available. */
    public static function remember_referral($txn) {
        if (!is_object($txn) || empty($txn->user_id)) return;
        $cur = TCAFF_Tracking::current();
        if ($cur['ref'] === '') return;
        update_user_meta((int) $txn->user_id, self::META_REF, array('ref' => $cur['ref'], 'visit' => $cur['visit'], 'time' => time(), 'txn' => (int) $txn->id));
    }

    private static function sent_key($txn_id, $kind) {
        return "tcaff_mepr_{$kind}_" . (int) $txn_id;
    }

    public static function queue_paid($txn) {
        if (!is_object($txn) || empty($txn->id)) return;
        if (isset($txn->txn_type) && $txn->txn_type === 'subscription_confirmation') return; // free-trial placeholder, no money
        if (get_option(self::sent_key($txn->id, 'paid'))) return;
        // Capture the cookie now as a fallback if the signup hook didn't run (e.g. free memberships complete in-browser)
        if (!get_user_meta((int) $txn->user_id, self::META_REF, true)) self::remember_referral($txn);
        self::schedule('tcaff_mepr_send_paid', (int) $txn->id, 1);
    }

    public static function queue_reversed($txn) {
        if (!is_object($txn) || empty($txn->id) || !get_option(self::sent_key($txn->id, 'paid'))) return;
        self::schedule('tcaff_mepr_send_reversed', (int) $txn->id, 1);
    }

    private static function schedule($hook, $txn_id, $attempt, $delay = 0) {
        if (function_exists('as_schedule_single_action')) {
            as_schedule_single_action(time() + $delay, $hook, array($txn_id, $attempt), 'tc-affiliates');
        } else {
            wp_schedule_single_event(time() + $delay, $hook, array($txn_id, $attempt));
        }
    }

    private static function retry($hook, $txn_id, $attempt, $error) {
        TCAFF_Client::log("MemberPress txn #$txn_id $hook attempt $attempt failed: $error");
        if ($attempt < self::MAX_ATTEMPTS) self::schedule($hook, $txn_id, $attempt + 1, 60 * pow(3, $attempt));
    }

    /** First completed payment of the subscription this transaction belongs to (0 if none / not a subscription). */
    private static function first_payment_of_subscription($txn) {
        global $wpdb;
        if (empty($txn->subscription_id)) return 0;
        $table = $wpdb->prefix . 'mepr_transactions';
        return (int) $wpdb->get_var($wpdb->prepare(
            "SELECT id FROM {$table} WHERE subscription_id = %d AND status IN ('complete','refunded') AND txn_type = 'payment' AND total > 0 ORDER BY created_at ASC, id ASC LIMIT 1",
            (int) $txn->subscription_id
        ));
    }

    private static function prior_payments($txn) {
        global $wpdb;
        $table = $wpdb->prefix . 'mepr_transactions';
        return (int) $wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(*) FROM {$table} WHERE user_id = %d AND id <> %d AND status IN ('complete','refunded') AND total > 0 AND created_at <= %s",
            (int) $txn->user_id, (int) $txn->id, $txn->created_at
        ));
    }

    public static function payload($txn) {
        $user = get_userdata((int) $txn->user_id);
        $ref = get_user_meta((int) $txn->user_id, self::META_REF, true);
        // Same rule as the cookie: a referral only counts within the cookie length after the click
        if (is_array($ref) && (time() - (int) $ref['time']) > DAY_IN_SECONDS * TCAFF_Client::cookie_days()) $ref = null;
        $first = self::first_payment_of_subscription($txn);
        $is_renewal = $first && $first !== (int) $txn->id;
        $coupon = '';
        if (!empty($txn->coupon_id)) $coupon = get_the_title((int) $txn->coupon_id);
        $currency = class_exists('MeprOptions') ? MeprOptions::fetch()->currency_code : get_option('woocommerce_currency', 'GBP');
        $amount = (float) $txn->amount; // excluding tax
        $created = !empty($txn->created_at) ? gmdate('c', strtotime($txn->created_at . ' UTC')) : gmdate('c');
        return array(
            'id'              => 'mepr-' . (int) $txn->id,
            'number'          => !empty($txn->trans_num) ? $txn->trans_num : 'mepr-' . (int) $txn->id,
            'source'          => 'memberpress',
            'is_new_customer' => self::prior_payments($txn) === 0,
            'is_renewal'      => $is_renewal,
            'parent_order_id' => $is_renewal ? 'mepr-' . $first : 0,
            'shipping'        => 0,
            'tax'             => (float) $txn->tax_amount,
            'total'           => $amount,
            'currency'        => $currency,
            'gateway'         => isset($txn->gateway) ? (string) $txn->gateway : '',
            'date_paid'       => $created,
            'date_created'    => $created,
            'customer'        => array(
                'email' => $user ? $user->user_email : '',
                'name'  => $user ? trim($user->first_name . ' ' . $user->last_name) : '',
            ),
            'items'           => array(array(
                'product_id' => (int) $txn->product_id,
                'name'       => get_the_title((int) $txn->product_id),
                'quantity'   => 1,
                'total'      => $amount,
                'categories' => array('Memberships'),
            )),
            'coupons'         => $coupon ? array($coupon) : array(),
            'ref'             => is_array($ref) ? $ref['ref'] : '',
            'visit_id'        => is_array($ref) ? $ref['visit'] : '',
        );
    }

    public static function send_paid($txn_id, $attempt = 1) {
        if (get_option(self::sent_key($txn_id, 'paid'))) return;
        $txn = new MeprTransaction((int) $txn_id);
        if (empty($txn->id) || $txn->status !== 'complete') return;
        $res = TCAFF_Client::event('order.paid', self::payload($txn));
        if (is_wp_error($res)) return self::retry('tcaff_mepr_send_paid', $txn_id, $attempt, $res->get_error_message());
        update_option(self::sent_key($txn_id, 'paid'), gmdate('c'), false);
        if (!empty($res['referral_id'])) TCAFF_Client::log("MemberPress txn #$txn_id: commission {$res['amount']} recorded");
    }

    public static function send_reversed($txn_id, $attempt = 1) {
        $res = TCAFF_Client::event('order.reversed', array('id' => 'mepr-' . (int) $txn_id, 'reason' => 'refunded'));
        if (is_wp_error($res)) return self::retry('tcaff_mepr_send_reversed', $txn_id, $attempt, $res->get_error_message());
        TCAFF_Client::log("MemberPress txn #$txn_id refunded: commission reversed");
    }

    // ---------- Memberships as products ----------
    public static function membership_data($post_id) {
        $post = get_post($post_id);
        return array(
            'id'         => (int) $post_id,
            'name'       => $post ? $post->post_title : "Membership $post_id",
            'price'      => (float) get_post_meta($post_id, '_mepr_product_price', true),
            'permalink'  => get_permalink($post_id),
            'status'     => $post ? $post->post_status : 'publish',
            'type'       => 'membership',
            'categories' => array('Memberships'),
        );
    }

    public static function push_membership($post_id) {
        if (wp_is_post_revision($post_id) || in_array(get_post_status($post_id), array('auto-draft', 'trash', false), true)) return;
        $res = TCAFF_Client::event('product.upsert', self::membership_data($post_id), 5);
        if (is_wp_error($res)) TCAFF_Client::log("membership #$post_id sync failed: " . $res->get_error_message());
    }

    /** Called from the full product sync. Returns count or WP_Error. */
    public static function sync_all() {
        if (!self::active()) return 0;
        $ids = get_posts(array('post_type' => 'memberpressproduct', 'post_status' => array('publish', 'private', 'draft'), 'posts_per_page' => -1, 'fields' => 'ids', 'suppress_filters' => true));
        if (!$ids) return 0;
        foreach (array_chunk($ids, 50) as $chunk) {
            $res = TCAFF_Client::event('products.bulk', array_map(array(__CLASS__, 'membership_data'), $chunk), 30);
            if (is_wp_error($res)) return $res;
        }
        return count($ids);
    }
}

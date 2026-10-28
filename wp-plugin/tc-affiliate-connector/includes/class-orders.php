<?php
if (!defined('ABSPATH')) exit;

/**
 * Stamps the referral onto orders at checkout, then reports paid orders and refunds to the app.
 * Payment-gateway agnostic: Stripe, PayPal and any other WooCommerce gateway go through the same order statuses.
 */
class TCAFF_Orders {
    const MAX_ATTEMPTS = 6;

    public static function init() {
        // Classic checkout and block (Store API) checkout
        add_action('woocommerce_checkout_order_processed', array(__CLASS__, 'stamp_order_id'), 10, 1);
        add_action('woocommerce_store_api_checkout_update_order_from_request', array(__CLASS__, 'stamp_order'), 10, 1);

        add_action('woocommerce_order_status_processing', array(__CLASS__, 'queue_paid'));
        add_action('woocommerce_order_status_completed', array(__CLASS__, 'queue_paid'));
        foreach (array('refunded', 'cancelled', 'failed') as $status) {
            add_action('woocommerce_order_status_' . $status, array(__CLASS__, 'queue_reversed'));
        }
        add_action('tcaff_send_paid', array(__CLASS__, 'send_paid'), 10, 2);
        add_action('tcaff_send_reversed', array(__CLASS__, 'send_reversed'), 10, 2);
    }

    public static function stamp_order_id($order_id) {
        $order = wc_get_order($order_id);
        if ($order) self::stamp_order($order);
    }

    public static function stamp_order($order) {
        if (!$order || $order->get_meta('_tc_aff_ref')) return;
        $cur = TCAFF_Tracking::current();
        if ($cur['ref'] === '') return;
        $order->update_meta_data('_tc_aff_ref', $cur['ref']);
        $order->update_meta_data('_tc_aff_visit', $cur['visit']);
        $order->save();
    }

    public static function queue_paid($order_id) {
        $order = wc_get_order($order_id);
        if (!$order || $order->get_meta('_tc_aff_sent')) return;
        // Only orders with a referral cookie or a coupon can produce a commission
        if (!$order->get_meta('_tc_aff_ref') && !$order->get_coupon_codes()) return;
        self::schedule('tcaff_send_paid', $order_id, 1);
    }

    public static function queue_reversed($order_id) {
        $order = wc_get_order($order_id);
        if (!$order || !$order->get_meta('_tc_aff_sent')) return;
        self::schedule('tcaff_send_reversed', $order_id, 1);
    }

    private static function schedule($hook, $order_id, $attempt, $delay = 0) {
        if (function_exists('as_schedule_single_action')) {
            as_schedule_single_action(time() + $delay, $hook, array($order_id, $attempt), 'tc-affiliates');
        } else {
            wp_schedule_single_event(time() + $delay, $hook, array($order_id, $attempt));
        }
    }

    private static function retry($hook, $order_id, $attempt, $error) {
        TCAFF_Client::log("order #$order_id $hook attempt $attempt failed: $error");
        if ($attempt < self::MAX_ATTEMPTS) self::schedule($hook, $order_id, $attempt + 1, 60 * pow(3, $attempt));
    }

    public static function payload($order) {
        $items = array();
        foreach ($order->get_items() as $item) {
            /** @var WC_Order_Item_Product $item */
            $product_id = $item->get_product_id(); // parent id for variations so commission settings apply per product
            $cats = wp_get_post_terms($product_id, 'product_cat', array('fields' => 'names'));
            $items[] = array(
                'product_id' => $product_id,
                'name'       => $item->get_name(),
                'quantity'   => $item->get_quantity(),
                'total'      => (float) $item->get_total(), // after discounts, excluding tax
                'categories' => is_wp_error($cats) ? array() : $cats,
            );
        }
        return array(
            'id'       => $order->get_id(),
            'number'   => $order->get_order_number(),
            'status'   => $order->get_status(),
            'total'    => (float) $order->get_total() - (float) $order->get_total_tax(),
            'currency' => $order->get_currency(),
            'gateway'  => $order->get_payment_method(),
            'customer' => array(
                'email' => $order->get_billing_email(),
                'name'  => trim($order->get_billing_first_name() . ' ' . $order->get_billing_last_name()),
            ),
            'items'    => $items,
            'coupons'  => $order->get_coupon_codes(),
            'ref'      => $order->get_meta('_tc_aff_ref'),
            'visit_id' => $order->get_meta('_tc_aff_visit'),
        );
    }

    public static function send_paid($order_id, $attempt = 1) {
        $order = wc_get_order($order_id);
        if (!$order || $order->get_meta('_tc_aff_sent')) return;
        $res = TCAFF_Client::event('order.paid', self::payload($order));
        if (is_wp_error($res)) return self::retry('tcaff_send_paid', $order_id, $attempt, $res->get_error_message());

        $order->update_meta_data('_tc_aff_sent', gmdate('c'));
        if (!empty($res['referral_id'])) {
            $order->update_meta_data('_tc_aff_referral', $res['referral_id']);
            $order->add_order_note(sprintf('Affiliate commission of %s recorded for referral "%s".', wc_price($res['amount'], array('currency' => $order->get_currency())), $order->get_meta('_tc_aff_ref') ?: 'coupon'));
        }
        $order->save();
    }

    public static function send_reversed($order_id, $attempt = 1) {
        $order = wc_get_order($order_id);
        if (!$order) return;
        $res = TCAFF_Client::event('order.reversed', array('id' => $order_id, 'reason' => $order->get_status()));
        if (is_wp_error($res)) return self::retry('tcaff_send_reversed', $order_id, $attempt, $res->get_error_message());
        if (!empty($res['rejected'])) $order->add_order_note('Affiliate commission rejected because the order was ' . $order->get_status() . '.');
    }
}

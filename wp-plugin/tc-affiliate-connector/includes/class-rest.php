<?php
if (!defined('ABSPATH')) exit;

/** Signed endpoints the app calls: send mail, update FluentCRM contacts, trigger a product re-sync. */
class TCAFF_Rest {
    public static function init() {
        add_action('rest_api_init', array(__CLASS__, 'routes'));
    }

    public static function routes() {
        $ns = 'tc-affiliates/v1';
        $args = array('methods' => 'POST', 'permission_callback' => array(__CLASS__, 'check_signature'));
        register_rest_route($ns, '/mail', $args + array('callback' => array(__CLASS__, 'mail')));
        register_rest_route($ns, '/crm/contact', $args + array('callback' => array(__CLASS__, 'crm_contact')));
        register_rest_route($ns, '/sync-products', $args + array('callback' => array(__CLASS__, 'sync_products')));
    }

    public static function check_signature(WP_REST_Request $req) {
        return TCAFF_Client::verify($req->get_body(), $req->get_header('x-tc-signature'));
    }

    public static function mail(WP_REST_Request $req) {
        $p = $req->get_json_params();
        $to = sanitize_email(isset($p['to']) ? $p['to'] : '');
        if (!$to) return new WP_Error('bad_request', 'missing to', array('status' => 400));
        $html = wp_kses_post(isset($p['html']) ? $p['html'] : '');
        $sent = wp_mail($to, sanitize_text_field($p['subject']), $html, array('Content-Type: text/html; charset=UTF-8'));
        return array('ok' => (bool) $sent);
    }

    public static function sync_products() {
        $count = TCAFF_Products::sync_all();
        if (is_wp_error($count)) return $count;
        return array('ok' => true, 'count' => $count);
    }

    public static function crm_contact(WP_REST_Request $req) {
        if (!function_exists('FluentCrmApi')) {
            return new WP_Error('fluentcrm_missing', 'FluentCRM is not active', array('status' => 424));
        }
        $p = $req->get_json_params();
        $email = sanitize_email(isset($p['email']) ? $p['email'] : '');
        if (!$email) return new WP_Error('bad_request', 'missing email', array('status' => 400));

        $api = FluentCrmApi('contacts');
        $existing = $api->getContact($email);
        $data = array('email' => $email);
        foreach (array('first_name', 'last_name') as $k) {
            // Never overwrite a name already in the CRM with a blank
            if (!empty($p[$k])) $data[$k] = sanitize_text_field($p[$k]);
        }
        if (!$existing) $data['status'] = 'subscribed';
        if (!empty($p['custom_values']) && is_array($p['custom_values'])) {
            $data['custom_values'] = array_map('sanitize_text_field', $p['custom_values']);
        }
        $contact = $api->createOrUpdate($data);
        if (!$contact) return new WP_Error('fluentcrm_failed', 'Could not save contact', array('status' => 500));

        $add = self::tag_ids(isset($p['add_tags']) ? (array) $p['add_tags'] : array(), true);
        $remove = self::tag_ids(isset($p['remove_tags']) ? (array) $p['remove_tags'] : array(), false);
        if ($remove) $contact->detachTags($remove);
        if ($add) $contact->attachTags($add); // attaching fires FluentCRM "tag applied" automations
        $lists = self::list_ids(isset($p['lists']) ? (array) $p['lists'] : array());
        if ($lists) $contact->attachLists($lists);

        return array('ok' => true, 'contact_id' => $contact->id, 'created' => !$existing);
    }

    private static function tag_ids($titles, $create) {
        $ids = array();
        foreach ($titles as $title) {
            $title = sanitize_text_field($title);
            if ($title === '') continue;
            $tag = \FluentCrm\App\Models\Tag::where('title', $title)->first();
            if (!$tag && $create) $tag = \FluentCrm\App\Models\Tag::create(array('title' => $title, 'slug' => sanitize_title($title)));
            if ($tag) $ids[] = $tag->id;
        }
        return $ids;
    }

    private static function list_ids($titles) {
        $ids = array();
        foreach ($titles as $title) {
            $title = sanitize_text_field($title);
            if ($title === '') continue;
            $list = \FluentCrm\App\Models\Lists::where('title', $title)->first();
            if (!$list) $list = \FluentCrm\App\Models\Lists::create(array('title' => $title, 'slug' => sanitize_title($title)));
            $ids[] = $list->id;
        }
        return $ids;
    }

    /** Adds the affiliate custom fields to FluentCRM so the app's values are stored and usable in emails. */
    public static function ensure_crm_fields() {
        if (!function_exists('fluentcrm_get_option')) return false;
        $fields = fluentcrm_get_option('contact_custom_fields', array());
        $have = wp_list_pluck($fields, 'slug');
        $wanted = array(
            'affiliate_code'      => 'Affiliate Code',
            'affiliate_status'    => 'Affiliate Status',
            'affiliate_link'      => 'Affiliate Link',
            'affiliate_earnings'  => 'Affiliate Total Earnings',
            'affiliate_unpaid'    => 'Affiliate Unpaid Earnings',
            'affiliate_referrals' => 'Affiliate Referral Count',
            'referred_by'         => 'Referred By (Affiliate)',
        );
        $added = 0;
        foreach ($wanted as $slug => $label) {
            if (in_array($slug, $have, true)) continue;
            $fields[] = array('field_key' => 'text', 'type' => 'text', 'label' => $label, 'slug' => $slug, 'group' => 'Affiliates');
            $added++;
        }
        if ($added) fluentcrm_update_option('contact_custom_fields', $fields);
        return $added;
    }
}

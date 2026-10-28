<?php
if (!defined('ABSPATH')) exit;

/**
 * Referral tracking. The visit is recorded through admin-ajax so it works on fully cached pages,
 * and cookies are set by the server (HTTP Set-Cookie) so Safari doesn't cut them to 7 days.
 */
class TCAFF_Tracking {
    const COOKIE_REF = 'tc_aff_ref';
    const COOKIE_VISIT = 'tc_aff_visit';
    const COOKIE_MARK = 'tc_aff_has'; // readable by JS so it can skip direct/landing checks

    public static function init() {
        add_action('init', array(__CLASS__, 'add_endpoint'));
        add_action('wp_enqueue_scripts', array(__CLASS__, 'enqueue'));
        add_action('wp_ajax_tcaff_track', array(__CLASS__, 'ajax_track'));
        add_action('wp_ajax_nopriv_tcaff_track', array(__CLASS__, 'ajax_track'));
        add_action('tcaff_refresh_config', array('TCAFF_Client', 'refresh_config'));
        if (!wp_next_scheduled('tcaff_refresh_config')) wp_schedule_event(time() + 300, 'hourly', 'tcaff_refresh_config');
    }

    /** Supports AffiliateWP-style pretty links such as /academy/ref/jane/ */
    public static function add_endpoint() {
        add_rewrite_endpoint(TCAFF_Client::referral_var(), EP_ALL);
    }

    public static function enqueue() {
        wp_enqueue_script('tcaff-track', plugins_url('assets/track.js', TCAFF_FILE), array(), TCAFF_VERSION, true);
        wp_localize_script('tcaff-track', 'TCAFF', array(
            'ajax'    => admin_url('admin-ajax.php'),
            'var'     => TCAFF_Client::referral_var(),
            'landing' => array_values((array) TCAFF_Client::config('landing_paths', array())),
            'direct'  => array_values((array) TCAFF_Client::config('direct_domains', array())),
        ));
    }

    public static function ajax_track() {
        $ref = isset($_POST['ref']) ? sanitize_text_field(wp_unslash($_POST['ref'])) : '';
        $mode = isset($_POST['mode']) ? sanitize_key($_POST['mode']) : 'ref';
        if (!in_array($mode, array('ref', 'landing', 'direct'), true)) $mode = 'ref';
        if (($mode === 'ref' && $ref === '') || strlen($ref) > 64) wp_send_json(array('ok' => false));
        $cur = self::current();

        $visit_id = isset($_POST['visit']) ? sanitize_text_field(wp_unslash($_POST['visit'])) : '';
        $code = $ref;
        $days = TCAFF_Client::cookie_days();

        if ($visit_id === '') {
            $res = TCAFF_Client::post('/api/wp/track', array(
                'ref'      => $ref,
                'url'      => isset($_POST['url']) ? esc_url_raw(wp_unslash($_POST['url'])) : '',
                'referrer' => isset($_POST['referrer']) ? esc_url_raw(wp_unslash($_POST['referrer'])) : '',
                'campaign' => isset($_POST['campaign']) ? sanitize_text_field(wp_unslash($_POST['campaign'])) : '',
                'ip'       => self::client_ip(),
                'mode'     => $mode,
                'ppc'      => !empty($_POST['ppc']),
                'current_ref' => $cur['ref'],
            ), 4);
            if (is_wp_error($res) || empty($res['ok'])) wp_send_json(array('ok' => false));
            if (!empty($res['keep'])) wp_send_json(array('ok' => true, 'kept' => true)); // first-referrer mode
            $visit_id = $res['visit_id'];
            $code = $res['code'];
            $days = isset($res['cookie_days']) ? (int) $res['cookie_days'] : $days;
        }

        $expires = time() + DAY_IN_SECONDS * $days;
        $opts = array('expires' => $expires, 'path' => COOKIEPATH ? COOKIEPATH : '/', 'domain' => COOKIE_DOMAIN, 'secure' => is_ssl(), 'httponly' => true, 'samesite' => 'Lax');
        setcookie(self::COOKIE_REF, $code, $opts);
        setcookie(self::COOKIE_VISIT, $visit_id, $opts);
        setcookie(self::COOKIE_MARK, '1', array_merge($opts, array('httponly' => false)));
        nocache_headers();
        wp_send_json(array('ok' => true));
    }

    public static function client_ip() {
        foreach (array('HTTP_CF_CONNECTING_IP', 'HTTP_X_FORWARDED_FOR', 'REMOTE_ADDR') as $k) {
            if (!empty($_SERVER[$k])) {
                $ip = trim(explode(',', sanitize_text_field(wp_unslash($_SERVER[$k])))[0]);
                if (filter_var($ip, FILTER_VALIDATE_IP)) return $ip;
            }
        }
        return '';
    }

    /** Current referral from cookies, used at checkout. */
    public static function current() {
        return array(
            'ref'   => isset($_COOKIE[self::COOKIE_REF]) ? sanitize_text_field(wp_unslash($_COOKIE[self::COOKIE_REF])) : '',
            'visit' => isset($_COOKIE[self::COOKIE_VISIT]) ? sanitize_text_field(wp_unslash($_COOKIE[self::COOKIE_VISIT])) : '',
        );
    }
}

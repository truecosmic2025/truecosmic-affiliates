<?php
if (!defined('ABSPATH')) exit;

/** Signed HTTP client for talking to the affiliates app. */
class TCAFF_Client {
    public static function app_url() {
        return rtrim((string) get_option('tcaff_app_url', ''), '/');
    }

    public static function secret() {
        return defined('TCAFF_SHARED_SECRET') ? TCAFF_SHARED_SECRET : (string) get_option('tcaff_secret', '');
    }

    public static function sign($body) {
        return hash_hmac('sha256', $body, self::secret());
    }

    public static function verify($body, $signature) {
        $secret = self::secret();
        return $secret !== '' && is_string($signature) && hash_equals(self::sign($body), $signature);
    }

    /** POST to the app. Returns decoded array or WP_Error. */
    public static function post($path, $data, $timeout = 10) {
        if (!self::app_url() || !self::secret()) {
            return new WP_Error('tcaff_not_configured', 'Affiliate app URL or secret not set');
        }
        $body = wp_json_encode($data);
        $res = wp_remote_post(self::app_url() . $path, array(
            'timeout' => $timeout,
            'headers' => array('Content-Type' => 'application/json', 'X-TC-Signature' => self::sign($body)),
            'body'    => $body,
        ));
        if (is_wp_error($res)) return $res;
        $code = wp_remote_retrieve_response_code($res);
        $json = json_decode(wp_remote_retrieve_body($res), true);
        if ($code >= 300) {
            return new WP_Error('tcaff_http_' . $code, isset($json['error']) ? $json['error'] : 'HTTP ' . $code);
        }
        return is_array($json) ? $json : array();
    }

    public static function event($event, $data, $timeout = 10) {
        return self::post('/api/wp/webhook', array('event' => $event, 'data' => $data), $timeout);
    }

    public static function referral_var() {
        $v = get_option('tcaff_referral_var', 'ref');
        return $v ? $v : 'ref';
    }

    public static function cookie_days() {
        return max(1, (int) get_option('tcaff_cookie_days', 30));
    }

    public static function log($message) {
        $log = get_option('tcaff_log', array());
        array_unshift($log, gmdate('Y-m-d H:i:s') . '  ' . $message);
        update_option('tcaff_log', array_slice($log, 0, 50), false);
    }
}

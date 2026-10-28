<?php
if (!defined('ABSPATH')) exit;

class TCAFF_Admin {
    public static function init() {
        add_action('admin_menu', function () {
            add_options_page('TrueCosmic Affiliates', 'TrueCosmic Affiliates', 'manage_options', 'tc-affiliates', array(__CLASS__, 'page'));
        });
        add_action('admin_post_tcaff_save', array(__CLASS__, 'save'));
        add_action('admin_post_tcaff_action', array(__CLASS__, 'action'));
        add_filter('plugin_action_links_' . plugin_basename(TCAFF_FILE), function ($links) {
            array_unshift($links, '<a href="' . admin_url('options-general.php?page=tc-affiliates') . '">Settings</a>');
            return $links;
        });
    }

    private static function back($msg) {
        wp_safe_redirect(add_query_arg('tcaff_msg', rawurlencode($msg), admin_url('options-general.php?page=tc-affiliates')));
        exit;
    }

    public static function save() {
        if (!current_user_can('manage_options')) wp_die('Not allowed');
        check_admin_referer('tcaff_save');
        update_option('tcaff_app_url', esc_url_raw(wp_unslash($_POST['app_url'])));
        if (!defined('TCAFF_ROLE') && isset($_POST['role']) && in_array($_POST['role'], array('shop', 'crm'), true)) {
            update_option('tcaff_role', $_POST['role']);
            if ($_POST['role'] === 'crm') wp_clear_scheduled_hook('tcaff_daily_product_sync');
        }
        if (!defined('TCAFF_SHARED_SECRET') && !empty($_POST['secret'])) {
            update_option('tcaff_secret', sanitize_text_field(wp_unslash($_POST['secret'])), false);
        }
        self::ping();
        self::back('Settings saved.');
    }

    /** Pulls referral variable and cookie length from the app so both sides agree. */
    public static function ping() {
        return TCAFF_Client::refresh_config();
    }

    public static function action() {
        if (!current_user_can('manage_options')) wp_die('Not allowed');
        check_admin_referer('tcaff_action');
        $do = sanitize_key($_POST['do']);
        if ($do === 'test') {
            $res = self::ping();
            self::back(is_wp_error($res) ? 'Connection failed: ' . $res->get_error_message() : 'Connected! Referral variable "' . $res['referral_var'] . '", ' . $res['cookie_days'] . '-day cookie.');
        }
        if ($do === 'sync') {
            $res = TCAFF_Products::sync_all();
            self::back(is_wp_error($res) ? 'Sync failed: ' . $res->get_error_message() : "Sent $res products to the affiliate app.");
        }
        if ($do === 'crm_fields') {
            $res = TCAFF_Rest::ensure_crm_fields();
            self::back($res === false ? 'FluentCRM is not active.' : "Added $res FluentCRM custom fields.");
        }
        self::back('Unknown action');
    }

    public static function page() {
        $msg = isset($_GET['tcaff_msg']) ? sanitize_text_field(wp_unslash($_GET['tcaff_msg'])) : '';
        $log = get_option('tcaff_log', array());
        ?>
        <div class="wrap">
            <h1>TrueCosmic Affiliates</h1>
            <?php if ($msg) : ?><div class="notice notice-info"><p><?php echo esc_html($msg); ?></p></div><?php endif; ?>
            <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>">
                <?php wp_nonce_field('tcaff_save'); ?>
                <input type="hidden" name="action" value="tcaff_save">
                <table class="form-table">
                    <tr><th><label for="app_url">Affiliate app URL</label></th>
                        <td><input id="app_url" name="app_url" type="url" class="regular-text" value="<?php echo esc_attr(get_option('tcaff_app_url')); ?>" placeholder="https://affiliates.truecosmic.com"></td></tr>
                    <tr><th><label for="secret">Shared secret</label></th>
                        <td><?php if (defined('TCAFF_SHARED_SECRET')) : ?>Set in wp-config.php<?php else : ?>
                            <input id="secret" name="secret" type="password" class="regular-text" placeholder="<?php echo get_option('tcaff_secret') ? '•••••••• (saved, leave blank to keep)' : ''; ?>">
                            <p class="description">Must match WP_SHARED_SECRET in the app. You can also define TCAFF_SHARED_SECRET in wp-config.php.</p><?php endif; ?></td></tr>
                    <tr><th>Site role</th>
                        <td><?php if (defined('TCAFF_ROLE')) : ?>Set in wp-config.php: <strong><?php echo esc_html(TCAFF_Client::role()); ?></strong><?php else : $role = TCAFF_Client::role(); ?>
                            <label style="display:block;margin-bottom:6px"><input type="radio" name="role" value="shop" <?php checked($role, 'shop'); ?> <?php disabled(!class_exists('WooCommerce')); ?>> <strong>Shop</strong>: track referral links, report orders and sync products (the site that sells the affiliate products)</label>
                            <label style="display:block"><input type="radio" name="role" value="crm" <?php checked($role, 'crm'); ?>> <strong>CRM only</strong>: just receive affiliate contacts and tags into FluentCRM (no tracking, orders or products)</label>
                            <?php endif; ?></td></tr>
                    <tr><th>Tracking</th><td>Referral variable <code><?php echo esc_html(TCAFF_Client::referral_var()); ?></code>, cookie <?php echo (int) TCAFF_Client::cookie_days(); ?> days (managed in the app)</td></tr>
                </table>
                <?php submit_button('Save & connect'); ?>
            </form>
            <h2>Tools</h2>
            <?php
            $tools = array('test' => 'Test connection');
            if (TCAFF_Client::is_shop()) $tools['sync'] = 'Sync all products now';
            if (function_exists('FluentCrmApi')) $tools['crm_fields'] = 'Create FluentCRM affiliate fields';
            ?>
            <p class="description">This site: role <strong><?php echo TCAFF_Client::is_shop() ? 'Shop' : 'CRM only'; ?></strong> · WooCommerce <?php echo class_exists('WooCommerce') ? 'active' : 'not active'; ?> · FluentCRM <?php echo function_exists('FluentCrmApi') ? 'active (receives affiliate contacts and tags)' : 'not active'; ?></p>
            <?php foreach ($tools as $key => $label) : ?>
                <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>" style="display:inline-block;margin-right:8px">
                    <?php wp_nonce_field('tcaff_action'); ?>
                    <input type="hidden" name="action" value="tcaff_action"><input type="hidden" name="do" value="<?php echo esc_attr($key); ?>">
                    <?php submit_button($label, 'secondary', 'submit', false); ?>
                </form>
            <?php endforeach; ?>
            <?php if (class_exists('Affiliate_WP')) : ?>
                <div class="notice notice-warning inline" style="margin-top:20px"><p>AffiliateWP is still active. Once you've imported your affiliates into the new app and checked a test order, deactivate AffiliateWP so commissions aren't recorded twice.</p></div>
            <?php endif; ?>
            <h2>Recent connector log</h2>
            <pre style="background:#fff;padding:12px;max-height:300px;overflow:auto"><?php echo esc_html($log ? implode("\n", $log) : 'Nothing yet'); ?></pre>
        </div>
        <?php
    }
}

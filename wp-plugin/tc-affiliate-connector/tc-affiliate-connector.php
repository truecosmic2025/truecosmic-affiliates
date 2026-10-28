<?php
/**
 * Plugin Name: TrueCosmic Affiliate Connector
 * Description: Connects WooCommerce and FluentCRM to the TrueCosmic Affiliates app: tracks referral links, reports orders and refunds, keeps products in sync, and lets the app update FluentCRM contacts.
 * Version: 1.0.0
 * Author: TrueCosmic
 * Requires PHP: 7.4
 * WC requires at least: 6.0
 */

if (!defined('ABSPATH')) exit;

define('TCAFF_VERSION', '1.0.0');
define('TCAFF_FILE', __FILE__);

require_once __DIR__ . '/includes/class-client.php';
require_once __DIR__ . '/includes/class-tracking.php';
require_once __DIR__ . '/includes/class-orders.php';
require_once __DIR__ . '/includes/class-products.php';
require_once __DIR__ . '/includes/class-rest.php';
require_once __DIR__ . '/includes/class-admin.php';

add_action('before_woocommerce_init', function () {
    if (class_exists('\Automattic\WooCommerce\Utilities\FeaturesUtil')) {
        \Automattic\WooCommerce\Utilities\FeaturesUtil::declare_compatibility('custom_order_tables', __FILE__, true);
        \Automattic\WooCommerce\Utilities\FeaturesUtil::declare_compatibility('cart_checkout_blocks', __FILE__, true);
    }
});

add_action('plugins_loaded', function () {
    TCAFF_Tracking::init();
    TCAFF_Orders::init();
    TCAFF_Products::init();
    TCAFF_Rest::init();
    TCAFF_Admin::init();
});

register_activation_hook(__FILE__, function () {
    TCAFF_Tracking::add_endpoint();
    flush_rewrite_rules();
});
register_deactivation_hook(__FILE__, 'flush_rewrite_rules');

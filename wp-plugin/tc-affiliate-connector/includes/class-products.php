<?php
if (!defined('ABSPATH')) exit;

/** Pushes WooCommerce products to the app so new courses, ebooks and coaching are promotable immediately. */
class TCAFF_Products {
    private static $sent = array();

    public static function init() {
        add_action('woocommerce_new_product', array(__CLASS__, 'push'), 20);
        add_action('woocommerce_update_product', array(__CLASS__, 'push'), 20);
        add_action('wp_trash_post', array(__CLASS__, 'deleted'));
        add_action('before_delete_post', array(__CLASS__, 'deleted'));
        add_action('untrashed_post', array(__CLASS__, 'push'));
        add_action('tcaff_daily_product_sync', array(__CLASS__, 'sync_all'));
        if (!wp_next_scheduled('tcaff_daily_product_sync')) {
            wp_schedule_event(time() + HOUR_IN_SECONDS, 'daily', 'tcaff_daily_product_sync');
        }
    }

    public static function data($product) {
        $cats = wp_get_post_terms($product->get_id(), 'product_cat', array('fields' => 'names'));
        return array(
            'id'         => $product->get_id(),
            'name'       => $product->get_name(),
            'price'      => (float) $product->get_price(),
            'permalink'  => get_permalink($product->get_id()),
            'status'     => $product->get_status(),
            'type'       => $product->get_type(),
            'categories' => is_wp_error($cats) ? array() : $cats,
        );
    }

    public static function push($product_id) {
        if (isset(self::$sent[$product_id]) || get_post_type($product_id) !== 'product') return;
        self::$sent[$product_id] = true;
        $product = wc_get_product($product_id);
        if (!$product || in_array($product->get_status(), array('auto-draft', 'trash'), true)) return;
        $res = TCAFF_Client::event('product.upsert', self::data($product), 5);
        if (is_wp_error($res)) TCAFF_Client::log("product #$product_id sync failed: " . $res->get_error_message());
    }

    public static function deleted($post_id) {
        if (get_post_type($post_id) !== 'product') return;
        TCAFF_Client::event('product.deleted', array('id' => $post_id), 5);
    }

    /** Sends every product in batches. Returns count sent or WP_Error. */
    public static function sync_all() {
        $page = 1;
        $count = 0;
        do {
            $products = wc_get_products(array('status' => array('publish', 'private', 'draft'), 'limit' => 50, 'page' => $page, 'type' => array_keys(wc_get_product_types())));
            if (!$products) break;
            $res = TCAFF_Client::event('products.bulk', array_map(array(__CLASS__, 'data'), $products), 30);
            if (is_wp_error($res)) {
                TCAFF_Client::log('bulk product sync failed: ' . $res->get_error_message());
                return $res;
            }
            $count += count($products);
            $page++;
        } while (count($products) === 50);
        TCAFF_Client::log("synced $count products");
        return $count;
    }
}

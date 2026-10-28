<?php
if (!defined('ABSPATH')) exit;

/** Pushes WooCommerce products to the app so new courses, ebooks and coaching are promotable immediately. */
class TCAFF_Products {
    private static $sent = array();

    public static function init() {
        // On a site without WooCommerce (e.g. the one that only runs FluentCRM) there are no products to sync
        if (!class_exists('WooCommerce')) {
            wp_clear_scheduled_hook('tcaff_daily_product_sync');
            return;
        }
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

    /**
     * Product data for the app. Works for every product post, including types whose plugin isn't active
     * (e.g. event tickets, subscriptions), where wc_get_product() returns false; those are read from the post.
     */
    public static function data($product_id) {
        $product_id = is_object($product_id) ? $product_id->get_id() : (int) $product_id;
        $cats = wp_get_post_terms($product_id, 'product_cat', array('fields' => 'names'));
        $product = wc_get_product($product_id);
        if ($product) {
            $name = $product->get_name();
            $price = (float) $product->get_price();
            $status = $product->get_status();
            $type = $product->get_type();
        } else {
            $post = get_post($product_id);
            $types = wp_get_post_terms($product_id, 'product_type', array('fields' => 'slugs'));
            $name = $post ? $post->post_title : "Product $product_id";
            $price = (float) get_post_meta($product_id, '_price', true);
            $status = $post ? $post->post_status : 'publish';
            $type = !is_wp_error($types) && $types ? $types[0] : 'unknown';
        }
        return array(
            'id'         => $product_id,
            'name'       => $name,
            'price'      => $price,
            'permalink'  => get_permalink($product_id),
            'status'     => $status,
            'type'       => $type,
            'categories' => is_wp_error($cats) ? array() : $cats,
        );
    }

    public static function push($product_id) {
        if (isset(self::$sent[$product_id]) || get_post_type($product_id) !== 'product') return;
        self::$sent[$product_id] = true;
        if (in_array(get_post_status($product_id), array('auto-draft', 'trash', false), true)) return;
        $res = TCAFF_Client::event('product.upsert', self::data($product_id), 5);
        if (is_wp_error($res)) TCAFF_Client::log("product #$product_id sync failed: " . $res->get_error_message());
    }

    public static function deleted($post_id) {
        if (get_post_type($post_id) !== 'product') return;
        TCAFF_Client::event('product.deleted', array('id' => $post_id), 5);
    }

    /** Sends every product in batches. Returns count sent or WP_Error. */
    public static function sync_all() {
        if (!TCAFF_Client::is_shop()) return new WP_Error('not_shop', 'This site\'s connector role is CRM only, so it has no products to sync');
        $page = 1;
        $count = 0;
        do {
            // Query the post type directly so product types from inactive plugins aren't skipped
            $products = get_posts(array('post_type' => 'product', 'post_status' => array('publish', 'private', 'draft'), 'posts_per_page' => 50, 'paged' => $page, 'fields' => 'ids', 'orderby' => 'ID', 'order' => 'ASC', 'suppress_filters' => true));
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

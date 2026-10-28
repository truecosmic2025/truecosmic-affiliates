# TrueCosmic Affiliates

A standalone replacement for AffiliateWP built for the TrueCosmic Academy (courses, ebooks and coaching sold through
WooCommerce with Stripe and PayPal), with FluentCRM sync.

```
WordPress (truecosmic.com)                         Affiliates app (Railway)
├─ WooCommerce + Stripe/PayPal                     ├─ Admin: affiliates, referrals, visits, payouts,
├─ FluentCRM                                       │         products, creatives, import, settings, log
└─ TrueCosmic Affiliate Connector plugin  <──────> └─ Affiliate hub: stats, product links, referrals,
     tracks ?ref= links, reports orders,              payouts, creatives, account
     refunds and products, updates FluentCRM      Postgres
```

All traffic between the two is signed with HMAC-SHA256 using `WP_SHARED_SECRET`.

## What it does

See **FEATURES.md** for the full AffiliateWP feature comparison. Highlights:

| AffiliateWP feature | Here |
| --- | --- |
| Referral links `?ref=code`, pretty `/ref/code/` | Yes. Old links that use the AffiliateWP numeric ID or username keep working |
| Cookie tracking | Server-set cookie (survives Safari's 7-day limit), works on cached pages |
| Visits and conversion rate | Yes, with repeat-click de-duplication |
| Commission rates | Global default → per-affiliate → per-product (percentage or flat) |
| Coupon tracking | Assign WooCommerce coupon codes to an affiliate |
| Refunds / cancellations | Commission rejected automatically (flagged if already paid) |
| Self-referral blocking, pending approval, auto-approve | Settings |
| Payouts | Pay run + PayPal Payouts bulk CSV, payout history |
| Creatives | Images and copy with each affiliate's link baked in |
| Affiliate area | Passwordless email login, dashboard, link builder for every product |
| New products | Pushed from WooCommerce the moment they're created; daily safety sync |
| Emails | Sent through WordPress `wp_mail` (your existing SMTP) |
| CRM | FluentCRM contacts, tags, list and custom fields; referred customers tagged |

## Programme rules

Defaults: 35% commission, minimum payout $50, 30-day clearing (refund window), one pay run a month (day 1).
Everything is in USD; GBP sales are converted at the ECB rate for the sale date and the rate is locked on the
commission. Disputes go to accounts@truecosmic.com (Franklin, an AI accounts agent with a scoped API key).
Promotions (e.g. coaching at 10%) are on the Commission rules page.

## Plugins this replaces

AffiliateWP plus its Pro add-ons: Lifetime Commissions, Recurring Referrals, Tiered Rates, Multi-Tier Commissions,
Direct Link Tracking, Affiliate Landing Pages, Custom Affiliate Slugs, Affiliate Product Rates, Show Affiliate Coupons,
Order Details for Affiliates, Leaderboard, Sign Up Bonus / Performance Bonuses, Store Credit, PayPal Payouts,
Zapier, Affiliate Area Tabs, and the Fraud Prevention features.

## Deploy on Railway

1. Push this repo to GitHub and create a Railway project from it.
2. Add a **Postgres** database to the project (this sets `DATABASE_URL`).
3. Set the variables from `.env.example` (`APP_URL`, `SESSION_SECRET`, `WP_SHARED_SECRET`, `WP_SITE_URL`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`,
   and optionally the `PAYPAL_*` keys for automatic payouts).
4. Add a custom domain such as `affiliates.truecosmic.com`.

On every start the app runs database migrations and makes sure the admin user exists.

## Install the WordPress connector

1. Upload `wp-plugin/tc-affiliate-connector.zip` in **Plugins → Add New → Upload** and activate it.
2. **Settings → TrueCosmic Affiliates**: enter the app URL and the same shared secret, then **Save & connect**.
   (Alternatively put `define('TCAFF_SHARED_SECRET', '...');` in `wp-config.php`.)
3. Click **Sync all products now**, then **Create FluentCRM affiliate fields**.
4. Go to **Settings → Permalinks** and click Save once (refreshes pretty `/ref/` links).

## Migrate from AffiliateWP

1. In WordPress: **Affiliates → Tools → Export** both *Affiliates* and *Referrals* as CSV.
2. In the app: **Import from AffiliateWP**. Preview, then import affiliates, then referrals.
3. Place a test order through an affiliate link and check that it appears under Referrals.
4. **Deactivate AffiliateWP** (otherwise both systems record commissions).
5. Click **Send welcome emails** to tell affiliates about their new dashboard.

## FluentCRM automations to build

The app adds and removes these tags, which you can use as automation triggers in FluentCRM:

- `Affiliate`, `Affiliate - Applied`, `Affiliate - Pending`, `Affiliate - Active`, `Affiliate - Inactive`, `Affiliate - Rejected`
- `Affiliate - Has Sales` (re-applied on every sale), `Affiliate - Paid` (after a payout)
- `Referred Customer` on buyers, with the `referred_by` field

Custom fields: `affiliate_code`, `affiliate_status`, `affiliate_link`, `affiliate_earnings`, `affiliate_unpaid`,
`affiliate_referrals`, `referred_by`. Use them as smartcodes in emails, e.g. `{{contact.custom.affiliate_link}}`.

## Development

```bash
cp .env.example .env   # point DATABASE_URL at a local Postgres
npm install
npx prisma migrate dev
npm run seed
npm run dev
npm test
```

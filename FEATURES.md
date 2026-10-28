# AffiliateWP feature parity

Compared against AffiliateWP core plus the Pro add-ons that matter for a WooCommerce academy (courses, ebooks,
coaching, Stripe + PayPal). ✅ = built and covered by the automated tests. ➖ = intentionally not built (reason given).

## Tracking
| AffiliateWP | Here |
| --- | --- |
| Referral links `?ref=` with affiliate ID or username | ✅ Code or old AffiliateWP numeric ID, so existing links keep working |
| Pretty affiliate URLs `/ref/jane/` | ✅ |
| Custom affiliate slugs | ✅ Editable referral code per affiliate |
| Cookie tracking + configurable expiration | ✅ Server-set cookie (not capped to 7 days by Safari), works on cached pages |
| Credit last referrer (on/off) | ✅ Last-click or first-click |
| Visit / click logging (landing page, referrer, campaign, converted) | ✅ With repeat-click de-duplication |
| Campaign tracking | ✅ `utm_campaign` / `c`, reported per campaign for admin and affiliate |
| Direct Link Tracking (Pro) | ✅ Affiliate registers a domain, admin approves, plain links are credited |
| Affiliate Landing Pages (Pro) | ✅ Assign site pages to affiliates |
| Coupon tracking / affiliate coupons | ✅ Assign codes, or auto-create a personal WooCommerce coupon on approval |
| Short links / QR codes | ✅ `/r/code?to=...`, QR codes on every link and creative |

## Commissions
| AffiliateWP | Here |
| --- | --- |
| Percentage / flat rates, global default | ✅ |
| Per-affiliate rates | ✅ |
| Per-product rates, disable commission per product | ✅ |
| Per-category rates | ✅ |
| Per-affiliate per-product rates (Affiliate Product Rates add-on) | ✅ |
| Affiliate groups with group rates | ✅ Default group for new sign-ups |
| Flat rate basis: per product or per order | ✅ |
| Exclude/include shipping and tax | ✅ |
| Ignore zero-amount referrals | ✅ |
| Tiered rates (Pro) | ✅ By lifetime sales count or earnings |
| Lifetime commissions (Pro) + lifetime rate | ✅ Customers linked to first affiliate |
| Recurring referrals (Pro) + recurring rate | ✅ WooCommerce Subscriptions renewals |
| Multi-tier / sub-affiliates (Pro) | ✅ Up to 5 levels, recruitment link, network tab |
| Sign-up referrals (pay per registration) | ✅ |
| Performance bonuses / sign-up (welcome) bonus | ✅ Paid once per affiliate |
| Referral statuses pending / unpaid / paid / rejected | ✅ Plus "hold for approval" mode |
| Auto-reject on refund / cancellation | ✅ Including the affiliate's upline (network) commissions; commissions already paid are flagged for review |
| Manual referrals | ✅ |

## Fraud prevention
| AffiliateWP | Here |
| --- | --- |
| Self-referral blocking | ✅ |
| PPC traffic detection | ✅ Ad click IDs flag the visit; its sale is held as pending |
| IP velocity on sign-ups | ✅ Max applications per IP per day |
| Spam protection on registration | ✅ Honeypot (no reCAPTCHA keys needed) |
| Review flagged referrals | ✅ Flagged filter on Referrals and Visits |

## Affiliates and registration
| AffiliateWP | Here |
| --- | --- |
| Registration form, extra fields, terms of use | ✅ Configurable fields, terms checkbox + link |
| Auto-approve / manual approval / rejection reason | ✅ |
| Auto-register customers as affiliates | ✅ |
| Affiliate notes | ✅ |
| Bulk actions | ✅ Approve, reject, deactivate, move group, CRM sync, delete |

## Affiliate area
| AffiliateWP tab | Here |
| --- | --- |
| Dashboard / statistics / graphs with date ranges | ✅ |
| URL generator | ✅ Any page + campaign, plus a ready link for every product |
| Referrals, visits, payouts | ✅ Order details with optional customer names |
| Creatives | ✅ Image, text and QR creatives, limited per group |
| Coupons tab | ✅ |
| Settings (payment email, notification opt-out) | ✅ |
| Leaderboard | ✅ Monthly, first name + initial |
| Network (sub-affiliates) | ✅ |
| Direct links tab | ✅ |
| Login | ✅ Passwordless email link |

## Payouts
| AffiliateWP | Here |
| --- | --- |
| Manual payouts + payout history | ✅ |
| PayPal mass-payment CSV | ✅ |
| PayPal Payouts (automatic) | ✅ When `PAYPAL_CLIENT_ID/SECRET` are set |
| Store credit | ✅ Single-use WooCommerce coupon locked to the affiliate's email |
| Minimum payout | ✅ |
| Stripe payouts | ➖ Needs Stripe Connect onboarding for each affiliate; mark as paid with method "Stripe" instead |
| Payouts Service (international bank transfers) | ➖ AffiliateWP's own hosted service; use bank transfer + mark as paid |

## Admin
| AffiliateWP | Here |
| --- | --- |
| Reports: referrals, visits, affiliates, campaigns, products, date filters | ✅ Plus traffic sources and credit method |
| Customers screen | ✅ |
| Email notifications with editable templates + test send | ✅ 7 templates |
| Import / export (CSV) | ✅ AffiliateWP CSV import; CSV export of all data |
| REST API | ✅ `/api/v1` with API keys |
| Zapier / webhooks | ✅ Signed outgoing webhooks (Make, Zapier, n8n) |
| Activity / debug log | ✅ |

## Integrations
| AffiliateWP | Here |
| --- | --- |
| WooCommerce (classic + block checkout, HPOS) | ✅ |
| Stripe / PayPal gateways | ✅ Via WooCommerce orders |
| WooCommerce Subscriptions | ✅ |
| Mailing-list / CRM | ✅ FluentCRM tags, list, custom fields |
| Other e-commerce plugins (EDD, MemberPress, LearnDash checkout…) | ➖ Not used by truecosmic.com; can be added to the connector plugin if needed |
| Multi-currency commissions | ➖ The store sells in one currency |

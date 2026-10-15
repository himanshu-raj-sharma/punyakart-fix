# Deploy Punyakart to Hostinger

## v15 candidate — payment-attempt separation and captured-payment reconciliation

This release candidate changes the data model and admin display. **Do not upload it
until the local tests pass and an Atlas backup has been confirmed.**

- Checkout initiation, incomplete payment, and retryable failures are written to
  `payment_attempts`; they no longer inflate the confirmed-donation table.
- A donation enters `donations` only after the backend has fetched/received an
  authenticated Razorpay payment, validated `status=captured`, INR, amount, and
  order binding, and then written the verified row with a receipt number.
  Refunded confirmed donations remain in the ledger for accounting/audit.
- The authenticated admin panel has a **Payment attempts** tab. Its diagnostics
  show the runtime MongoDB host/database and status counts without showing the
  connection string or donor records, so production can be compared with Atlas.
- The server runs a bounded reconciliation sweep every 60 seconds for linked
  pending Razorpay order/QR attempts older than 60 seconds. It finalizes only
  verified captured payments that match the stored amount/order. It does not
  import every captured payment from the whole Razorpay account.
- A failed individual Razorpay payment is recorded as an attempt failure; it
  does not terminally mark a still-payable Razorpay order, because a retry may
  subsequently be captured.

### Razorpay webhook settings

Configure the webhook URL as `https://punyakart.com/api/webhooks/razorpay`.
The secret configured in Razorpay must match Hostinger's `RAZORPAY_WEBHOOK_SECRET`
exactly. Enable at least `payment.captured`, `payment.failed`,
`payment.refunded`, and `refund.processed`. If Auto Pay is used, also enable
`subscription.charged`, `subscription.cancelled`, `subscription.completed`,
and `subscription.halted`. A secret variable existing in Hostinger does not
prove that the dashboard webhook URL/events/secret are correctly configured.
The periodic sweep provides a recovery path for linked attempts if a callback or
webhook was missed, but the webhook should still be configured.

### One-time legacy attempt migration

The current `donations` collection may still contain historical `initiated`,
`pending_verification`, or `failed` rows. The migration is **dry-run by default**.
First take and verify an Atlas backup. Run the script only with the intended
production `DATABASE_URL` and `PUNYAKART_DB_NAME`:

```powershell
npm run migrate:payment-attempts
```

Review the reported database name/host and pending counts. No records are written
in dry-run mode. Only after the Atlas backup is verified, and only if the report
matches the intended production collection, apply the move:

```powershell
npm run migrate:payment-attempts -- --apply --backup-confirmed
```

The script copies each unconfirmed row to `payment_attempts`, checks identity and
state, and deletes the source row only after a successful copy. It never moves
verified/refunded donations. **Do not run this against a local/dev database or
against an unverified connection string.** Do not bulk-import all Razorpay
Dashboard payments: some may belong to other products or attempts; compare
payment ID/order ID with Punyakart metadata before any recovery. Captured payments
without a matching attempt require a separate, per-payment investigation.

### Hostinger environment variables

| Variable | Required? | Purpose |
|---|---|---|
| `DATABASE_URL` | **Yes** | MongoDB Atlas connection string. Keep the value private. |
| `PUNYAKART_DB_NAME` | Optional; recommended | Database name; defaults to `punyakart`. |
| `ADMIN_API_KEY` | **Yes** | Admin API bearer secret; production requires at least 32 random characters. |
| `DONOR_JWT_SECRET` | **Yes** | Donor/document authorization signing secret; production requires at least 32 random characters. |
| `RAZORPAY_KEY_ID` | **Yes** | Public key ID paired with the server key secret. |
| `RAZORPAY_KEY_SECRET` | **Yes** | Server-only Razorpay API and checkout-signature secret. Never expose it in frontend code. |
| `RAZORPAY_WEBHOOK_SECRET` | **Required for webhook sync** | Must exactly match the webhook secret configured in Razorpay. Without it this webhook route rejects events. |
| `NODE_ENV` | Set to `production` | Production safety checks and runtime behavior. |
| `PORT` | Usually supplied by Hostinger | Do not hard-code unless Hostinger explicitly requires it. |
| `CORS_ORIGINS` | Optional / deployment-specific | Comma-separated allowed origins if CORS restrictions are configured; verify it includes the canonical production origin. |
| `VITE_RAZORPAY_KEY_ID` | Optional public build-time fallback | Public key ID only. Checkout normally uses the key ID returned by the backend. It is not a secret and does not control database synchronization. |
| `META_PIXEL_ID` | Needed for current Meta CAPI integration | Must be `1112592431188643` for the existing sender. |
| `META_CAPI_ACCESS_TOKEN` | Optional integration; required to send CAPI | Server-side secret for Meta Conversions API. Keep in Hostinger only. |
| `PUBLIC_SITE_URL` | Strongly recommended | Canonical origin, normally `https://punyakart.com`; required for a correctly configured Meta CAPI source origin. |
| `META_CAPI_TEST_EVENT_CODE` | Optional | Meta Test Events only; remove after testing live events. |
| `META_GRAPH_API_VERSION` | Optional | Defaults to `v22.0` in the current integration. |
| `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM` | Optional integration; all four required to send email | SMTP delivery for receipts/certificates. |
| `SMTP_PORT`, `SMTP_SECURE`, `EMAIL_REPLY_TO`, `EMAIL_FROM_NAME` | Optional | SMTP transport and sender display settings. Default SMTP port is 587. |
| `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_TEMPLATE_NAME` | Optional integration; all three required to send WhatsApp | Meta WhatsApp Cloud API template delivery. |
| `WHATSAPP_TEMPLATE_LANGUAGE`, `WHATSAPP_TEMPLATE_VARS` | Optional | WhatsApp template language and parameter mapping. |
| `NGO_80G_NUMBER` | Optional but should be verified | Official 80G registration number displayed on certificates. An unset value produces a pending/not-valid-for-ITR notice. |
| `NGO_TAX_BENEFIT`, `NGO_CONTACT_EMAIL` | Optional | Certificate disclaimer and contact address. |
| `LOG_LEVEL` | Optional | Backend log verbosity; defaults to `info`. |

`VITE_RAZORPAY_KEY_ID` is a public key value, not a payment-sync fix. The key pair
(`RAZORPAY_KEY_ID` + `RAZORPAY_KEY_SECRET`) must be from the same Razorpay mode
(test or live). Never paste secret values into chat or commit them to GitHub.

## v14 historical release notes — campaign route reliability

This release enforces **₹200 minimum for every new donation, including
Chennai Airport**, in public forms, shared checkout, backend and new manual
receipts. CMS donation offers use the same minimum; the first contribution-table
tier is ₹200. Existing paid records and recurring mandates are not changed.
Supported automatic-debit plans remain unchanged and still start at ₹500.

The v5/v10/v11/v12/v13 release notes below describe historical archives. v14 supersedes
their donation minimums and first contribution tier. This ZIP does not deploy
itself or change existing production records.

Also included: the v12 repairs plus the full-audit fixes: shared masked-donor name parsing, campaign feed/stat attribution,
active-campaign checks, campaign/CMS refresh, admin logout/refresh race fixes,
checkout cancellation and once-only completion, conditional payment-state writes,
recurring-callback deduplication, and private build-file serving protection.

The audit release also includes readable campaign route/API aliases, lazy-route
error recovery for public and admin pages, early admin rate limiting, a 2 MB
ordinary API body limit with a media-only 70 MB limit, browser payment session
token binding, indexed payment-reference lookup, and bounded donation text fields.

v14 additionally eager-loads all public campaign page modules. This prevents a
partial or stale Hostinger hashed-chunk deployment from blanking c2/c3/Navratri
while c1 still appears. The main bundle is larger, but campaign navigation no
longer depends on separate lazy campaign chunks. Upload the complete v14 release
atomically and purge old HTML/browser/CDN cache.

Live payment/Mongo/browser verification is not claimed. Durable notification
recovery after process crashes and global duplicate-payment protection across
independent import/recurring paths remain follow-up work. Keep live environment
settings and media backups; do not run `npm run test:backend` against production.

## Historical v14 ZIP reference

Historical archive name: **punyakart-hostinger-campaign-routes-v14.zip**. It does not contain this payment-ledger release candidate.
This release includes the latest Navratri copy and hero styling, the shared
Thursday/C5 campaign layout, fixed public header, shared public footer, and
campaign-specific recent-donor popup. It retains traffic attribution, donation
minimums, and Meta CAPI. Earlier archives are not overwritten.

### Mobile layout, images and contribution tables in v11

- Compact mobile header, larger touch controls, responsive campaign cards and
  checkout, one page-owned donation widget instead of overlapping bars, and
  footer clearance based on the visible widget height.
- Mobile donor popup sits below the header and is suppressed while a shared
  modal is open. Admin header and campaign filter fit narrower screens.
- Birthday cards use the existing birthday banner when the CMS image is blank.
  Custom CMS images are preserved.
- Campaign contribution tables share suggested amounts of ₹101, ₹501, ₹1,001,
  ₹2,501, ₹5,001 and Custom Amount, with animal/birthday/relief/category-specific
  purposes. These shared rows take precedence over old CMS allocation rows;
  CMS section headings remain configurable. In v11 the campaign minimum was
  ₹100 and Chennai Airport was ₹500; v13 replaces both with ₹200 and its first
  table tier is ₹200. Products/prices are unchanged.
- Automated checks and production builds do not replace visual device checks.
  After deployment, inspect 320/360/390/430px widths: header/menu, product controls,
  donation widget, footer, table, checkout scrolling/keyboard, and admin filters.
  Real-device visual verification remains pending.

### Public header, footer and donor popup in v10

- One fixed header and shared footer across public pages; staff admin controls
  remain separate. Page offsets follow the measured header height.
- Campaign-detail popups read the real recent-donation API every 15 seconds;
  the admin panel polls every 30 seconds. These are polling intervals, not
  guaranteed delivery times or instant push updates.
- Popups remain hidden without valid donation records/API access and honor the
  server's public donor-name/anonymous formatting.
- Live Razorpay capture, MongoDB persistence, webhook delivery, notifications,
  and production admin synchronization still require an authorized live or
  sandbox smoke test. A passing package build is not proof of those integrations.

### Navratri campaign and hero banner

- New public page: **`/campaigns/navratri`**.
- Navratri hero/card image is now the supplied `navratri-hero.jpg` artwork.
- New Faith campaign card appears after the active CMS/API record is confirmed.
- The page reuses the Thursday/C5 layout with the supplied hero artwork and
  updated Navratri text. Existing CMS overrides are retained, so check displayed
  copy after deployment; seeding does not replace older saved content. Target `0`
  means no fixed goal. Donation controls require a confirmed active campaign.
- Donations use source `campaign_navratri`, the universal **₹200 minimum in v13**,
  and the existing shared checkout/payment/CAPI/traffic-attribution flow.
- Startup idempotently creates the missing Navratri campaign record in MongoDB
  without overwriting existing campaign edits or donation statistics. No manual
  migration is required.

### Admin traffic attribution added in v6

- Fixed the admin API omitting the saved donation source, which previously caused
  the frontend to show Chennai Airport for every row.
- Campaign / portal and Traffic source are separate donor columns. Existing saved
  campaign sources display correctly; absent history is not guessed or rewritten.
- New visits capture safe UTM labels/referrer host for internal donor reporting.
  Admin supports traffic filtering/search and exports attribution to CSV.
- No new environment variables, migration or extra service are required. Use
  tagged links in your ads/shares, particularly WhatsApp, for reliable distinction.
- Read **[TRAFFIC_ATTRIBUTION.md](TRAFFIC_ATTRIBUTION.md)** for copyable links,
  Meta URL-parameter setup, unknown-source explanations and testing instructions.

### Meta CAPI added in v4

Read **[META_CAPI.md](META_CAPI.md)** before deploying. Keep META_PIXEL_ID set to
1112592431188643 and META_CAPI_ACCESS_TOKEN private in Hostinger's environment
variables. PUBLIC_SITE_URL must be the canonical HTTPS website origin. Optional
META_CAPI_TEST_EVENT_CODE enables Meta's test reporting (not Razorpay test payments).
Click Apply changes when saving environment variables.

Only consented, captured INR payments are queued for this Pixel. Checkout now has
an optional, unchecked Meta measurement box; donations still work without opting
in. The corresponding browser Purchase is also opt-in. The other Pixel, existing
PageView tracking and both CSP/Event Setup fixes remain unchanged. The new Mongo
outbox is separate from donation/admin statistics and needs no manual migration.

### Donation minimums updated in v5

- Historical v5 rule: Chennai Airport ₹500, other campaigns ₹100.
  **Superseded in v13: ₹200 minimum everywhere, including new manual receipts.**
  Frontend inputs, shared checkout and backend initiation enforce the same rule.
  The existing upper safety limit of ₹1,00,00,000 is retained. Zero, negative,
  fractional, malformed, and non-finite amounts are rejected.
- The shared checkout has an editable Donation amount field, including when it
  is opened from campaign pages, quick-donate buttons, or the site header.
- Existing presets remain available. The amount is locked for a created payment
  session; choosing Edit amount or donor details starts a new session on submit.
- Custom entries and all 23 language packs now show the uniform ₹200 minimum.
- Header/footer/quick checkout preserves the campaign attribution and uses ₹200.
  Missing/blank source still defaults to Chennai Airport, also with a ₹200 minimum.
- Existing payment orders, paid records, admin manual receipts and existing
  recurring mandate amounts are not retroactively changed or increased.
- Monthly gifts can use small/custom amounts as one-time payments with monthly
  intent. Automatic recurring debits still require an existing supported
  Razorpay plan amount: ₹500, ₹1,000, ₹2,000, ₹3,500, ₹5,000, ₹8,500, ₹12,000,
  ₹18,000, or ₹22,000. This release does not create new gateway plans.

This package includes the complete website source, public assets, dependency
lockfile, and fresh frontend/backend builds. It contains the applied Meta tracking
CSP fix: both existing Pixels are preserved, and only their two configured gateway
origins are added to connect-src. Version 2 also allows the exact setup-tool script
https://www.facebook.com/signals/iwl.js in script-src and script-src-elem. Meta's
public fbevents.js bootstrapper loads that URL when starting its setup tool,
including the extension flow. The prior policy allowed the normal Pixel script
but blocked this separate script. No Facebook wildcard, unsafe-eval, or relaxed
frame protection was added. These Meta fixes are retained in v11. Razorpay payment
verification and Purchase tracking from the verified payment amount are preserved.

This package contains the application source, assets, and deployment configuration;
local workspace notes and private development files are not included in the ZIP.

## Before uploading: keep your live data safe

1. Back up the current Hostinger application so you can roll back.
2. Save a copy of any live uploaded files in **dist/media**. They are not present
   in this local project package and can be lost when an application is replaced
   or rebuilt. Restore them after deployment, or use persistent media storage.
3. Keep the application's existing environment variables in Hostinger. The ZIP
   deliberately contains no .env file, credentials, or database contents.
4. Keep DATABASE_URL and PUNYAKART_DB_NAME pointing to the existing production
   MongoDB database. Do not reset, import over, or delete that database.

## Simple redeployment steps

1. Sign in to Hostinger and open the **existing Node.js application** for
   punyakart.com. Do not create a replacement database or a static-only website.
2. Use its ZIP/source upload deployment option and select the ready ZIP above.
   If your plan instead uses File Manager, extract the ZIP into the application's
   existing root after backing it up. The ZIP has no extra enclosing folder:
   package.json and server.cjs must be at the application root.
3. Retain your working application configuration. For an Express/Node setup:
   - **Runtime:** Node.js 24 if available (the local verification runtime), or a
     compatible supported Node.js release. Installed MongoDB requires at least
     Node.js 20.19; the build toolchain also has its own version requirements.
   - **Install:** npm ci (include development dependencies if rebuilding).
   - **Build:** npm run build, if Hostinger requires a source-build command.
     The ZIP already includes dist, so a build can be omitted when deploying
     prebuilt output if your Hostinger workflow permits it.
   - **Start command:** npm start.
   - **Startup file, if requested instead:** server.cjs at the application root.
     Do not use server.js or frontend/index.html as the Node startup file.
   - **NODE_ENV:** production.
   - **PORT:** let Hostinger provide the port; do not replace it with a fixed value.
4. Keep all existing payment, donor-token, email, WhatsApp, and NGO environment
   values. Important names include ADMIN_API_KEY, DONOR_JWT_SECRET,
   RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET, DATABASE_URL,
   PUNYAKART_DB_NAME, PUBLIC_SITE_URL, and your SMTP/WhatsApp/NGO settings.
   Never send secret values in chat or put them in the ZIP.
5. Finish deployment and restart the Node.js application if the workflow does
   not restart it automatically. Restore backed-up media if necessary.
6. Open https://punyakart.com and press Ctrl + Shift + R. Check the page and
   campaign images, then check https://punyakart.com/health for status "ok".
7. Clear the browser console and reload. The two reported gateway connect-src
   errors should be gone. If they remain, inspect the document's response CSP:
   an old deployment or an additional proxy policy may still be active.
8. With the Meta Ads Data Advisor panel open, reload the website and retry
    Set up events. Test each Pixel separately. The user confirmed that the v2
    setup popup worked live; check it again after redeploying v11. If it fails, capture the new
   console error with access tokens and account details hidden; do not remove
   other security protections or configure a duplicate Purchase button rule.
9. In Meta Events Manager, check Test Events for both Pixels:
   922745934005234 and 1112592431188643. Confirm PageView. Purchase should be
   checked only after an authorized successful donation, with the correct INR
   amount; clicking Donate alone is not a completed purchase.

If a field or screen differs, retain the working settings rather than guessing.
This ZIP does not itself deploy the website or verify live Meta event delivery.

## Check flexible amounts after deploying the updated source

1. On Chennai Airport, try ₹199 (rejected), then ₹200 and ₹201 (accepted). Confirm
   the donation button and checkout show exactly the chosen valid amount.
2. On each other campaign, try ₹199 (rejected), then ₹200 and ₹201 (accepted),
   including its header/quick Donate button. Repeat on a mobile viewport.
3. Try 0, a negative amount, and a decimal; submission must be rejected, not
   silently rounded or replaced with a preset.
4. On any campaign select Monthly and enter ₹200 or ₹777. Auto Pay must be disabled and the page
   must clearly say it is a one-time payment, not an automatic recurring debit.
5. Confirm a supported preset still permits Auto Pay. Do not authorize a real
   recurring mandate merely to test the checkbox.

Local verification covers amount parsers/validators, synthetic initiation and
subscription repositories, server-rendered checkout forms, locale copy, typecheck,
and production builds. Real Razorpay acceptance/settlement and interactive browser
payment completion require a separate authorized sandbox or live check. No payment,
database write, email, or WhatsApp message is sent by the isolated tests.

## What is intentionally excluded

- node_modules: Hostinger installs dependencies from package-lock.json.
- .env files, credentials, private keys, logs, database exports, and backups.
- .git, local workspace metadata, internal notes, and other archives.
- Source maps from the packaged build.

The current npm run build script generates a server source map when run again;
the no-source-map statement applies to the supplied ZIP build. Client and server
output separation is a separate outstanding audit recommendation.

## Recreate a checked package locally

Requires Node.js, installed project dependencies, and Python 3.11+ for packaging
only. Python is not needed to run the website on Hostinger.

```powershell
node --import tsx --test tests/siteChrome.test.ts tests/liveDonationToast.test.ts tests/mobileLayout.test.ts tests/campaignImages.test.ts tests/contributionTiers.test.ts
python -B scripts/pack_hostinger.py --temp-dir "C:\path\to\approved-temp-dir" --output "punyakart-hostinger-mobile-v11.zip"
```

The packager refuses to overwrite an existing ZIP. To make a later release:

```powershell
python scripts/pack_hostinger.py --temp-dir "C:\path\to\approved-temp-dir" --output "punyakart-hostinger-next.zip"
```

It runs TypeScript, isolated CSP/donation tests, Meta CAPI/consent/payment-flow tests,
traffic capture/admin/persistence-flow tests, the isolated payment-attempt/reconciliation
tests, and Navratri page/discovery/integration tests, then
builds in a temporary folder without
clearing workspace dist/media, checks bundle syntax, checks ZIP integrity and
required files, and confirms the CSP gateway origins, the setup bootstrap script
in both script directives, both Pixel initializations and CAPI/traffic/Navratri build wiring.

It deliberately does not run test:backend, which writes/deletes test database
records and can inherit outbound notification settings. That suite requires a
separate isolated database and disabled/mock integrations. Do not run it on
Hostinger with production service credentials. The optional npm run pack:hostinger
shortcut uses the same Python script with default arguments. The direct Python
commands above avoid npm/shell argument-forwarding differences on Windows. Do not
use the legacy Bash pack command for this safe packaging workflow.

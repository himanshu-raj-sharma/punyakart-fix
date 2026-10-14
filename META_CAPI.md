# Meta Conversions API — Pixel 1112592431188643

## Release and scope

`punyakart-hostinger-campaign-routes-v14.zip` retains the v4 server-side Purchase sender for
**1112592431188643 only**. This release uses **₹200 minimum everywhere**, including
Chennai Airport, in whole rupees. Uploading this ZIP is a separate deployment step. It retains both
Pixel initializations and the earlier CSP/Event Setup Tool fixes. It does not
change the admin dashboard's calculation rules or prove the entire project works
end to end. Separate issues in the internal project audit remain outside scope.

The access token is read at runtime, never included in frontend code or this ZIP.
No live credentials or donor data were needed to implement the integration.

The separate v6 first-party traffic-source reporting described in
[TRAFFIC_ATTRIBUTION.md](TRAFFIC_ATTRIBUTION.md) does not enable Meta consent or
send its UTM/referrer snapshot through CAPI. Admin attribution is not expected to
match Meta's ad reporting exactly; they use different evidence/windows.

## Hostinger settings

In the existing application's **Environment variables** screen, keep:

| Name | Value / purpose |
| --- | --- |
| `META_PIXEL_ID` | `1112592431188643` (another Pixel disables this integration) |
| `META_CAPI_ACCESS_TOKEN` | The token for this dataset, entered privately in Hostinger |
| `PUBLIC_SITE_URL` | Canonical HTTPS URL, normally `https://punyakart.com` |
| `META_CAPI_TEST_EVENT_CODE` | Optional code from this dataset's Test Events tab |
| `META_GRAPH_API_VERSION` | Optional; defaults to `v22.0`. Use a Meta-supported version if updating it. |

Do not prefix the token with `VITE_`, paste it into chat, or put it into source,
screenshots, `.env` files inside the upload ZIP, or a URL. Avoid extra whitespace
in these values. Click **Apply changes**, then deploy/restart the v8 application.
Deleting the CAPI token and restarting disables new server submissions; it does
not delete already queued records or events already sent to Meta.

Keep PUBLIC_SITE_URL consistent with the visitor-facing canonical origin. The
server accepts checkout source URLs only from that exact origin (including the
`www` distinction); use your existing canonical redirect rather than trusting
arbitrary domains. URLs sent to Meta have query strings and fragments removed.

Deploy using [DEPLOYMENT.md](DEPLOYMENT.md). Preserve existing Razorpay, database,
donor authentication and notification variables. Back up live `dist/media` first.
No migration command is needed: the outbox collection/indexes are created lazily.
The existing Mongo user needs permission to create/write that collection/indexes.

**Check for an existing CAPI Gateway/partner integration for this same Pixel
before activating a second server sender.** If a gateway already sends Purchase,
its event IDs must be coordinated or that duplicate Purchase sender disabled.
This release does not change external gateway settings or Meta UI event rules.

## GTM and Content Security Policy diagnostics

The site's CSP intentionally does **not** permit `'unsafe-eval'`. The browser
diagnostic in which `gtm.js` attempts string evaluation commonly indicates a
Google Tag Manager Custom JavaScript variable or another container feature that
depends on evaluation. Google's recommended alternative is to replace Custom
JavaScript variables with built-in variables or Custom Templates; do not loosen
the site CSP simply to hide the error without reviewing the container.

Review container `GTM-WRK43MWJ` for tags/variables that send Meta `Purchase` or
`InitiateCheckout`. The site code already emits native browser events with the
real server-created/verified INR amount and a matching event ID for the opt-in
Pixel. If GTM also sends those Meta events, it can create duplicate or constant-
value events. Keep only one deliberate sender per event/Pixels, or explicitly
supply validated dynamic `value`, `currency`, and event IDs to the chosen GTM
tag. Do not guess at event parameters or use a fixed donation value.

The application source loads GTM, Pixel and Clarity only on `punyakart.com` and
`www.punyakart.com`, and the native event helper now separately blocks native
Meta conversion dispatch on other browser hosts. If Meta reports a Vercel preview
domain, inspect the published GTM container and the deployed preview build. Do
not add the preview domain to a trusted domain list unless it is intentionally
part of production tracking.

The live production DevTools report on 2026-10-14 showed these exact Meta-related event hosts:
`https://mpc-prod-28-1053047382554.us-central1.run.app`,
`https://mpc-prod-21-1053047382554.us-central1.run.app`, and
`https://5z-2b6b7616f94640c2840d1841e1ac24c3.ecs.us-east-1.on.aws`.
The policy permits only these observed hosts under `connect-src`; it does not
allow arbitrary `run.app` or `on.aws` domains.

The same report showed the Meta Conversions API parameter-builder client bundle
loaded by the remotely managed GTM container from
`https://cdn.jsdelivr.net/npm/meta-capi-param-builder-clientjs/dist/clientParamBuilder.bundle.js`
and
`https://unpkg.com/meta-capi-param-builder-clientjs/dist/clientParamBuilder.bundle.js`.
These exact script paths are allowed for the published Meta client SDK
(see https://www.npmjs.com/package/meta-capi-param-builder-clientjs and
https://github.com/facebook/capi-param-builder). The Clarity script host
`https://scripts.clarity.ms` is also allowed explicitly because `script-src`
overrides `default-src` for scripts. The policy does not trust the entire
jsDelivr or unpkg host, and no `unsafe-eval` was added.

The separate DevTools issue reporting blocked string evaluation comes from
`gtm.js?id=GTM-WRK43MWJ`. It cannot be fixed by changing `connect-src` or by
adding script hosts. Google's guidance states that GTM Custom JavaScript variables
may require `unsafe-eval`, but recommends replacing them with built-in variables
or sandboxed Custom Templates instead. Inspect the remote GTM container and fix
the specific tag/variable there; do not weaken CSP globally just to clear this
warning.

After deploying this policy update, recheck the browser's exact blocked URL list.
If Meta rotates to a new event endpoint host, inspect its ownership and origin
before adding another exact host. Never add a broad cloud-host wildcard to make
a CSP warning disappear.

## Consent and data minimisation

Checkout has an **optional, unchecked** Meta advertising-measurement choice.
Without opt-in, payment still works, but this integration sends no server Purchase
and no checkout Purchase to Pixel 8643. Pixel 922745934005234 keeps its existing
browser Purchase behavior. Existing PageView scripts and external integrations
are unchanged: this is not a sitewide cookie-consent implementation.

The choice is captured when the payment session is created. Editing details and
submitting again creates a new session. Closing/reopening checkout resets the box;
it does not revoke an already-created payment session or retract an event already
sent. Use the published contact to request withdrawal for future processing.

For Auto Pay, the form explicitly includes future captured recurring charges in
the optional choice. Later charges inherit consent from the seed donation but do
not replay old browser cookies or the old browser user agent. A staff withdrawal
request must also stop future sharing from that subscription's seed attribution;
there is no new self-service consent-revocation admin screen in this release.

Only these fields are allowed into a Purchase event:

- Event name, original verification time, donation event ID, website source URL.
- Actual captured amount in rupees and currency `INR`.
- SHA-256-hashed, normalized email and Indian phone number including country code.
- Existing valid `_fbp` / `_fbc` cookies and the original browser user agent
  and server-resolved client IP, when available after opt-in. The server normalizes
  valid IPv4-mapped IPv6 addresses and rejects malformed IP strings. Client IP is
  never accepted from the browser request body.
- The CAPI payload includes `client_user_agent` and `client_ip_address` together
  only when both are valid. If one is missing/invalid, both are omitted so the
  event does not send a mismatched browser-network pair. Webhook IP/UA is never
  substituted for the visitor.

No PAN, postal address, prayer/dedication text, cause text, full name, payment card
details or raw email/phone are sent by this integration. Hashing is not anonymity.
Treat hashes, cookies and attribution as personal data; restrict Mongo access and
apply your privacy/retention and withdrawal procedures. The privacy page describes
this limited integration but is not a certification of legal compliance.

## Payment handling and deduplication

Razorpay callback signatures and webhook signatures remain required. The shared
finalizer requires a captured INR payment, matching paise amount and bound order
where present. Polling, checkout verification, and signed captured-payment/
subscription-charge webhooks feed the sender only after the donation is verified.

- Creating an order, failed/pending payments, mandate-only activation, manual/admin
  verification, historical imports without consent, and refunded records do not
  create a new CAPI Purchase through this integration.
- Browser `eventID` and server `event_id` are the same canonical donation ID, with
  the same `Purchase` event name and currency/value.
- The durable outbox key also includes the actual gateway payment ID, so repeated
  callbacks/webhooks (or duplicate upstream rows for one charge) do not create two
  server conversions. A genuinely new recurring charge has its own identity.
- The integration does not backfill old donations or treat a refund as a new
  Purchase. It does not retract a Purchase that Meta already accepted before a
  later refund. Pending queue entries represent the original capture, not a net
  revenue/refund ledger; Meta reporting and current admin totals can therefore differ.

## Delivery queue and operational limits

The separate `meta_conversion_outbox` collection stores an allowlisted prepared
event with contact hashes, not raw email/phone or the access token. Donation/admin
collections remain the source of financial truth. Sending does not await a Meta
HTTP response during checkout: an application worker polls the outbox every ten
seconds while the Node app is running. There is no external cron or scheduled job.

The worker uses atomic leases, a ten-second request timeout and exponential retry
for network errors, rate limits and transient server errors. Attempts are capped
at eight; events expire just before Meta's seven-day event-age boundary. Expired
leases recover after a restart. Permanent API rejection is terminal rather than
an endless retry; inspect diagnostics and configuration if it occurs.

Successful delivery requires a 2xx response with `events_received >= 1` and no API
error. That proves API acceptance, not attribution to an ad or completed Meta
deduplication. Delivery is at least once: if Meta accepts an event but the local
acknowledgement fails, a retry sends exactly the same event ID and event time.

Queue records/deduplication keys have no automatic TTL. Keep them access-controlled
and include this collection in retention/deletion procedures. Do not blindly clear
the outbox or reset terminal states: it can replay events. The queue is not a
payment/receipt ledger and must not be added to dashboard donation totals.

Durability starts when Mongo accepts the enqueue. If the process exits or the DB
is unavailable between financial verification and enqueue, the event may be
missing until a repeated callback/webhook retries it. This release does not scan
and backfill all verified donations. Meta/outbox errors are contained and do not
roll back a recorded payment; logs use fixed diagnostic codes without payloads.

## Safe diagnostics

- `GET /health` adds `metaCapiConfigured`. `true` means configuration passed local
  checks only; it does not prove that Meta accepts the token or receives events.
- `GET /api/admin/meta-capi/status` uses the existing admin authentication. It
  reports enabled/disabled reasons, test mode, worker/index state, sanitized last
  issue and counters. It never returns the token, event bodies or donor details.
  This is an authenticated API endpoint, not a newly added admin dashboard tab.
- Counters are per-process and reset on restart; `accepted` counts enqueue calls,
  not unique paid donations. They are not financial totals or a persistent queue
  backlog. Check the outbox operationally if durable delivery state is required.
- Startup logs show safe configuration diagnostics. `[meta-capi] meta_rejected`
  requires checking dataset permissions/token/API configuration privately;
  `index_setup_failed` / `outbox_failed` require checking Mongo availability and
  permissions. Never post full credentials, database records or request bodies.

## Verify after deployment

1. Prefer isolated staging with Razorpay test credentials, a separate database,
   and disabled/mocked donor notifications. Do not swap test keys into the live
   app or run database-writing test suites against production.
2. In Events Manager for **1112592431188643**, obtain a Test Events code and set
   `META_CAPI_TEST_EVENT_CODE` on the application being tested. Restart it.
   **This affects Meta reporting only: it does not make a live Razorpay charge
   free, prevent donor notifications, or switch Razorpay to test mode.** A live
   payment still requires the owner's explicit authorization.
3. Check `/health`, then open checkout, choose a small supported amount, and opt
   in to the optional Meta measurement checkbox for this test.
4. Complete an authorized successful payment. Check the saved donation, matching
   payment reference/amount in admin, and correct totals before and after it.
5. In Meta Test Events, look for a **Server Purchase** with the correct INR amount
   and event ID. With the browser Pixel available, inspect the matching **Browser
   Purchase** event ID and deduplication diagnostics. Browser blockers can prevent
   the browser half; a server event can still arrive for an opted-in payment.
6. Repeat a failed/cancelled checkout and a no-opt-in checkout in the safe test
   environment: neither should produce a server Purchase. A new recurring charge
   should have a new ID; repeated delivery of the same charge should not.
7. Remove `META_CAPI_TEST_EVENT_CODE` when finished and restart. Do not leave an
   empty or whitespace-only test-code variable. New eligible payments then use
   normal reporting. Existing queued test events keep their original test code
   and cannot be converted into live events by replaying the same payment.

Live testing has not been performed in this repository. Token validity, Hostinger
Mongo permissions, real Razorpay webhook delivery, interactive browser behavior,
and Meta attribution/deduplication must still be verified in the deployed setup.

## Reproducible isolated checks

```powershell
npm run lint
npm run test:meta
npm run test:donations
npm run test:csp
python -B scripts/pack_hostinger.py --temp-dir "C:\path\to\approved-temp-dir"
```

The Meta tests use synthetic donors, fake fetch/clock/outbox boundaries, an
in-memory donation repository with the real DonationService, and stubbed
notifications. They cover consent capture, payment rejection paths, verified
readback, browser/server event identity, retries/deduplication, and Meta failures
without changing admin-eligible totals. They also inspect Mongo adapter commands
and server route wiring, but do not start the production server or connect to a
real database. Rendering tests are SSR, not an interactive browser automation run.

The packager runs these checks and builds in temporary staging without clearing
workspace `dist/media`. It validates the ZIP, both Pixels/CSP fixes, CAPI build
markers and absence of server token configuration from the frontend bundle.
It refuses existing ZIP names and never runs `npm run test:backend`, which needs
its own isolated DB/integrations because it writes/deletes records.

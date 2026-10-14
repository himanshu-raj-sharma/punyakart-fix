# Meta Pixel / Conversions API repair status

This package is a source bundle for Hostinger production (`punyakart.com`). Browser tracking scripts in `frontend/index.html` are guarded so Meta Pixel, Google Tag Manager, and Microsoft Clarity load only on `punyakart.com` and `www.punyakart.com`; founder preview domains remain usable but do not load those tracking integrations.

## Tracking behavior in this source

- `InitiateCheckout` is dispatched only after the server returns a valid donation/payment session and only when explicit Meta tracking consent is true. It uses the server-returned donation amount, INR, and the donation ID as the browser event ID.
- `Purchase` is dispatched by the donation UI after verified-donation data is received. Its value is the donation amount and currency is INR. The opt-in Pixel event ID uses the donation ID, matching the server CAPI `event_id`.
- CAPI Purchase is queued only for a verified Razorpay donation with a captured INR payment matching the stored donation amount and payment reference.
- CAPI attribution uses the server-resolved request IP captured at initiation; client-supplied IP/user-data is not trusted. The CAPI payload sends client IP and user agent only as a validated pair, and normalizes IPv4-mapped IPv6 addresses.
- The native browser Purchase/InitiateCheckout helpers are restricted to `punyakart.com` and `www.punyakart.com`, in addition to the hostname checks in `frontend/index.html`.
- `refund.created` alone is not treated as completed refund. Refund state updates are limited to the completed event names handled by the webhook.

## Validation limitations

This bundle was statically inspected and the ZIP can be integrity-checked. A full TypeScript/build/test run was not completed in the packaging environment because the dependency installation timed out and the included dependencies in the original upload were Windows-specific. Do not interpret this report as proof that a production build or live payment flow has passed.

The Google Tag Manager container is remotely managed. The website source restricts GTM loading to the production host and native Meta event helpers also block browser-side event dispatch on preview hosts. The source CSP intentionally blocks `unsafe-eval`; if GTM reports an eval violation, inspect and replace Custom JavaScript variables/container code that needs it rather than relaxing CSP by default. Duplicate GTM Meta tags, remaining blocked resource origins, and the live source of Meta's static/invalid-value diagnostics still require inspection in GTM Preview/Debug mode and Meta Events Manager. No production payment, Meta Events Manager Test Events session, or live database was accessed as part of this packaging step.

## Before deployment

1. Back up the live Hostinger app and production database.
2. Install dependencies in a compatible Node.js 20+ environment with `npm ci`.
3. Run `npm run lint`, `npm run test:meta`, and `npm run build`; resolve any failures before deployment.
4. Package using `npm run pack:hostinger` and inspect the resulting archive.
5. On `punyakart.com`, use Meta Events Manager Test Events to verify one InitiateCheckout for an opted-in checkout and one Purchase only after a verified captured payment. Confirm actual donation amount and INR, and confirm browser/CAPI events deduplicate by the same event ID.
6. In GTM Preview, ensure there is no second Purchase tag firing for the same payment. Keep founder-preview domains out of production tracking.

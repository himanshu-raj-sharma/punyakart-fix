# Donor traffic source reporting — v6

Release: **punyakart-hostinger-campaign-routes-v14.zip** (traffic attribution is retained from v6).

## Why every donor appeared as Chennai Airport

The stored donation `source` describes the **campaign or portal**, not the
advertising platform. The old `toAdminDonation` API serializer omitted `source`.
The admin frontend then defaulted the missing field to `chennai_airport` for every
row. This was a display/API bug; it did not prove that those visitors used that
portal or came from a specific ad.

The corrected API returns the saved source. If it is absent, a saved campaign ID
can identify the campaign; if both are absent, it returns Unknown. No campaign is
inferred from the donor's name, amount, cause title, Meta cookies or phone number.
An explicitly saved but historically incorrect source is not automatically
rewritten. Correcting such financial history would require reliable evidence and
a separate reviewed data-repair operation, not a guessed migration.

## What the admin now shows

In **Admin → Donor details**:

- **Campaign / portal**: Chennai Airport, Crowd Funding, Campaign: c2, Manual, etc.
- **Traffic source**: Facebook, Instagram, WhatsApp, Google, Bing, YouTube,
  LinkedIn, Telegram, X, Meta (platform unknown), Other referral, Other tagged
  source, Direct / unknown, or Unknown — not recorded.
- An evidence label: UTM, Referrer, Click hint, No referrer, or Not recorded.
- Available source/medium/UTM campaign details, and an Original signup marker for
  recurring charges that inherit their initial donation's attribution.

The traffic dropdown is separate from the campaign/portal filter above the table.
Search also matches traffic source, campaign tags and referrer host. CSV export
includes the attribution fields separately from campaign/portal and escapes text
that could otherwise be interpreted as spreadsheet formulas.

Paid, failed and initiated records retain their real status. Selecting a traffic
filter changes which rows are displayed, not the stored donation amount/status.
The displayed verified total uses the existing successful-payment eligibility
rules. Arrival attribution itself is never a payment confirmation.

## Add source tags to ad and share links

Referrers are often hidden by mobile apps, browser settings or redirects.
**Use tagged links for reliable source distinction, especially WhatsApp.**
The same site and campaign remain in use; tags only describe how the link is shared.

The examples below use `/campaigns/second`. Replace that path with the actual
campaign URL you want visitors to open, keeping the query parameters:

### Facebook ad

```text
https://punyakart.com/campaigns/second?utm_source=facebook&utm_medium=paid_social&utm_campaign=pitru_paksha
```

### Instagram ad

```text
https://punyakart.com/campaigns/second?utm_source=instagram&utm_medium=paid_social&utm_campaign=pitru_paksha
```

### WhatsApp share

```text
https://punyakart.com/campaigns/second?utm_source=whatsapp&utm_medium=share&utm_campaign=pitru_paksha
```

For a paid placement use an accurate medium such as `paid_social`; for an organic
Instagram bio link use `social`, not a misleading paid label. A Facebook/Instagram
referrer alone does **not** prove the visit was from an ad.

### One Meta ad with both Facebook and Instagram placements

In that ad's **Tracking / URL parameters** field (wording may vary), use Meta's
supported site-source macro if it is available in your account:

```text
utm_source={{site_source_name}}&utm_medium=paid_social&utm_campaign=pitru_paksha&utm_content=video_a
```

Keep the Website URL set to the actual destination. In a URL-parameters field,
enter the parameter string without a leading `?`. Do not duplicate the same
`utm_source` in the Website URL and the URL-parameters field. When editing a full
URL manually, add `?` for the first parameter and `&` for subsequent parameters.

Verify the resolved destination in your ad preview/test link: `fb` maps to
Facebook and `ig` maps to Instagram. `msg`/Messenger and `an`/Audience Network are
shown as Meta (platform unknown), with the actual sanitized source tag visible;
they are not falsely labelled Facebook. Unresolved template placeholders are
discarded. Separate fixed-tag links are an alternative when using separate ads.

### Other examples

```text
?utm_source=google&utm_medium=cpc&utm_campaign=animal_rescue
?utm_source=youtube&utm_medium=video&utm_campaign=animal_rescue
?utm_source=newsletter&utm_medium=email&utm_campaign=october_update
```

Use short, non-personal names made of letters, digits, spaces, `_`, `-` and `.`.
Labels are limited to 100 characters. Emails, obvious URLs, phone-like long digit
sequences, control characters, formula-like text and unresolved templates are
rejected, not truncated. Use safe campaign names rather than numeric ad IDs or
donor information. Never put tokens, passwords, PANs, phone numbers or emails in
UTM values. A label that passes character checks is still your responsibility to
keep non-personal.

Changing an ad destination/parameters can affect review or delivery. The coding
agent has not edited your Meta Ads Manager, WhatsApp messages or external ads.

## How capture works and its limitations

1. Before the React app navigates, it reads the landing URL and referring URL in
   memory. It retains only allowlisted UTM source/medium/campaign/content, an
   external referrer **hostname**, a safe public landing **path**, capture time,
   and presence flags for `fbclid`/`gclid`. No full URL/query/hash or raw click ID
   is saved by this feature.
2. Source precedence is: valid `utm_source` → external referrer → click hint →
   Direct / unknown. Known hosts use exact/subdomain matching; a fake hostname
   such as `facebook.com.evil.example` is not classified as Facebook.
3. `fbclid` alone identifies only a Meta hint. It cannot reliably distinguish
   Facebook from Instagram. UTM tags or platform referrers provide that detail.
4. The browser keeps one sanitized snapshot in sessionStorage for up to **30
   minutes from capture**. Navigating through the website retains attribution;
   internal page referrers and reloads do not extend that timestamp. A new
   external/tagged document arrival may replace it. This is a short tab-session
   model, not Meta's multi-day/multi-device ad attribution model.
5. Blocked storage falls back to in-document memory; it cannot persist through a
   reload in that case. Missing browser data yields no snapshot. Expired hints
   are not revived just because the original ad URL remains in the address bar.
6. The initial donation request sends the snapshot. The backend sanitizes it
   again using server time, recomputes the label and saves it with the donation.
   A stale/future/malformed capture is discarded without blocking payment.
   Clock skew can therefore cause Unknown rather than an invented label.
7. Verification, retries, receipts and admin reads do not reattribute the donor.
   Later recurring charges retain the original signup attribution and are marked
   inherited; they are not counted as newly observed visits from that platform.

### Unknown labels are intentional

- **Direct / unknown**: capture ran but there was no usable origin evidence. It
  may be a typed/bookmarked link, an untagged WhatsApp share, a hidden referrer,
  an expired arrival or a redirect that stripped tags. It is not proof of a
  direct visit.
- **Unknown — not recorded**: no valid arrival snapshot was saved. This includes
  historical records, manual receipts, older browser bundles or inaccessible
  browser data. We cannot recover a past platform merely from a payment ID.
- **Other referral**: an external hostname is known but not a recognized platform;
  the hostname is shown when available.
- **Other tagged source**: a valid custom UTM source label is present.

UTM and referrer data can be copied, shared, missing or falsified. If someone
forwards an Instagram-tagged link through WhatsApp, its explicit tag still says
Instagram. These are **best-effort recorded attribution signals**, not guaranteed
proof of the donor's last app, identity or paid-ad exposure.

## Privacy and separation from Meta CAPI

This is first-party donor reporting, independent of the optional Meta checkbox.
It creates no new cookies, makes no third-party requests, uses no localStorage,
and collects no IP address, user agent or raw advertising click ID. It does not
enable Meta sharing for a donor who declined it. The CAPI payload remains
allowlisted and does not automatically contain this traffic snapshot.

The initial short-lived browser summary becomes a stored donation-record field,
so it can remain visible in admin after 30 minutes. The 30-minute limit governs
capture acceptance/browser reuse, **not database retention**. Include this linked
donor data in your access, retention, deletion and disclosure procedures. The
privacy page describes the behavior; obtain any additional consent required by
your jurisdiction/policy. This implementation is not legal-compliance certification.

Only authenticated admin responses expose the traffic summary. Public donation
verification/status/receipt serializers omit it, along with private Meta
attribution and client tokens. No historical donor data is rewritten by rollout.

## Deploy and check

1. Back up the live app and `dist/media`, then deploy
   `punyakart-hostinger-mobile-v11.zip` using [DEPLOYMENT.md](DEPLOYMENT.md).
   Keep current environment variables, database and CAPI token unchanged. No new
   settings, migration command or separate analytics subscription is required.
2. Hard-refresh `/admin/donors`. Existing rows should now display their stored
   campaign/portal. Their traffic remains Unknown unless attribution was actually
   saved; this release does not guess historical Facebook/Instagram/WhatsApp data.
3. In isolated staging with test payment credentials and mocked notifications,
   open a tagged link in a fresh tab, navigate to another page, then initiate a
   synthetic donation. Admin's initiated row should show the tagged traffic source
   independently of its campaign. Initiation itself creates a gateway order; do
   not use live setup as a side-effect-free test.
4. Complete an authorized test payment and verify the same source, amount, receipt
   and financial totals remain correct. Try Facebook, Instagram, WhatsApp, an
   external referral and an untagged visit. Check local traffic filters and CSV.
5. For the updated source, confirm the ₹200 minimum everywhere (including Chennai) and CAPI consent behavior
   still work. Test actual in-app ad/share browsers because their referrer/redirect
   behavior differs. Preserve tags across your canonical redirects/shorteners.

Local verification uses synthetic browser/storage boundaries, in-memory donation
repositories, the real donation service/admin serializer, SSR and pure CSV tests.
It does not connect to the production database, start live checkout, or verify an
actual ad click. The full database-writing backend suite is intentionally not run.

```powershell
npm run test:traffic
npm run test:donations
npm run test:meta
npm run test:csp
npm run lint
```

The safe packager repeats these checks, builds in temporary staging without
clearing workspace `dist/media`, and verifies the source-inclusive ZIP.

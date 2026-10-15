import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DonationModal } from '../frontend/src/components/DonationModal';
import { LegalPage } from '../frontend/src/pages/LegalPage';
import {
  collectMetaTrackingPayload, createMetaTrackingPayload, dispatchMetaAddToCart, dispatchMetaInitiateCheckout, dispatchMetaPurchase, isAllowedMetaBrowserHost,
  type VerifiedMetaDonation,
} from '../frontend/src/utils/metaTracking';

// Synthetic data only. No backend imports, dotenv, gateway, network, or database.
const fbp = 'fb.1.1760000000000.1234567890';
const fbc = 'fb.1.1760000000000.Synthetic_Click-123';
const legacyPixel = '922745934005234';
const optInPixel = '1112592431188643';

function withGlobals(descriptors: Record<string, PropertyDescriptor>, run: () => void) {
  const originals = new Map<string, PropertyDescriptor | undefined>();
  try {
    for (const [name, descriptor] of Object.entries(descriptors)) {
      originals.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
      Object.defineProperty(globalThis, name, { configurable: true, ...descriptor });
    }
    run();
  } finally {
    for (const [name, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else Reflect.deleteProperty(globalThis, name);
    }
  }
}

test('false or missing consent emits only false, without reading context or browser data', () => {
  let reads = 0;
  const denyRead = () => { reads += 1; throw new Error('Attribution must not be read'); };
  const context = { get cookie(): string { return denyRead(); }, get sourceUrl(): string { return denyRead(); } };
  withGlobals({ window: { get: denyRead }, document: { get: denyRead } }, () => {
    for (const consent of [false, undefined, null, 'true', 1]) {
      assert.deepEqual(createMetaTrackingPayload(consent as boolean, context), { consent: false });
      assert.deepEqual(collectMetaTrackingPayload(consent as boolean), { consent: false });
    }
  });
  assert.equal(reads, 0);
});

test('opted-in payload contains only existing valid Meta cookies and origin plus path', () => {
  assert.deepEqual(createMetaTrackingPayload(true, {
    cookie: `other=private; _fbp=${fbp}; _fbc=${fbc}; unrelated=not-sent`,
    sourceUrl: 'https://name:password@example.invalid/campaign/giving?email=private%40example.invalid#private',
  }), {
    consent: true, sourceUrl: 'https://example.invalid/campaign/giving', fbp, fbc,
  });
  assert.deepEqual(createMetaTrackingPayload(true, {
    cookie: `not_fbp=${fbp}; _fbp=${fbp.replaceAll('.', '%2E')}`,
    sourceUrl: 'https://example.invalid/?fbclid=SyntheticClick&fbc=not-a-cookie',
  }), { consent: true, sourceUrl: 'https://example.invalid/', fbp });
  assert.deepEqual(createMetaTrackingPayload(true), { consent: true });
});

test('browser collection reads attribution on opt-in and strips query and fragment', () => {
  withGlobals({
    window: { value: { location: { href: 'https://example.invalid/give?private=1#private' } } },
    document: { value: { cookie: `_fbp=${fbp}; _fbc=${fbc}` } },
  }, () => {
    assert.deepEqual(collectMetaTrackingPayload(true), {
      consent: true, sourceUrl: 'https://example.invalid/give', fbp, fbc,
    });
  });
});

test('cookie identifiers are bounded without truncation or fabrication', () => {
  const prefix = 'fb.1.1760000000000.';
  const maxFbp = prefix + '1'.repeat(255 - prefix.length);
  const maxFbc = prefix + 'a'.repeat(255 - prefix.length);
  assert.deepEqual(createMetaTrackingPayload(true, { cookie: `_fbp=${maxFbp}; _fbc=${maxFbc}` }), {
    consent: true, fbp: maxFbp, fbc: maxFbc,
  });
  for (const cookie of [
    `_fbp=${maxFbp}1; _fbc=${maxFbc}a`,
    `_fbp=${'1'.repeat(766)}; _fbc=${'a'.repeat(766)}`,
    `_fbp=${fbp}; ${'x'.repeat(32769)}`,
    '_fbp=fb.1.1760000000000.not-numeric; _fbc=arbitrary',
    '_fbp=%E0%A4%A; _fbc=%ZZ',
    `_fbp=${fbp}%0A; _fbc=${fbc}%3Bprivate`,
    '_fbp=fb.1.1760000000000.123 456; _fbc=fb.1.1760000000000.private@example.invalid',
    `_fbp_extra=${fbp}; _fbc_extra=${fbc}`,
  ]) {
    assert.deepEqual(createMetaTrackingPayload(true, { cookie }), { consent: true });
  }
});

test('URLs reject unsafe or malformed input and are bounded after removing private components', () => {
  const origin = 'https://example.invalid';
  const maxUrl = `${origin}/${'a'.repeat(2048 - origin.length - 1)}`;
  assert.equal(createMetaTrackingPayload(true, { sourceUrl: `${maxUrl}?private=1#private` }).sourceUrl, maxUrl);
  assert.equal(createMetaTrackingPayload(true, { sourceUrl: 'http://example.invalid:8080/give?private=1' }).sourceUrl,
    'http://example.invalid:8080/give');
  for (const sourceUrl of [
    `${maxUrl}a`, `${origin}/?private=${'a'.repeat(8193)}`, '/relative', 'not a url',
    'javascript:alert(1)', 'data:text/plain,private', 'ftp://example.invalid/give',
    'https://', 'https://example.invalid/\nprivate', 'https://example.invalid/%zz',
  ]) {
    assert.deepEqual(createMetaTrackingPayload(true, { sourceUrl }), { consent: true });
  }
});

test('SSR and blocked browser APIs safely omit unavailable attribution', () => {
  withGlobals({ window: { value: undefined }, document: { value: undefined } }, () => {
    assert.deepEqual(collectMetaTrackingPayload(true), { consent: true });
  });
  withGlobals({
    window: { get() { throw new Error('Window denied'); } },
    document: { get() { throw new Error('Document denied'); } },
  }, () => {
    assert.deepEqual(collectMetaTrackingPayload(true), { consent: true });
  });
  withGlobals({
    window: { value: { location: { href: 'https://example.invalid/give' } } },
    document: { value: { get cookie() { throw new Error('Cookies denied'); } } },
  }, () => {
    assert.deepEqual(collectMetaTrackingPayload(true), { consent: true, sourceUrl: 'https://example.invalid/give' });
  });
});

test('native Meta event dispatch is restricted to canonical production hosts', () => {
  assert.equal(isAllowedMetaBrowserHost('punyakart.com'), true);
  assert.equal(isAllowedMetaBrowserHost('www.punyakart.com'), true);
  assert.equal(isAllowedMetaBrowserHost('punyakart-nrmzmlr3y-gurillawarfare.vercel.app'), false);
  assert.equal(isAllowedMetaBrowserHost('evilpunyakart.com'), false);
  assert.equal(isAllowedMetaBrowserHost(''), false);

  const calls: unknown[][] = [];
  const fbq = (...args: unknown[]) => { calls.push(args); };
  withGlobals({
    window: { value: { location: { hostname: 'punyakart-nrmzmlr3y-gurillawarfare.vercel.app' } } },
  }, () => {
    assert.equal(dispatchMetaPurchase({ id: 'preview-donation', amount: 500, metaTrackingAllowed: true }, fbq, new Set()), false);
    assert.equal(dispatchMetaInitiateCheckout('preview-donation', 500, true, fbq), false);
  });
  assert.deepEqual(calls, [], 'preview deployment must not emit native Meta conversion events');
});

test('server-approved Purchase targets both Pixels with the exact same donation event ID', () => {
  const calls: unknown[][] = [];
  const tracked = new Set<string>();
  const donation = { id: 'synthetic-donation-1', amount: 249, metaTrackingAllowed: true };
  const fbq = (...args: unknown[]) => { calls.push(args); };
  assert.equal(dispatchMetaPurchase(donation, fbq, tracked), true);
  assert.deepEqual(calls, [
    ['trackSingle', legacyPixel, 'Purchase', { value: 249, currency: 'INR' }, { eventID: donation.id }],
    ['trackSingle', optInPixel, 'Purchase', { value: 249, currency: 'INR' }, { eventID: donation.id }],
  ]);
  assert.ok(tracked.has(donation.id));
  assert.equal(dispatchMetaPurchase(donation, fbq, tracked), false);
  assert.equal(calls.length, 2, 'polling and verification callbacks share lifecycle deduplication');
});

test('false, missing, and non-boolean server consent preserve only the legacy Purchase', () => {
  for (const metaTrackingAllowed of [false, undefined, null, 'true', 1]) {
    const calls: unknown[][] = [];
    const donation = { id: 'synthetic-donation-2', amount: 1, metaTrackingAllowed } as VerifiedMetaDonation;
    dispatchMetaPurchase(donation, (...args) => calls.push(args), new Set());
    assert.deepEqual(calls, [
      ['trackSingle', legacyPixel, 'Purchase', { value: 1, currency: 'INR' }, { eventID: donation.id }],
    ]);
  }
});

test('missing donation IDs never send opted-in Purchase, and supplied IDs are not rewritten', () => {
  for (const id of [undefined, '', '   ']) {
    const calls: unknown[][] = [];
    dispatchMetaPurchase({ id, amount: 50, metaTrackingAllowed: true }, (...args) => calls.push(args), new Set());
    assert.deepEqual(calls, [['trackSingle', legacyPixel, 'Purchase', { value: 50, currency: 'INR' }]]);
  }
  const calls: unknown[][] = [];
  const id = ' synthetic-id-exact ';
  dispatchMetaPurchase({ id, amount: 50, metaTrackingAllowed: true }, (...args) => calls.push(args), new Set());
  assert.deepEqual(calls.map((args) => args[4]), [{ eventID: id }, { eventID: id }]);
});

test('invalid amounts and unavailable fbq do not dispatch or consume the donation dedup ID', () => {
  const calls: unknown[][] = [];
  const tracked = new Set<string>();
  for (const amount of [0, -1, NaN, Infinity, undefined]) {
    assert.equal(dispatchMetaPurchase({ id: 'synthetic-3', amount, metaTrackingAllowed: true },
      (...args) => calls.push(args), tracked), false);
  }
  assert.equal(dispatchMetaPurchase(null, (...args) => calls.push(args), tracked), false);
  assert.equal(dispatchMetaPurchase(undefined, (...args) => calls.push(args), tracked), false);
  assert.equal(dispatchMetaPurchase({ id: 'synthetic-3', amount: 1, metaTrackingAllowed: true }, undefined, tracked), false);
  assert.equal(calls.length, 0);
  assert.equal(tracked.size, 0);
  dispatchMetaPurchase({ id: 'synthetic-3', amount: 1, metaTrackingAllowed: true }, (...args) => calls.push(args), tracked);
  assert.equal(calls.length, 2);
});

test('a throwing third-party Pixel cannot interrupt checkout or prevent the other Pixel attempt', () => {
  const tracked = new Set<string>();
  const donation = { id: 'DON-safe-browser', amount: 1, metaTrackingAllowed: true };
  assert.equal(dispatchMetaPurchase(donation, () => { throw new Error('blocked'); }, tracked), false);
  assert.equal(tracked.size, 0);
  const calls: unknown[][] = [];
  assert.equal(dispatchMetaPurchase(donation, (...args) => {
    if (args[1] === '922745934005234') throw new Error('legacy pixel blocked');
    calls.push(args);
  }, tracked), true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][1], '1112592431188643');
});

test('checkout renders a separate optional unchecked checkbox with disclosure and privacy link', () => {
  const html = renderToStaticMarkup(React.createElement(DonationModal, {
    isOpen: true, onClose() {}, language: 'en', amount: 500, type: 'one-time',
    causeTitle: 'Synthetic contribution', want80G: true, onCompleteDonation() {},
  }));
  const checkbox = html.match(/<input\b[^>]*id="checkout-meta-tracking"[^>]*>/)?.[0];
  assert.ok(checkbox);
  assert.match(checkbox, /type="checkbox"/);
  assert.doesNotMatch(checkbox, /checked=|required=|disabled=/);
  assert.match(html, /Optional — Meta advertising measurement/);
  assert.match(html, /payment amount, hashed email and phone number, and browser identifiers/);
  assert.match(html, /Meta \(Facebook\/Instagram\)/);
  assert.match(html, /You can donate without checking this box/);
  assert.match(html, /<a href="\/privacy"/);
  assert.match(html, /Pay ₹500 via Razorpay/);
});

test('privacy disclosure distinguishes optional checkout sharing, identifiable hashes, and existing tracking', () => {
  const html = renderToStaticMarkup(React.createElement(LegalPage, { kind: 'privacy', language: 'en' }));
  assert.match(html, /Conversions API/);
  assert.match(html, /verified as captured/);
  assert.match(html, /Hashing is not anonymisation/);
  assert.match(html, /withdraw consent for future sharing/);
  assert.match(html, /info@punyakart.com/);
  assert.match(html, /not existing sitewide Meta PageView tracking/);
});


test('AddToCart sends dynamic INR value, quantity, and a stable-per-event ID to the legacy Pixel and dataLayer', () => {
  const calls: unknown[][] = [];
  const dataLayer: Array<Record<string, unknown>> = [];
  const fbq = (...args: unknown[]) => calls.push(args);

  withGlobals({
    window: { value: { location: { hostname: 'punyakart.com' }, dataLayer } },
  }, () => {
    assert.equal(dispatchMetaAddToCart({
      id: 't-green-grass',
      name: 'Fresh Green Grass for Gau Mata',
      unitPrice: 416,
      quantity: 3,
    }, fbq), true);
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], 'trackSingle');
  assert.equal(calls[0][1], legacyPixel);
  assert.equal(calls[0][2], 'AddToCart');
  assert.deepEqual(calls[0][3], {
    value: 1248,
    currency: 'INR',
    content_ids: ['t-green-grass'],
    content_type: 'product',
    content_name: 'Fresh Green Grass for Gau Mata',
    contents: [{ id: 't-green-grass', quantity: 3, item_price: 416 }],
  });
  const eventId = (calls[0][4] as { eventID: string }).eventID;
  assert.match(eventId, /^atc_[A-Za-z0-9_-]+$/);
  assert.equal(dataLayer.length, 1);
  assert.equal(dataLayer[0].event, 'add_to_cart');
  assert.equal(dataLayer[0].event_id, eventId);
  assert.deepEqual(dataLayer[0].ecommerce, {
    currency: 'INR',
    value: 1248,
    items: [{ item_id: 't-green-grass', item_name: 'Fresh Green Grass for Gau Mata', price: 416, quantity: 3 }],
  });
  assert.deepEqual(dataLayer[0].meta, {
    event_name: 'AddToCart',
    event_id: eventId,
    value: 1248,
    currency: 'INR',
    content_ids: ['t-green-grass'],
    content_type: 'product',
    content_name: 'Fresh Green Grass for Gau Mata',
    contents: [{ id: 't-green-grass', quantity: 3, item_price: 416 }],
  });
});

test('AddToCart rejects invalid cart values and does not dispatch Pixel or dataLayer events', () => {
  for (const item of [
    { id: 'x', name: 'Product', unitPrice: 0, quantity: 1 },
    { id: 'x', name: 'Product', unitPrice: 100, quantity: 0 },
    { id: 'x', name: 'Product', unitPrice: 100, quantity: 1.5 },
  ]) {
    const calls: unknown[][] = [];
    assert.equal(dispatchMetaAddToCart(item, (...args: unknown[]) => calls.push(args)), false);
    assert.equal(calls.length, 0);
  }
});

test('InitiateCheckout requires explicit consent and sends actual amount, INR, and stable event ID', () => {
  const calls: unknown[][] = [];
  const fbq = (...args: unknown[]) => calls.push(args);
  assert.equal(dispatchMetaInitiateCheckout('donation_123', 275.5, false, fbq), false);
  assert.equal(calls.length, 0);
  assert.equal(dispatchMetaInitiateCheckout('donation_123', 275.5, true, fbq), true);
  assert.deepEqual(calls[0], ['trackSingle', optInPixel, 'InitiateCheckout', { value: 275.5, currency: 'INR' }, { eventID: 'donation_123' }]);
  assert.equal(dispatchMetaInitiateCheckout('donation_123', 0, true, fbq), false);
  assert.equal(dispatchMetaInitiateCheckout('bad id', 10, true, fbq), false);
});

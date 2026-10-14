import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { DonationService, withoutClientToken } from '../backend/donationService.js';
import type { DonationRepository } from '../backend/db/DonationRepository.js';
import type { SubscriptionService } from '../backend/subscriptionService.js';
import type { StoredDonation } from '../backend/types.js';
import { createMetaConversionsServiceWithDependencies } from '../backend/metaConversions.js';
import type { MetaConversionOutbox, MetaOutboxRecord, MetaOutboxInsert } from '../backend/db/MongoMetaConversionRepository.js';
import { captureMetaAttribution, capturedPaymentSnapshot, recurringMetaAttribution, verifyCapturedDonation } from '../backend/metaPaymentTracking.js';
import { createMetaTrackingPayload, dispatchMetaPurchase } from '../frontend/src/utils/metaTracking.js';

const NOW = Date.parse('2026-10-09T12:00:00.000Z');
const SITE = 'https://punyakart.example';
const paid = { id: 'pay_Test123', amount: 20000, currency: 'INR', status: 'captured', captured: true, order_id: 'order_Test123' };
const donor = { amount: 200, type: 'one-time', fullName: 'Synthetic Donor', phone: '9876543210', email: 'donor@example.invalid', address: 'Synthetic address', panNumber: '', want80G: true, causeTitle: 'Synthetic cause', source: 'campaign_test', paymentMethod: 'razorpay' };

function fixture(consent = true, metaStatus = 200) {
  const rows = new Map<string, StoredDonation>();
  let notificationCount = 0;
  const repository = {
    initiate: async (row: Omit<StoredDonation, 'status'>) => {
      const saved = { ...structuredClone(row), status: 'initiated' as const };
      rows.set(row.id, saved);
      return structuredClone(saved);
    },
    findById: async (id: string) => structuredClone(rows.get(id) || null),
    allocateReceiptNumber: async (id: string) => rows.get(id)?.receiptNumber || 'PKF-2026-27-000001',
    updateStatus: async (id: string, status: StoredDonation['status'], updates: Partial<StoredDonation>) => {
      const existing = rows.get(id);
      if (!existing) return null;
      const saved = { ...existing, ...updates, status };
      rows.set(id, saved);
      return structuredClone(saved);
    },
    listAll: async () => [...rows.values()].map(row => structuredClone(row)),
    listEligible: async () => [...rows.values()].filter(row => row.status === 'verified').map(row => structuredClone(row)),
  } as DonationRepository;
  const subscriptions = { create: async () => undefined } as unknown as SubscriptionService;
  const donations = new DonationService(repository, subscriptions, undefined, async () => { notificationCount++; });
  const queue = new Map<string, MetaOutboxRecord>();
  const outbox: MetaConversionOutbox = {
    ensureIndexes: async () => {},
    enqueue: async (entry: MetaOutboxInsert) => {
      if (!queue.has(entry._id)) queue.set(entry._id, structuredClone({ ...entry, state: 'pending', attempts: 0, nextAttemptAt: NOW }));
    },
    retireExpired: async () => {},
    leaseNext: async (request) => {
      const row = [...queue.values()].find(row => row.state === 'pending' && row.nextAttemptAt <= request.now);
      if (!row) return null;
      Object.assign(row, { state: 'leased', leaseOwner: request.leaseOwner, leaseUntil: request.now + request.leaseMs, attempts: row.attempts + 1 });
      return structuredClone(row);
    },
    settle: async (id, owner, _now, outcome) => {
      const row = queue.get(id);
      if (!row || row.leaseOwner !== owner) return false;
      row.state = outcome.state;
      if (outcome.state === 'pending') row.nextAttemptAt = outcome.nextAttemptAt;
      return true;
    },
  };
  const posts: unknown[] = [];
  const meta = createMetaConversionsServiceWithDependencies({
    META_PIXEL_ID: '1112592431188643', META_CAPI_ACCESS_TOKEN: 'synthetic-test-only', PUBLIC_SITE_URL: SITE,
  }, {
    outbox, now: () => NOW, warn: () => {},
    fetch: async (_url, init) => { posts.push(JSON.parse(String(init.body))); return { status: metaStatus, json: async () => ({ events_received: metaStatus === 200 ? 1 : 0 }) }; },
  });
  const payload = createMetaTrackingPayload(consent, { sourceUrl: `${SITE}/campaigns/test?private=not-sent`, cookie: `_fbp=fb.1.${NOW - 10000}.123` });
  const attribution = captureMetaAttribution(payload, SITE, 'Synthetic browser', new Date(NOW - 5000));
  const verifier = { verify: (id: string, ref: string) => donations.verify(id, ref, new Date(NOW)) };
  async function initiate() {
    const row = await donations.initiate({
      ...donor, metaTrackingAllowed: true, metaAttribution: { consent: true },
      trafficAttribution: { version: 1, utmSource: 'whatsapp', utmCampaign: 'INTERNAL_TRAFFIC_ONLY', capturedAt: new Date(NOW - 5000).toISOString() },
    }, new Date(NOW - 5000), attribution);
    return donations.attachRazorpayOrder(row.id, paid.order_id);
  }
  return { donations, verifier, rows, queue, posts, meta, initiate, attribution, get notificationCount() { return notificationCount; } };
}

test('server captures only explicit consent and allowlisted attribution, with a server-owned timestamp', () => {
  const fbp = `fb.1.${NOW - 1000}.123456`;
  const result = captureMetaAttribution({ consent: true, sourceUrl: `${SITE}/donate?email=private#secret`, fbp, consentedAt: 'forged', clientIpAddress: 'forged', clientUserAgent: 'forged', user_data: { em: 'raw' } }, SITE, 'Original browser', new Date(NOW));
  assert.deepEqual(result, { consent: true, consentedAt: new Date(NOW).toISOString(), sourceUrl: `${SITE}/donate`, fbp, clientUserAgent: 'Original browser' });
  const withIp = captureMetaAttribution({ consent: true }, SITE, 'Original browser', new Date(NOW), '203.0.113.42');
  assert.equal(withIp?.clientIpAddress, '203.0.113.42');
  assert.equal(captureMetaAttribution({ consent: true, clientIpAddress: '198.51.100.10' }, SITE, 'Original browser', new Date(NOW))?.clientIpAddress, undefined);
  for (const input of [undefined, {}, { consent: false }, { consent: 'true' }, { consent: 1 }]) {
    assert.equal(captureMetaAttribution(input, SITE, 'browser', new Date(NOW)), undefined);
  }
  for (const sourceUrl of ['https://evil.example/', `https://name:secret@punyakart.example/`, 'javascript:alert(1)', `${SITE}/` + 'a'.repeat(2048)]) {
    assert.equal(captureMetaAttribution({ consent: true, sourceUrl }, SITE, '', new Date(NOW)), undefined);
  }
  assert.equal(captureMetaAttribution({ consent: true }, undefined, '', new Date(NOW)), undefined);
  const minimal = captureMetaAttribution({ consent: true, fbp: 'malformed', fbc: `fb.1.${NOW + 10000}.future` }, SITE, 'bad\nagent', new Date(NOW));
  assert.deepEqual(minimal, { consent: true, consentedAt: new Date(NOW).toISOString(), sourceUrl: `${SITE}/` });
});

test('malformed, authorised-only, wrong-currency, and fractional paise payments are not captured evidence', () => {
  assert.ok(capturedPaymentSnapshot(paid));
  for (const override of [{ status: 'authorized' }, { captured: false }, { currency: 'USD' }, { currency: undefined }, { amount: NaN }, { amount: 0 }, { amount: '100' }, { amount: 100.5 }, { id: 'admin_manual' }]) {
    assert.equal(capturedPaymentSnapshot({ ...paid, ...override }), undefined);
  }
});

test('opted-in checkout -> real donation service -> verified readback -> browser and CAPI use one event ID', async () => {
  const f = fixture();
  const initiated = await f.initiate();
  assert.equal(initiated.status, 'initiated');
  assert.equal(f.queue.size, 0);
  assert.equal(f.posts.length, 0);
  assert.deepEqual((await f.donations.findById(initiated.id))?.metaAttribution, f.attribution);
  const verified = await verifyCapturedDonation(f.verifier, f.meta, initiated, paid);
  const publicDonation = withoutClientToken(verified);
  assert.equal(publicDonation.status, 'verified');
  assert.equal(publicDonation.amount, 200);
  assert.equal(publicDonation.metaTrackingAllowed, true);
  assert.ok(!('metaAttribution' in publicDonation) && !('clientToken' in publicDonation));
  const browserCalls: unknown[][] = [];
  dispatchMetaPurchase(publicDonation, (...args) => browserCalls.push(args), new Set());
  await f.meta.flush();
  const payload = f.posts[0] as { data: { event_id: string; custom_data: object }[] };
  assert.equal(payload.data[0].event_id, verified.id);
  assert.deepEqual(browserCalls[1], ['trackSingle', '1112592431188643', 'Purchase', { value: 200, currency: 'INR' }, { eventID: verified.id }]);
  assert.deepEqual(payload.data[0].custom_data, { value: 200, currency: 'INR' });
  assert.equal(verified.trafficAttribution?.source, 'whatsapp');
  assert.doesNotMatch(JSON.stringify(f.posts), /INTERNAL_TRAFFIC_ONLY|trafficAttribution|utmSource|utmCampaign/, 'first-party traffic is not automatically shared via CAPI');
  assert.equal((await f.donations.listEligible()).reduce((sum, row) => sum + row.amount, 0), 200);
  assert.equal(f.notificationCount, 1);
  // Repeat callback/webhook delivery must not produce another receipt or conversion.
  await verifyCapturedDonation(f.verifier, f.meta, initiated, paid);
  await f.meta.flush();
  assert.equal(f.rows.size, 1);
  assert.equal(f.queue.size, 1);
  assert.equal(f.posts.length, 1);
  assert.equal(f.notificationCount, 1);
});

test('donating without opt-in still works and forged tracking flags cannot enable CAPI', async () => {
  const f = fixture(false);
  const initiated = await f.initiate();
  assert.equal(initiated.metaAttribution, undefined);
  assert.equal(initiated.metaTrackingAllowed, undefined);
  const verified = await verifyCapturedDonation(f.verifier, f.meta, initiated, paid);
  const response = withoutClientToken(verified);
  assert.equal(response.metaTrackingAllowed, false);
  const calls: unknown[][] = [];
  dispatchMetaPurchase(response, (...args) => calls.push(args), new Set());
  await f.meta.flush();
  assert.equal(f.rows.get(initiated.id)?.status, 'verified');
  assert.equal(f.queue.size, 0);
  assert.equal(f.posts.length, 0);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][1], '922745934005234');
});

test('Meta outages cannot undo payment verification or alter admin-eligible donation totals', async () => {
  const f = fixture(true, 503);
  const initiated = await f.initiate();
  const verified = await verifyCapturedDonation(f.verifier, f.meta, initiated, paid);
  await f.meta.flush();
  assert.equal(verified.status, 'verified');
  assert.equal(f.queue.values().next().value?.state, 'pending');
  const adminRows = await f.donations.listEligible();
  assert.equal(adminRows.length, 1);
  assert.equal(adminRows[0].amount, 200);
  assert.equal(adminRows[0].paymentRef, paid.id);
  assert.equal(f.notificationCount, 1);
});

test('failed/pending, wrong-amount, and unrelated orders cannot become verified donations or conversions', async () => {
  for (const overrides of [{ status: 'failed' }, { status: 'authorized' }, { amount: 200 }, { order_id: 'order_Unrelated' }, { currency: 'USD' }]) {
    const f = fixture();
    const initiated = await f.initiate();
    await assert.rejects(verifyCapturedDonation(f.verifier, f.meta, initiated, { ...paid, ...overrides }));
    assert.equal(f.rows.get(initiated.id)?.status, 'initiated');
    assert.equal(f.queue.size, 0);
    assert.equal(f.notificationCount, 0);
  }
});

test('manual/admin verification never calls CAPI, and failed/refunded donations are not exported', async () => {
  const f = fixture();
  const initiated = await f.initiate();
  await f.donations.verify(initiated.id, 'admin_manual', new Date(NOW));
  await f.meta.flush();
  assert.equal(f.queue.size, 0);
  for (const status of ['failed', 'refunded'] as const) {
    await f.meta.enqueuePurchase({ ...initiated, status, verifiedAt: new Date(NOW).toISOString(), paymentRef: paid.id }, paid);
  }
  assert.equal(f.queue.size, 0);
});

test('recurring consent does not replay stale browser attribution and one payment cannot generate two CAPI purchases', async () => {
  const f = fixture();
  const seed = await f.initiate();
  const verified = await verifyCapturedDonation(f.verifier, f.meta, seed, paid);
  const recurring = recurringMetaAttribution(f.attribution);
  assert.ok(recurring);
  assert.ok(!('fbp' in recurring) && !('fbc' in recurring) && !('clientUserAgent' in recurring));
  assert.equal(recurringMetaAttribution(undefined), undefined);
  // Even an upstream duplicate financial row cannot duplicate the same gateway charge in Meta.
  await f.meta.enqueuePurchase({ ...verified, id: 'DON-raced-row' }, paid);
  assert.equal(f.queue.size, 1);
  const newPayment = { ...paid, id: 'pay_SecondCharge' };
  await f.meta.enqueuePurchase({ ...verified, id: 'DON-next-charge', paymentRef: newPayment.id, type: 'monthly', autoPay: true, metaAttribution: recurring }, newPayment);
  await f.meta.flush();
  assert.equal(f.posts.length, 2);
  const next = f.posts[1] as { data: { event_id: string; user_data: object }[] };
  assert.equal(next.data[0].event_id, 'DON-next-charge');
  assert.ok(!('fbp' in next.data[0].user_data));
  assert.ok(!('client_user_agent' in next.data[0].user_data));
});

test('HTTP wiring retains signatures, protects diagnostics, and uses the shared payment finalizer', async () => {
  // Supplemental wiring check only; the production server is not imported because it opens real integrations.
  const source = await readFile(new URL('../server.ts', import.meta.url), 'utf8');
  assert.match(source, /app\.get\('\/api\/admin\/meta-capi\/status', adminAuth/);
  assert.match(source, /timingSafeEqualHex\(expected, String\(signature\)\)/);
  assert.match(source, /captureMetaAttribution\(/);
  assert.match(source, /donations\.initiate\(req\.body, initiatedAt, metaAttribution\)/);
  assert.ok((source.match(/await verifyCapturedDonation\(/g) || []).length >= 6);
  const adminVerify = source.slice(source.indexOf("app.post('/api/admin/donations/:id/verify'"), source.indexOf("app.post('/api/admin/donations/:id/verify'") + 900);
  assert.doesNotMatch(adminVerify, /verifyCapturedDonation|reportCapturedConversion/);
});

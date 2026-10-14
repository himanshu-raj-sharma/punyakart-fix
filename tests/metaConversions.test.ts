import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import type { Collection } from 'mongodb';
import type { StoredDonation } from '../backend/types.js';
import {
  createMetaConversionsService,
  createMetaConversionsServiceWithDependencies,
  META_DELIVERY_POLICY,
  META_PIXEL_ID,
  type MetaAttribution,
  type MetaCapturedPayment,
  type MetaConversionsDependencies,
  type MetaDiagnosticCode,
  type MetaFetchResponse,
} from '../backend/metaConversions.js';
import {
  MongoMetaConversionRepository,
  type MetaConversionOutbox,
  type MetaLeaseRequest,
  type MetaOutboxInsert,
  type MetaOutboxRecord,
  type MetaSettlement,
} from '../backend/db/MongoMetaConversionRepository.js';

const NOW = Date.parse('2026-10-09T12:00:00.000Z');
const env: NodeJS.ProcessEnv = {
  META_PIXEL_ID,
  META_CAPI_ACCESS_TOKEN: 'fake-unit-test-token',
  PUBLIC_SITE_URL: 'https://punyakart.example',
};
const payment: MetaCapturedPayment = { id: 'pay_Test123', amount: 12500, currency: 'INR', status: 'captured', captured: true };
const attribution: MetaAttribution = {
  consent: true,
  consentedAt: new Date(NOW - 60_000).toISOString(),
  sourceUrl: 'https://punyakart.example/donate?email=private%40example.com#private-fragment',
};
function donation(overrides: Partial<Omit<StoredDonation, 'metaAttribution'>> & { metaAttribution?: unknown } = {}): StoredDonation {
  return {
    id: 'DON-browser-event-123',
    amount: 125,
    type: 'one-time',
    causeTitle: 'PRIVATE_CAUSE',
    fullName: 'PRIVATE_NAME',
    email: '  DONOR@Example.COM  ',
    phone: ' +91 (98765) 43210 ',
    address: 'PRIVATE_ADDRESS',
    panNumber: 'PRIVATE_PAN',
    want80G: true,
    paymentMethod: 'razorpay',
    timestamp: new Date(NOW - 60_000).toISOString(),
    receiptNumber: 'PRIVATE_RECEIPT',
    source: 'chennai_airport',
    status: 'verified',
    verifiedAt: new Date(NOW - 1000).toISOString(),
    paymentRef: payment.id,
    dedication: { prayerMessage: 'PRIVATE_PRAYER' },
    metaAttribution: { ...attribution },
    ...overrides,
  } as StoredDonation;
}

/** Synchronous map mutations model the repository's atomic conditional writes, not a real DB. */
class InMemoryOutbox implements MetaConversionOutbox {
  records = new Map<string, MetaOutboxRecord>();
  accesses = 0;
  indexes = 0;
  failIndexes = 0;
  failEnqueue = false;
  failSettle = false;
  async ensureIndexes(): Promise<void> {
    this.accesses++;
    this.indexes++;
    if (this.failIndexes-- > 0) throw new Error('fake-unit-test-token PRIVATE_DB_RESPONSE');
  }
  async enqueue(entry: MetaOutboxInsert): Promise<void> {
    this.accesses++;
    if (this.failEnqueue) throw new Error('fake-unit-test-token PRIVATE_DB_RESPONSE');
    if (!this.records.has(entry._id)) this.records.set(entry._id, structuredClone({ ...entry, state: 'pending', attempts: 0, nextAttemptAt: entry.createdAt }));
  }
  async retireExpired(pixelId: string, now: number, maxAttempts: number): Promise<void> {
    this.accesses++;
    for (const row of this.records.values()) {
      if (row.pixelId !== pixelId || (row.state !== 'pending' && !(row.state === 'leased' && row.leaseUntil! <= now))) continue;
      if (row.expiresAt > now && row.attempts < maxAttempts) continue;
      row.state = 'dead';
      row.lastFailure = row.expiresAt <= now ? 'expired' : 'attempts_exhausted';
      delete row.leaseOwner;
      delete row.leaseUntil;
    }
  }
  async leaseNext(request: MetaLeaseRequest): Promise<MetaOutboxRecord | null> {
    this.accesses++;
    for (const row of this.records.values()) {
      if (row.pixelId !== request.pixelId || row.expiresAt <= request.now || row.nextAttemptAt > request.now || row.attempts >= request.maxAttempts) continue;
      if (row.state !== 'pending' && !(row.state === 'leased' && row.leaseUntil! <= request.now)) continue;
      row.state = 'leased';
      row.leaseOwner = request.leaseOwner;
      row.leaseUntil = request.now + request.leaseMs;
      row.attempts++;
      return structuredClone(row);
    }
    return null;
  }
  async settle(id: string, owner: string, now: number, outcome: MetaSettlement): Promise<boolean> {
    this.accesses++;
    if (this.failSettle) throw new Error('PRIVATE_ACK_FAILURE');
    const row = this.records.get(id);
    if (!row || row.state !== 'leased' || row.leaseOwner !== owner || row.leaseUntil! <= now) return false;
    row.state = outcome.state;
    if (outcome.state === 'pending') row.nextAttemptAt = outcome.nextAttemptAt;
    if (outcome.state !== 'delivered') row.lastFailure = outcome.reason;
    else delete row.lastFailure;
    delete row.leaseOwner;
    delete row.leaseUntil;
    return true;
  }
  first(): MetaOutboxRecord { return this.records.values().next().value!; }
}

function response(status = 200, body: unknown = { events_received: 1 }): MetaFetchResponse {
  return { status, json: async () => body };
}

function fixture(options: {
  env?: NodeJS.ProcessEnv;
  outbox?: InMemoryOutbox;
  clock?: { value: number };
  fetch?: MetaConversionsDependencies['fetch'];
} = {}) {
  const outbox = options.outbox ?? new InMemoryOutbox();
  const clock = options.clock ?? { value: NOW };
  const calls: { url: string; init: RequestInit }[] = [];
  const warnings: MetaDiagnosticCode[] = [];
  const timers = { schedules: 0, unrefs: 0, cancels: 0, callbacks: [] as (() => void)[] };
  const service = createMetaConversionsServiceWithDependencies(options.env ?? env, {
    outbox,
    now: () => clock.value,
    fetch: async (url, init) => {
      calls.push({ url, init });
      return options.fetch ? options.fetch(url, init) : response();
    },
    warn: code => { warnings.push(code); },
    schedule: (callback, intervalMs) => {
      assert.equal(intervalMs, META_DELIVERY_POLICY.pollMs);
      timers.schedules++;
      timers.callbacks.push(callback);
      return { unref: () => { timers.unrefs++; }, cancel: () => { timers.cancels++; } };
    },
  });
  return { service, outbox, clock, calls, warnings, timers };
}

const sha = (value: string) => createHash('sha256').update(value).digest('hex');

test('disabled configuration is explained without Mongo, network, timers, or secrets', async () => {
  const invalid: [NodeJS.ProcessEnv, string][] = [
    [{ META_PIXEL_ID: undefined }, 'missing_meta_pixel_id'],
    [{ META_PIXEL_ID: '922745934005234' }, 'unsupported_meta_pixel_id'],
    [{ META_PIXEL_ID: ` ${META_PIXEL_ID}` }, 'unsupported_meta_pixel_id'],
    [{ META_CAPI_ACCESS_TOKEN: undefined }, 'missing_meta_capi_access_token'],
    [{ META_CAPI_ACCESS_TOKEN: 'secret\nPRIVATE_RESPONSE' }, 'invalid_meta_capi_access_token'],
    [{ PUBLIC_SITE_URL: undefined }, 'invalid_public_site_url'],
    [{ PUBLIC_SITE_URL: 'http://punyakart.example' }, 'invalid_public_site_url'],
    [{ PUBLIC_SITE_URL: 'https://secret:password@punyakart.example' }, 'invalid_public_site_url'],
    [{ PUBLIC_SITE_URL: 'https://punyakart.example?secret=private' }, 'invalid_public_site_url'],
    [{ META_GRAPH_API_VERSION: '../../arbitrary' }, 'invalid_meta_graph_api_version'],
    [{ META_GRAPH_API_VERSION: 'v22.0?access_token=private' }, 'invalid_meta_graph_api_version'],
    [{ META_GRAPH_API_VERSION: '' }, 'invalid_meta_graph_api_version'],
    [{ META_CAPI_TEST_EVENT_CODE: 'TEST CODE?secret=private' }, 'invalid_meta_capi_test_event_code'],
  ];
  for (const [override, reason] of invalid) {
    const f = fixture({ env: { ...env, ...override } });
    assert.equal(f.service.enabled, false);
    await f.service.enqueuePurchase(donation(), payment);
    f.service.start()();
    await f.service.flush();
    const diagnostics = await f.service.getDiagnostics() as { disabledReasons: string[] };
    assert.ok(diagnostics.disabledReasons.includes(reason), reason);
    assert.equal(f.outbox.accesses, 0);
    assert.equal(f.calls.length, 0);
    assert.equal(f.timers.schedules, 0);
    assert.doesNotMatch(JSON.stringify(diagnostics), /private|password|secret|fake-unit-test-token/i);
  }
  const productionDisabled = createMetaConversionsService({});
  assert.equal(productionDisabled.enabled, false);
  productionDisabled.start()();
  await productionDisabled.flush();
  await productionDisabled.getDiagnostics();
});

test('Purchase uses the browser event ID, verified time, hashes, and only allowlisted data', async () => {
  const f = fixture();
  await f.service.enqueuePurchase(donation(), payment);
  assert.equal(f.outbox.indexes, 0, 'enqueue does not initialize worker indexes');
  const row = f.outbox.first();
  assert.equal(row._id, `${META_PIXEL_ID}:Purchase:pay_Test123`);
  assert.deepEqual(row.event, {
    event_name: 'Purchase',
    event_id: 'DON-browser-event-123',
    event_time: (NOW - 1000) / 1000,
    action_source: 'website',
    event_source_url: 'https://punyakart.example/donate',
    custom_data: { value: 125, currency: 'INR' },
    user_data: { em: [sha('donor@example.com')], ph: [sha('919876543210')] },
  });
  assert.doesNotMatch(JSON.stringify(row), /PRIVATE|DONOR@|98765|fake-unit-test-token|access_token|test_event_code/i);
  assert.equal(f.calls.length, 0, 'enqueue never sends');
  await f.service.flush();
  assert.equal(row.state, 'delivered');
  assert.equal(f.outbox.indexes, 1);
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0].url, `https://graph.facebook.com/v22.0/${META_PIXEL_ID}/events`);
  assert.equal(f.calls[0].init.redirect, 'error');
  assert.equal(f.calls[0].init.method, 'POST');
  assert.equal(new Headers(f.calls[0].init.headers).get('authorization'), `Bearer ${env.META_CAPI_ACCESS_TOKEN}`);
  assert.ok(f.calls[0].init.signal instanceof AbortSignal);
  assert.deepEqual(JSON.parse(f.calls[0].init.body as string), { data: [row.event] });
  assert.doesNotMatch(JSON.stringify(await f.service.getDiagnostics()), /DON-browser|fake-unit-test-token|donor@|PRIVATE/);
});

test('Indian phone variants normalize to country-code digits; invalid contacts never pass through raw', async () => {
  for (const phone of ['9876543210', '09876543210', '919876543210', '+91-98765-43210', '0091 98765 43210']) {
    const f = fixture();
    await f.service.enqueuePurchase(donation({ phone }), payment);
    assert.deepEqual(f.outbox.first().event.user_data.ph, [sha('919876543210')], phone);
  }
  const f = fixture();
  await f.service.enqueuePurchase(donation({ email: 'invalid email', phone: '+1 234 567 8901' }), payment);
  assert.equal(f.outbox.records.size, 0, 'at least one usable matching identifier is required');
  await f.service.enqueuePurchase(donation({ phone: 'not a phone' }), payment);
  assert.deepEqual(f.outbox.first().event.user_data, { em: [sha('donor@example.com')] });
});

test('optional attribution is validated and sent unchanged; test code is top-level only', async () => {
  const fbp = `fb.1.${NOW - 60_000}.123456789`;
  const fbc = `fb.1.${NOW - 60_000}.ValidClick_ID-123`;
  const clientUserAgent = 'Mozilla/5.0 (Unit Test; original agent)';
  const f = fixture({ env: { ...env, META_CAPI_TEST_EVENT_CODE: 'TEST123', META_GRAPH_API_VERSION: 'v23.0', META_CAPI_ENDPOINT: 'https://evil.example' } });
  await f.service.enqueuePurchase(donation({ metaAttribution: { ...attribution, fbp, fbc, clientUserAgent } }), payment);
  await f.service.flush();
  const body = JSON.parse(f.calls[0].init.body as string);
  assert.deepEqual(body, {
    data: [{ ...f.outbox.first().event, user_data: { em: [sha('donor@example.com')], ph: [sha('919876543210')], fbp, fbc, client_user_agent: clientUserAgent } }],
    test_event_code: 'TEST123',
  });
  assert.equal(f.calls[0].url, `https://graph.facebook.com/v23.0/${META_PIXEL_ID}/events`);
  assert.doesNotMatch(f.calls[0].url, /TEST123|token|evil/);
  assert.doesNotMatch(JSON.stringify(body), /fake-unit-test-token|access_token/);
});

test('rejects unverified/manual, unbound IDs, noncaptured payments, and inexact amount/currency', async () => {
  const invalidDonations: Partial<StoredDonation>[] = [
    ...(['initiated', 'pending_verification', 'failed', 'refunded'] as const).map(status => ({ status })),
    { source: 'manual' }, { source: undefined }, { source: 'MANUAL' },
    { paymentMethod: 'cash' }, { paymentMethod: 'upi' },
    { paymentRef: 'pay_Other' }, { paymentRef: undefined },
    { id: '' }, { id: 'bad/id' }, { id: 'x'.repeat(129) },
    { amount: 124 }, { amount: NaN }, { amount: 125.001 }, { amount: -125 },
    { verifiedAt: undefined }, { verifiedAt: 'not a date' }, { verifiedAt: '2026-02-30T00:00:00Z' },
    { verifiedAt: new Date(NOW + 1).toISOString() },
    { verifiedAt: new Date(NOW - META_DELIVERY_POLICY.maxAgeMs).toISOString() },
    { verifiedAt: new Date(NOW - META_DELIVERY_POLICY.maxAgeMs + META_DELIVERY_POLICY.expirySafetyMs).toISOString() },
  ];
  for (const invalid of invalidDonations) {
    const f = fixture();
    await f.service.enqueuePurchase(donation(invalid), payment);
    assert.equal(f.outbox.records.size, 0, JSON.stringify(invalid));
  }
  const invalidPayments: Partial<MetaCapturedPayment>[] = [
    { status: 'authorized' }, { status: 'pending' }, { status: 'failed' }, { status: 'refunded' },
    { captured: false }, { captured: 'true' as unknown as boolean },
    { amount: 12501 }, { amount: 12500.1 }, { amount: NaN }, { amount: Number.MAX_SAFE_INTEGER + 1 },
    { amount: 0 }, { currency: 'USD' }, { currency: 'inr' },
    { id: '' }, { id: 'bad/id' }, { id: 'pay_$$$$' }, { id: 'pay_Other' },
  ];
  for (const invalid of invalidPayments) {
    const f = fixture();
    await f.service.enqueuePurchase(donation(), { ...payment, ...invalid });
    assert.equal(f.outbox.records.size, 0, JSON.stringify(invalid));
  }
  const f = fixture();
  const { captured: _ignored, ...statusOnly } = payment;
  await f.service.enqueuePurchase(donation(), statusOnly);
  assert.equal(f.outbox.records.size, 1, 'captured status is authoritative when optional captured flag is absent');
});

test('malformed or missing consent/source/cookie/agent fails closed', async () => {
  const invalid: unknown[] = [
    undefined, null, [], {}, { ...attribution, consent: false }, { ...attribution, consent: 'true' },
    { ...attribution, consentedAt: undefined }, { ...attribution, consentedAt: '2026-02-30T00:00:00Z' },
    { ...attribution, consentedAt: new Date(NOW).toISOString() },
    ...['http://punyakart.example/donate', 'https://evil.example/donate', 'https://sub.punyakart.example',
      'https://punyakart.example:8443', 'https://name:secret@punyakart.example', '//punyakart.example',
      ' https://punyakart.example', 'https://punyakart.example\\evil', 'https://punyakart.example/\n'].map(sourceUrl => ({ ...attribution, sourceUrl })),
    { ...attribution, fbp: 'hashed-cookie' }, { ...attribution, fbp: '' },
    { ...attribution, fbc: `fb.1.${NOW}.bad click id` },
    { ...attribution, fbc: `fb.1.${NOW + 1000}.future` },
    { ...attribution, clientUserAgent: 'a'.repeat(513) },
    { ...attribution, clientUserAgent: 'agent\nprivate' }, { ...attribution, clientUserAgent: 12 },
  ];
  for (const metaAttribution of invalid) {
    const f = fixture();
    await f.service.enqueuePurchase(donation({ metaAttribution }), payment);
    assert.equal(f.outbox.records.size, 0, JSON.stringify(metaAttribution));
    assert.equal(f.outbox.accesses, 0);
  }
});

test('duplicates preserve the original payload, verification time, and test/live choice across restarts', async () => {
  for (const originalTestCode of [undefined, 'ORIGINAL_TEST']) {
    const outbox = new InMemoryOutbox();
    const original = fixture({ outbox, env: { ...env, META_CAPI_TEST_EVENT_CODE: originalTestCode } });
    const originalDonation = donation();
    await Promise.all(Array.from({ length: 12 }, () => original.service.enqueuePurchase(originalDonation, payment)));
    const immutable = structuredClone(outbox.first());
    const restarted = fixture({ outbox, env: { ...env, META_CAPI_TEST_EVENT_CODE: originalTestCode ? undefined : 'NEW_TEST' } });
    await restarted.service.enqueuePurchase(donation({ verifiedAt: new Date(NOW).toISOString(), email: 'changed@example.com' }), payment);
    assert.equal(outbox.records.size, 1);
    assert.deepEqual(outbox.first(), immutable);
    await restarted.service.flush();
    const body = JSON.parse(restarted.calls[0].init.body as string);
    assert.equal(body.test_event_code, originalTestCode);
    assert.deepEqual(body.data[0], immutable.event);
    await original.service.enqueuePurchase(originalDonation, payment);
    await Promise.all([original.service.flush(), restarted.service.flush()]);
    assert.equal(original.calls.length, 0);
    assert.equal(restarted.calls.length, 1, 'mode changes cannot resurrect an acknowledged event');
  }
});

test('concurrent workers and overlapping flushes share one atomic lease', async () => {
  const outbox = new InMemoryOutbox();
  let release!: (value: MetaFetchResponse) => void;
  let started!: () => void;
  const began = new Promise<void>(resolve => { started = resolve; });
  const a = fixture({ outbox, fetch: async () => {
    started();
    return new Promise(resolve => { release = resolve; });
  } });
  const b = fixture({ outbox });
  await a.service.enqueuePurchase(donation(), payment);
  const work = a.service.flush();
  assert.equal(a.service.flush(), work);
  await began;
  await b.service.flush();
  assert.equal(b.calls.length, 0);
  release(response());
  await work;
  assert.equal(a.calls.length, 1);
  assert.equal(outbox.first().state, 'delivered');
  assert.equal(outbox.first().attempts, 1);
});

test('expired leases recover after restart, and a stale owner cannot acknowledge or reschedule them', async () => {
  const f = fixture();
  await f.service.enqueuePurchase(donation(), payment);
  const request: MetaLeaseRequest = { pixelId: META_PIXEL_ID, now: NOW, leaseOwner: 'crashed-worker', leaseMs: META_DELIVERY_POLICY.leaseMs, maxAttempts: META_DELIVERY_POLICY.maxAttempts };
  const old = await f.outbox.leaseNext(request);
  assert.ok(old);
  await f.service.flush();
  assert.equal(f.calls.length, 0);
  f.clock.value += META_DELIVERY_POLICY.leaseMs;
  const recovered = await f.outbox.leaseNext({ ...request, now: f.clock.value, leaseOwner: 'replacement-worker' });
  assert.equal(recovered?.attempts, 2);
  assert.equal(await f.outbox.settle(old._id, 'crashed-worker', f.clock.value, { state: 'delivered' }), false);
  assert.equal(await f.outbox.settle(old._id, 'crashed-worker', f.clock.value, { state: 'pending', reason: 'network_or_timeout', nextAttemptAt: NOW }), false);
  assert.equal(f.outbox.first().leaseOwner, 'replacement-worker');
  f.clock.value += META_DELIVERY_POLICY.leaseMs;
  const restarted = fixture({ outbox: f.outbox, clock: f.clock });
  await restarted.service.flush();
  assert.equal(restarted.calls.length, 1);
  assert.equal(f.outbox.first().state, 'delivered');
  assert.deepEqual(JSON.parse(restarted.calls[0].init.body as string).data[0], old.event);
});

test('transient delivery has bounded exponential backoff, attempt limits, and unchanged ID/time/test code', async () => {
  const f = fixture({ env: { ...env, META_CAPI_TEST_EVENT_CODE: 'TEST_RETRY' }, fetch: async () => response(503, { error: { message: 'PRIVATE_META_RESPONSE' } }) });
  await f.service.enqueuePurchase(donation(), payment);
  const original = structuredClone(f.outbox.first().event);
  for (let attempt = 1; attempt <= META_DELIVERY_POLICY.maxAttempts; attempt++) {
    const before = f.clock.value;
    await f.service.flush();
    const row = f.outbox.first();
    assert.equal(row.attempts, attempt);
    assert.equal(f.calls.length, attempt);
    assert.deepEqual(JSON.parse(f.calls[attempt - 1].init.body as string), { data: [original], test_event_code: 'TEST_RETRY' });
    if (attempt < META_DELIVERY_POLICY.maxAttempts) {
      assert.equal(row.state, 'pending');
      const delay = Math.min(META_DELIVERY_POLICY.maxRetryMs, META_DELIVERY_POLICY.baseRetryMs * 2 ** (attempt - 1));
      assert.equal(row.nextAttemptAt, before + delay);
      f.clock.value = row.nextAttemptAt - 1;
      await f.service.flush();
      assert.equal(f.calls.length, attempt, 'not due until backoff passes');
      f.clock.value++;
    }
  }
  assert.equal(f.outbox.first().state, 'dead');
  assert.equal(f.outbox.first().lastFailure, 'attempts_exhausted');
  f.clock.value += 24 * 60 * 60 * 1000;
  await f.service.flush();
  await f.service.enqueuePurchase(donation(), payment);
  assert.equal(f.calls.length, META_DELIVERY_POLICY.maxAttempts);
  assert.equal(f.outbox.first().state, 'dead');
  assert.doesNotMatch(JSON.stringify([f.warnings, await f.service.getDiagnostics(), [...f.outbox.records.values()]]), /PRIVATE_META_RESPONSE|fake-unit-test-token/);
});

test('events expire before seven days; retries and crashed last attempts cannot bypass limits', async () => {
  const f = fixture();
  await f.service.enqueuePurchase(donation(), payment);
  f.clock.value = f.outbox.first().expiresAt;
  await f.service.flush();
  assert.equal(f.calls.length, 0);
  assert.equal(f.outbox.first().lastFailure, 'expired');

  const retry = fixture({ fetch: async () => response(429) });
  await retry.service.enqueuePurchase(donation(), payment);
  retry.clock.value = retry.outbox.first().expiresAt - 1;
  await retry.service.flush();
  assert.equal(retry.outbox.first().state, 'dead');
  assert.equal(retry.outbox.first().lastFailure, 'expired');

  const crashed = fixture();
  await crashed.service.enqueuePurchase(donation(), payment);
  const row = crashed.outbox.first();
  row.state = 'leased';
  row.attempts = META_DELIVERY_POLICY.maxAttempts;
  row.leaseOwner = 'crashed';
  row.leaseUntil = NOW;
  await crashed.service.flush();
  assert.equal(crashed.calls.length, 0);
  assert.equal(row.lastFailure, 'attempts_exhausted');
});

test('only an acknowledged 2xx succeeds; transient Meta/network failures retry and permanent rejections stop', async () => {
  const cases: [number, unknown, 'delivered' | 'pending' | 'dead'][] = [
    [200, { events_received: 1 }, 'delivered'],
    [201, { events_received: 2 }, 'delivered'],
    [200, { events_received: 0 }, 'dead'],
    [200, { events_received: '1' }, 'dead'],
    [200, { events_received: 1, error: { code: 190, message: 'PRIVATE_RESPONSE' } }, 'dead'],
    [200, { error: { code: 4 } }, 'pending'],
    [400, { error: { is_transient: true } }, 'pending'],
    [400, { error: { code: 100 } }, 'dead'],
    [401, { error: { code: 190 } }, 'dead'],
    [403, {}, 'dead'], [404, {}, 'dead'], [302, {}, 'dead'],
    [408, {}, 'pending'], [429, {}, 'pending'], [500, {}, 'pending'],
    [204, undefined, 'dead'], [200, [], 'dead'],
  ];
  for (const [status, body, expected] of cases) {
    const f = fixture({ fetch: async () => ({ status, json: async () => body }) });
    await f.service.enqueuePurchase(donation(), payment);
    await f.service.flush();
    assert.equal(f.outbox.first().state, expected, `${status} ${JSON.stringify(body)}`);
    assert.doesNotMatch(JSON.stringify([f.warnings, await f.service.getDiagnostics()]), /PRIVATE_RESPONSE/);
  }
  for (const status of [200, 503]) {
    const malformed = fixture({ fetch: async () => ({ status, json: async () => { throw new SyntaxError('PRIVATE_JSON'); } }) });
    await malformed.service.enqueuePurchase(donation(), payment);
    await malformed.service.flush();
    assert.equal(malformed.outbox.first().state, status === 503 ? 'pending' : 'dead');
  }
  const network = fixture({ fetch: async () => { throw new Error('fake-unit-test-token PRIVATE_NETWORK_ERROR'); } });
  await network.service.enqueuePurchase(donation(), payment);
  await network.service.flush();
  assert.equal(network.outbox.first().lastFailure, 'network_or_timeout');
  assert.equal(network.outbox.first().state, 'pending');
  assert.doesNotMatch(JSON.stringify([network.warnings, await network.service.getDiagnostics()]), /PRIVATE_NETWORK|fake-unit-test-token/);
});

test('request timeout aborts and bounds even a fetch that ignores its signal', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const f = fixture({ fetch: async () => new Promise<MetaFetchResponse>(() => {}) });
  await f.service.enqueuePurchase(donation(), payment);
  const pending = f.service.flush();
  for (let i = 0; i < 20 && !f.calls.length; i++) await Promise.resolve();
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0].init.signal?.aborted, false);
  t.mock.timers.tick(META_DELIVERY_POLICY.requestTimeoutMs);
  await pending;
  assert.equal(f.calls[0].init.signal?.aborted, true);
  assert.equal(f.outbox.first().lastFailure, 'network_or_timeout');
  assert.equal(f.outbox.first().state, 'pending');
});

test('worker is explicit, unrefed, idempotent, stoppable, and retries failed index setup', async () => {
  const f = fixture();
  f.outbox.failIndexes = 1;
  assert.equal(f.timers.schedules, 0);
  assert.equal(f.outbox.accesses, 0);
  const stop = f.service.start();
  assert.equal(stop, f.service.start());
  await f.service.flush();
  assert.equal(f.outbox.indexes, 1);
  assert.equal(f.timers.unrefs, 1);
  assert.equal(f.timers.schedules, 1);
  assert.deepEqual(f.warnings, ['index_setup_failed']);
  await f.service.flush();
  assert.equal(f.outbox.indexes, 2);
  await f.service.flush();
  assert.equal(f.outbox.indexes, 2);
  stop();
  stop();
  assert.equal(f.timers.cancels, 1);
  const stopAgain = f.service.start();
  stop();
  assert.equal(f.timers.cancels, 1, 'stale stop handles cannot stop a restarted worker');
  stopAgain();
  assert.equal(f.timers.cancels, 2);
  await f.service.flush();
});

test('outbox errors never escape enqueue/flush; failed acknowledgements recover with stable payload', async () => {
  const f = fixture();
  f.outbox.failEnqueue = true;
  await assert.doesNotReject(f.service.enqueuePurchase(donation(), payment));
  assert.deepEqual(f.warnings, ['enqueue_failed']);
  f.outbox.failEnqueue = false;
  await f.service.enqueuePurchase(donation(), payment);
  f.outbox.failSettle = true;
  await assert.doesNotReject(f.service.flush());
  assert.equal(f.outbox.first().state, 'leased');
  f.outbox.failSettle = false;
  f.clock.value += META_DELIVERY_POLICY.leaseMs;
  await f.service.flush();
  assert.equal(f.outbox.first().state, 'delivered');
  assert.equal(f.calls.length, 2);
  assert.equal(f.calls[0].init.body, f.calls[1].init.body, 'at-least-once recovery relies on the same Meta deduplication ID/time');
  assert.doesNotMatch(JSON.stringify([f.warnings, await f.service.getDiagnostics()]), /PRIVATE|fake-unit-test-token/);
  const throwsDuringWarning = createMetaConversionsServiceWithDependencies(env, {
    outbox: { ...f.outbox, enqueue: async () => { throw new Error('private'); } } as unknown as MetaConversionOutbox,
    fetch: async () => response(), now: () => NOW, warn: () => { throw new Error('logger failure'); },
  });
  await assert.doesNotReject(throwsDuringWarning.enqueuePurchase(donation(), payment));
});

test('each flush is bounded and isolates other pixels', async () => {
  const f = fixture();
  for (let i = 0; i < META_DELIVERY_POLICY.batchSize + 1; i++) {
    const paid = { ...payment, id: `pay_Test${i}` };
    await f.service.enqueuePurchase(donation({ id: `DON-${i}`, paymentRef: paid.id }), paid);
  }
  const foreign = structuredClone(f.outbox.first());
  foreign._id = 'other-pixel:Purchase:DON-foreign';
  foreign.pixelId = '922745934005234';
  f.outbox.records.set(foreign._id, foreign);
  await f.service.flush();
  assert.equal(f.calls.length, META_DELIVERY_POLICY.batchSize);
  assert.equal(foreign.state, 'pending');
  await f.service.flush();
  assert.equal(f.calls.length, META_DELIVERY_POLICY.batchSize + 1);
  assert.equal(foreign.state, 'pending');
});

test('Mongo adapter uses immutable majority upserts, unique identity, and conditional ownership writes', async () => {
  const calls: { method: string; args: unknown[] }[] = [];
  let duplicate = false;
  let unavailable = false;
  const collection = {
    createIndex: async (...args: unknown[]) => { calls.push({ method: 'createIndex', args }); return 'index'; },
    updateOne: async (...args: unknown[]) => {
      calls.push({ method: 'updateOne', args });
      if (unavailable) throw new Error('PRIVATE_MONGO_ERROR');
      if (duplicate) throw { code: 11000, message: 'PRIVATE_DUPLICATE_ERROR' };
      return { modifiedCount: 1 };
    },
    updateMany: async (...args: unknown[]) => { calls.push({ method: 'updateMany', args }); return { modifiedCount: 1 }; },
    findOneAndUpdate: async (...args: unknown[]) => { calls.push({ method: 'findOneAndUpdate', args }); return null; },
  };
  let connections = 0;
  const repository = new MongoMetaConversionRepository(async () => { connections++; return collection as unknown as Collection<MetaOutboxRecord>; });
  assert.equal(connections, 0, 'construction is lazy');
  await repository.ensureIndexes();
  assert.deepEqual(calls[0], {
    method: 'createIndex', args: [{ pixelId: 1, 'event.event_name': 1, 'event.event_id': 1 }, { unique: true, name: 'meta_purchase_identity' }],
  });
  assert.equal(calls.filter(call => JSON.stringify(call).includes('expireAfterSeconds')).length, 0, 'deduplication keys never expire');
  const f = fixture();
  await f.service.enqueuePurchase(donation(), payment);
  const entry = f.outbox.first();
  await repository.enqueue(entry);
  const insertion = calls.at(-1)!;
  assert.deepEqual(insertion.args[0], { _id: entry._id });
  assert.deepEqual(Object.keys(insertion.args[1] as object), ['$setOnInsert']);
  assert.deepEqual(insertion.args[2], { upsert: true, writeConcern: { w: 'majority' } });
  duplicate = true;
  await assert.doesNotReject(repository.enqueue(entry));
  duplicate = false;
  unavailable = true;
  await assert.rejects(repository.enqueue(entry));
  unavailable = false;

  await repository.leaseNext({ pixelId: META_PIXEL_ID, now: NOW, leaseOwner: 'owner-1', leaseMs: 60_000, maxAttempts: 8 });
  const lease = calls.at(-1)!;
  assert.deepEqual(lease.args[0], {
    pixelId: META_PIXEL_ID, expiresAt: { $gt: NOW }, nextAttemptAt: { $lte: NOW }, attempts: { $lt: 8 },
    $or: [{ state: 'pending' }, { state: 'leased', leaseUntil: { $lte: NOW } }],
  });
  assert.deepEqual(lease.args[1], { $set: { state: 'leased', leaseOwner: 'owner-1', leaseUntil: NOW + 60_000 }, $inc: { attempts: 1 } });
  assert.equal((lease.args[2] as { returnDocument: string }).returnDocument, 'after');
  assert.equal(await repository.settle(entry._id, 'owner-1', NOW + 1, { state: 'delivered' }), true);
  const acknowledgement = calls.at(-1)!;
  assert.deepEqual(acknowledgement.args[0], { _id: entry._id, state: 'leased', leaseOwner: 'owner-1', leaseUntil: { $gt: NOW + 1 } });
  assert.deepEqual(acknowledgement.args[2], { writeConcern: { w: 'majority' } });
  await repository.retireExpired(META_PIXEL_ID, NOW, 8);
  for (const call of calls.slice(-2)) {
    const filter = call.args[0] as { pixelId: string; $or: unknown[] };
    assert.equal(filter.pixelId, META_PIXEL_ID);
    assert.deepEqual(filter.$or, [{ state: 'pending' }, { state: 'leased', leaseUntil: { $lte: NOW } }], 'active leases are never retired by a competing worker');
  }
});

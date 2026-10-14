import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { DonationService, filterDonationsBySource } from '../backend/donationService.js';
import { SubscriptionService } from '../backend/subscriptionService.js';
import { MongoDonationRepository } from '../backend/db/MongoDonationRepository.js';
import { MongoCampaignRepository } from '../backend/db/MongoCampaignRepository.js';
import type { DonationRepository } from '../backend/db/DonationRepository.js';
import type { StoredDonation } from '../backend/types.js';
import { validateDonationPayload } from '../backend/validation/donationSchema.js';
import { validateActiveCampaignDonation } from '../backend/campaignDonationGuard.js';
import { attributedCampaignId, campaignAttributionExpression } from '../backend/campaignAttribution.js';
import { toPublicRecentDonation } from '../backend/publicRecentDonation.js';
import { toAdminDonation } from '../backend/adminDonation.js';
import { recurringDonationId } from '../backend/recurringDonationIdentity.js';
import { shouldSeedInitialSubscriptions } from '../backend/index.js';

// Synthetic repositories/transport only. Never import server.ts or connect Mongo.
const input = {
  amount: 200, type: 'one-time', causeTitle: 'Synthetic campaign', source: 'campaign_c2',
  fullName: 'Synthetic Test Donor', email: 'donor@example.invalid', phone: '9876543210',
  address: 'Synthetic address', paymentMethod: 'razorpay', want80G: true,
};
function row(patch: Partial<StoredDonation> = {}): StoredDonation {
  return { ...input, amount: 100, type: 'one-time', paymentMethod: 'razorpay', panNumber: '',
    id: 'DON-test', timestamp: '2026-01-01T00:00:00.000Z', receiptNumber: '',
    transactionId: 'TXN-test', terminal: 'Campaign Portal', status: 'verified', ...patch };
}

// A deliberately small in-memory Mongo-expression interpreter. It checks the
// actual adapter pipeline against fixtures without executing any DB operations.
function expression(value: any, record: any, variables: Record<string, any> = {}): any {
  if (typeof value === 'string') {
    if (value.startsWith('$$')) return variables[value.slice(2)];
    if (value.startsWith('$')) return record[value.slice(1)];
    return value;
  }
  if (Array.isArray(value)) return value.map(item => expression(item, record, variables));
  if (value === null || typeof value !== 'object') return value;
  const evaluate = (item: any) => expression(item, record, variables);
  const [operator, argument] = Object.entries(value)[0] as [string, any];
  switch (operator) {
    case '$literal': return argument;
    case '$convert': { const result = evaluate(argument.input); return result == null ? argument.onNull : String(result); }
    case '$trim': return evaluate(argument.input).trim();
    case '$toLower': return evaluate(argument).toLowerCase();
    case '$let': return expression(argument.in, record, { ...variables,
      ...Object.fromEntries(Object.entries(argument.vars).map(([key, item]) => [key, evaluate(item)])),
    });
    case '$switch': {
      for (const branch of argument.branches) if (evaluate(branch.case)) return evaluate(branch.then);
      return evaluate(argument.default);
    }
    case '$eq': { const [a, b] = evaluate(argument); return a === b; }
    case '$ne': { const [a, b] = evaluate(argument); return a !== b; }
    case '$in': { const [item, items] = evaluate(argument); return items.includes(item); }
    case '$and': return argument.every((item: any) => evaluate(item));
    case '$regexMatch': return new RegExp(argument.regex).test(evaluate(argument.input));
    case '$strLenCP': return Array.from(evaluate(argument)).length;
    case '$substrCP': { const [text, start, length] = evaluate(argument); return Array.from(text).slice(start, start + length).join(''); }
    case '$cond': return evaluate(argument[0]) ? evaluate(argument[1]) : evaluate(argument[2]);
    case '$ifNull': { const [a, b] = evaluate(argument); return a ?? b; }
    default: throw new Error(`Unsupported fake Mongo operator: ${operator}`);
  }
}

function matches(record: any, filter: any): boolean {
  return Object.entries(filter).every(([key, value]: [string, any]) => {
    if (key === '$expr') return expression(value, record);
    if (key === '$or') return value.some((item: any) => matches(record, item));
    if (value && typeof value === 'object' && '$exists' in value) return (record[key] !== undefined) === value.$exists;
    return value && typeof value === 'object' && '$in' in value ? value.$in.includes(record[key]) : record[key] === value;
  });
}

function mongoFixture(initial: StoredDonation[]) {
  let records: any[] = initial.map(item => ({ ...structuredClone(item), _id: item.id }));
  const pipelines: any[][] = [];
  let race: ((record: any) => void) | undefined;
  let receiptSequence = 0;
  const collection = {
    async insertOne(record: any) {
      if (records.some(item => item._id === record._id)) throw Object.assign(new Error('Synthetic duplicate _id'), { code: 11000 });
      records.push(structuredClone(record));
      return { insertedId: record._id };
    },
    find(filter: any) {
      let results = records.filter(item => matches(item, filter)).map(item => structuredClone(item));
      return { sort() { return this; }, async toArray() { return results; } };
    },
    aggregate(pipeline: any[]) {
      pipelines.push(pipeline);
      let results = structuredClone(records);
      for (const stage of pipeline) {
        if (stage.$match) results = results.filter(item => matches(item, stage.$match));
        else if (stage.$addFields) results = results.map(item => ({ ...item,
          ...Object.fromEntries(Object.entries(stage.$addFields).map(([key, value]) => [key, expression(value, item)])),
        }));
        else if (stage.$sort) results.sort((a, b) => {
          for (const [key, direction] of Object.entries(stage.$sort) as [string, number][]) {
            if (a[key] !== b[key]) return (a[key] > b[key] ? 1 : -1) * direction;
          }
          return 0;
        });
        else if (stage.$limit) results = results.slice(0, stage.$limit);
        else if (stage.$project) results = results.map(item => {
          for (const key of Object.keys(stage.$project)) delete item[key];
          return item;
        });
        else throw new Error('Unexpected stage');
      }
      return { async toArray() { return results; } };
    },
    async findOne(filter: any) { return structuredClone(records.find(item => matches(item, filter)) || null); },
    async findOneAndUpdate(filter: any, update: any, options?: any) {
      if (race) { const callback = race; race = undefined; callback(records[0]); }
      const record = records.find(item => matches(item, filter));
      if (!record) {
        if (!options?.upsert) return null;
        const inserted = structuredClone(update.$setOnInsert);
        await collection.insertOne(inserted);
        return inserted;
      }
      if (update.$set) Object.assign(record, update.$set);
      return structuredClone(record);
    },
  };
  const makeRepository = () => {
    const repository = new MongoDonationRepository();
    Object.assign(repository, {
      getCollection: async () => collection,
      reserveNextReceiptNumber: async () => `PKF-2026-27-${String(++receiptSequence).padStart(6, '0')}`,
    });
    return repository;
  };
  return { repository: makeRepository(), makeRepository, pipelines, get: () => records[0], all: () => records,
    receiptSequence: () => receiptSequence, race: (callback: (record: any) => void) => { race = callback; } };
}

test('recent adapter filters campaign before limit, retaining a donor behind more than 100 unrelated gifts', async () => {
  const target = row({ id: 'older-target', source: 'campaign_second' });
  const others = Array.from({ length: 150 }, (_, index) => row({ id: `other-${index}`, source: 'campaign_c3', timestamp: '2026-02-01T00:00:00.000Z' }));
  const fixture = mongoFixture([target, ...others]);
  const service = new DonationService(fixture.repository, {} as SubscriptionService);
  assert.deepEqual((await service.listRecent(1, 'campaign_c2')).map(item => item.id), ['older-target']);
  assert.ok(fixture.pipelines[0][0].$match.$expr, 'source filtering happens in the first match');
  assert.ok(fixture.pipelines[0].findIndex(stage => stage.$match) < fixture.pipelines[0].findIndex(stage => stage.$limit));
});

test('recent uses verification time with historical timestamp fallback, excludes unpaid/refunded, and has stable ties', async () => {
  const fixture = mongoFixture([
    row({ id: 'verified-last', verifiedAt: '2026-03-01T00:00:00.000Z' }),
    row({ id: 'historical', amount: 1, status: 'completed' as StoredDonation['status'], timestamp: '2026-02-01T00:00:00.000Z' }),
    row({ id: 'empty-verification', verifiedAt: '', timestamp: '2026-01-15T00:00:00.000Z' }),
    row({ id: 'failed', status: 'failed', timestamp: '2026-04-01T00:00:00.000Z' }),
    row({ id: 'refunded', status: 'refunded' }), row({ id: 'pending', status: 'pending_verification' }),
  ]);
  assert.deepEqual((await fixture.repository.listRecent(10, 'campaign_c2')).map(item => item.id),
    ['verified-last', 'historical', 'empty-verification']);
});

test('shared attribution honors immutable ID, canonical known aliases, and narrow title compatibility without double matching', async () => {
  const title = 'This Tuesday, Turn Your Faith Into Seva';
  const cases: [Partial<StoredDonation>, string | undefined][] = [
    [{ campaignId: 'c2', source: 'campaign_c3', causeTitle: title }, 'c2'],
    [{ source: 'campaign_second', causeTitle: title }, 'c2'],
    [{ source: ' campaign_ second ', causeTitle: title }, 'c2'],
    [{ source: 'campaign_custom', causeTitle: title }, 'custom'],
    [{ source: 'campaign_c3', causeTitle: 'Edited title' }, 'c3'],
    [{ source: undefined, causeTitle: ` ${title.toUpperCase()} ` }, 'c3'],
    [{ source: 'crowd_funding', causeTitle: title }, 'c3'],
    [{ source: 'chennai_airport', causeTitle: title }, undefined],
    [{ source: 'manual', causeTitle: title }, undefined],
    [{ source: 'unrelated', causeTitle: title }, undefined],
    [{ source: undefined, causeTitle: 'An unrelated CMS title' }, undefined],
    [{ source: undefined, causeTitle: '__proto__' }, undefined],
  ];
  for (const [patch, expected] of cases) {
    const donation = row(patch);
    assert.equal(attributedCampaignId(donation), expected);
    assert.equal(expression(campaignAttributionExpression(), donation), expected || '');
    const fixture = mongoFixture([donation]);
    for (const id of ['c2', 'c3', 'custom']) {
      assert.equal((await fixture.repository.listRecent(10, `campaign_${id}`)).length, expected === id ? 1 : 0);
      assert.equal(filterDonationsBySource([donation], `campaign_${id}`).length, expected === id ? 1 : 0);
    }
  }
  for (const [alias, id] of [['detail', 'c1'], ['second', 'c2'], ['tuesday', 'c3'], ['gau-seva', 'c4'], ['thursday-gau-seva', 'c5'], ['birthday', 'c6']]) {
    assert.equal(attributedCampaignId({ source: `campaign_${alias}` }), id);
  }
});

test('campaign stats adapter uses the same attribution expression and cannot match copied or unrelated titles', async () => {
  let pipeline: any[] = [];
  const campaigns = { aggregate(stages: any[]) { pipeline = stages; return { async toArray() { return []; } }; } };
  // Bypass eager constructor: this test must never request a DB connection.
  const repository = Object.create(MongoCampaignRepository.prototype) as MongoCampaignRepository;
  Object.assign(repository, { getCollections: async () => ({ campaigns }), indexesReady: Promise.resolve() });
  await repository.listWithStats(true);
  const lookup = pipeline.find(stage => stage.$lookup).$lookup;
  const matcher = lookup.pipeline.find((stage: any) => stage.$match?.$expr).$match.$expr;
  assert.deepEqual(matcher.$eq[0], campaignAttributionExpression());
  const donation = row({ source: 'campaign_second', causeTitle: 'This Tuesday, Turn Your Faith Into Seva' });
  assert.equal(expression(matcher, donation, { campaignId: 'c2' }), true);
  assert.equal(expression(matcher, donation, { campaignId: 'c3' }), false);
});

test('initiation canonicalizes aliases, derives stable IDs, rejects conflicts and enforces the uniform minimum', async () => {
  const saved: StoredDonation[] = [];
  const repository = { async initiate(value: Omit<StoredDonation, 'status'>) {
    const donation = { ...value, status: 'initiated' as const }; saved.push(donation); return donation;
  } } as DonationRepository;
  const service = new DonationService(repository, {} as SubscriptionService);
  const alias = await service.initiate({ ...input, source: 'campaign_second', campaignId: 'c2' });
  assert.equal(alias.source, 'campaign_c2'); assert.equal(alias.campaignId, 'c2');
  assert.equal((await service.initiate(input)).campaignId, 'c2');
  assert.equal((await service.initiate({ ...input, source: undefined, campaignId: 'c2' })).source, 'campaign_c2');
  for (const source of ['campaign_c3', 'chennai_airport', 'crowd_funding']) {
    await assert.rejects(service.initiate({ ...input, amount: 500, source, campaignId: 'c2' }), /Validation failed/);
  }
  for (const source of ['campaign_c2', 'crowd_funding', 'chennai_airport']) {
    assert.equal(validateDonationPayload({ ...input, source, amount: 200 }).amount, 200);
    assert.throws(() => validateDonationPayload({ ...input, source, amount: 199 }));
  }
  assert.equal(validateDonationPayload({ ...input, source: 'chennai_airport', amount: 499 }).amount, 499);
  assert.equal(validateDonationPayload({ ...input, source: 'chennai_airport', amount: 500 }).amount, 500);
  assert.equal(saved.length, 3, 'conflicting requests never reach persistence');
  await assert.rejects(service.initiate({ ...input, source: `campaign_${'a'.repeat(101)}` }));
});

test('server campaign guard reads authoritative active state before initiating and keeps Chennai/crowd flows', async () => {
  const calls: string[] = [];
  const lookup = { async findById(id: string) { calls.push(id); return id === 'c2' ? { id, title: 'Authoritative CMS title', is_active: true } : null; } };
  const valid = await validateActiveCampaignDonation({ ...input, is_active: false }, lookup);
  assert.equal(valid.causeTitle, 'Authoritative CMS title'); assert.equal(valid.campaignId, 'c2');
  await assert.rejects(validateActiveCampaignDonation({ ...input, source: 'campaign_missing', is_active: true }, lookup));
  await assert.rejects(validateActiveCampaignDonation(input, { async findById(id) { return { id, title: 'Inactive', is_active: false }; } }));
  for (const source of ['crowd_funding', 'chennai_airport']) {
    const before = calls.length;
    assert.equal((await validateActiveCampaignDonation({ ...input, amount: 500, source }, lookup)).source, source);
    assert.equal(calls.length, before);
  }
  const server = await readFile(new URL('../server.ts', import.meta.url), 'utf8');
  assert.ok(server.indexOf('await validateActiveCampaignDonation(req.body, campaignRepo)') < server.indexOf('await donations.initiate('));
  assert.ok(server.indexOf('await donations.initiate(') < server.indexOf('await razorpay.orders.create('));
  assert.match(server, /recent\.map\(toPublicRecentDonation\)/);
});

test('release hardening keeps demo subscriptions opt-in for development and marks gateway setup failures', async () => {
  assert.equal(shouldSeedInitialSubscriptions({ NODE_ENV: 'development', SEED_INITIAL_SUBSCRIPTIONS: 'true' }), true);
  assert.equal(shouldSeedInitialSubscriptions({ NODE_ENV: 'development' }), false);
  assert.equal(shouldSeedInitialSubscriptions({ NODE_ENV: 'production', SEED_INITIAL_SUBSCRIPTIONS: 'true' }), false);

  const backend = await readFile(new URL('../backend/index.ts', import.meta.url), 'utf8');
  assert.match(backend, /shouldSeedInitialSubscriptions\(\)/);
  assert.match(backend, /env\.NODE_ENV === 'development'/);
  assert.match(backend, /env\.SEED_INITIAL_SUBSCRIPTIONS === 'true'/);

  const server = await readFile(new URL('../server.ts', import.meta.url), 'utf8');
  for (const operation of ['subscriptions', 'orders']) {
    const creation = server.indexOf(`razorpay.${operation}.create`);
    const followingCatch = server.indexOf('} catch (err)', creation);
    const failedMark = server.indexOf('await donations.markFailed(', creation);
    const rethrow = server.indexOf('throw err;', followingCatch);
    assert.ok(creation >= 0, `missing Razorpay ${operation} creation`);
    assert.ok(followingCatch > creation, `${operation} creation is not guarded by a catch`);
    assert.ok(failedMark > followingCatch && failedMark < rethrow, `${operation} failure does not mark the donation failed first`);
  }
});

test('public recent records contain only id/name/amount/date and honor genuine anonymity', () => {
  const donation = row({ clientToken: 'synthetic-private-token', dedication: { isAnonymous: false, prayerMessage: 'private' } });
  const publicRow = toPublicRecentDonation(donation);
  assert.deepEqual(Object.keys(publicRow).sort(), ['amount', 'date', 'id', 'name']);
  assert.equal(publicRow.name, 'Synthetic D.');
  assert.equal(toPublicRecentDonation({ ...donation, dedication: { isAnonymous: true } }).name, 'Anonymous Donor');
  assert.equal(toPublicRecentDonation({ ...donation, fullName: 'Single' }).name, 'Single');
  assert.doesNotMatch(JSON.stringify(publicRow), /private|email|phone|token|address/i);
});

test('conditional Mongo status updates cannot overwrite a raced verification or refund and preserve attribution', async () => {
  const fixture = mongoFixture([row({ status: 'initiated', campaignId: 'c2' })]);
  fixture.race(record => { record.status = 'verified'; record.paymentRef = 'pay_raced'; record.receiptNumber = 'PKF-raced'; });
  const failed = await fixture.repository.updateStatus('DON-test', 'failed', { failureReason: 'late client failure' });
  assert.equal(failed?.status, 'verified'); assert.equal(failed?.paymentRef, 'pay_raced');
  const attached = await fixture.repository.updateStatus('DON-test', 'initiated', { razorpayOrderId: 'order_late', campaignId: 'c3', source: 'campaign_c3' });
  assert.equal(attached?.status, 'verified'); assert.equal(attached?.razorpayOrderId, 'order_late');
  assert.equal(attached?.campaignId, 'c2'); assert.equal(attached?.source, 'campaign_c2');
  assert.equal(attached?.receiptNumber, 'PKF-raced');
  const refundFixture = mongoFixture([row({ status: 'initiated' })]);
  refundFixture.race(record => { record.status = 'refunded'; });
  const verify = await refundFixture.repository.updateStatus('DON-test', 'verified', { paymentRef: 'pay_late' });
  assert.equal(verify?.status, 'refunded');
  const refunded = await fixture.repository.updateStatus('DON-test', 'refunded', {}, { idempotencyKey: 'refund:key' });
  assert.equal(refunded?.idempotencyKey, 'refund:key', 'the interface options argument is persisted');
});

test('verification awaits subscription creation, catches its rejection, and does not notify on raced refund', async () => {
  let notified = 0; let settled = false;
  const donation = row({ status: 'initiated', type: 'monthly', autoPay: true, receiptNumber: 'PKF-existing' });
  const repository = {
    async findById() { return donation; },
    async updateStatus(_id: string, status: StoredDonation['status'], updates: Partial<StoredDonation>) { return { ...donation, ...updates, status }; },
  } as unknown as DonationRepository;
  const subscriptions = { async create() { await Promise.resolve(); settled = true; throw new Error('Synthetic subscription failure'); } } as unknown as SubscriptionService;
  const service = new DonationService(repository, subscriptions, undefined, async () => { notified++; });
  assert.equal((await service.verify(donation.id, 'pay_synthetic')).status, 'verified');
  assert.equal(settled, true); assert.equal(notified, 1);
  repository.updateStatus = async () => ({ ...donation, status: 'refunded' });
  await assert.rejects(service.verify(donation.id, 'pay_synthetic'), /can no longer be verified/);
  assert.equal(notified, 1);
});

test('actual service lifecycle leaves verified gifts visible, excludes refunds, and retains recurring campaign ID', async () => {
  const records = new Map<string, StoredDonation>();
  let notifications = 0;
  const repository = {
    async initiate(value: Omit<StoredDonation, 'status'>) { const saved = { ...value, status: 'initiated' as const }; records.set(saved.id, saved); return saved; },
    async findById(id: string) { return records.get(id) || null; },
    async findByRazorpaySubscriptionId(id: string) { return [...records.values()].find(record => record.razorpaySubscriptionId === id) || null; },
    async allocateReceiptNumber() { return 'PKF-synthetic'; },
    async updateStatus(id: string, status: StoredDonation['status'], patch: Partial<StoredDonation>) {
      const saved = { ...records.get(id)!, ...patch, status }; records.set(id, saved); return saved;
    },
    async listAll() { return [...records.values()]; },
    async listRecent(limit: number, source?: string) {
      return filterDonationsBySource([...records.values()].filter(record => record.status === 'verified'), source).slice(0, limit);
    },
  } as unknown as DonationRepository;
  const subscriptions = { async create() {}, async findByRazorpaySubscriptionId() { return null; }, async bumpNextBilling() {} } as unknown as SubscriptionService;
  const service = new DonationService(repository, subscriptions, undefined, async () => { notifications++; });
  const pending = await service.initiate({ ...input, amount: 500, type: 'monthly', autoPay: true });
  await service.attachRazorpaySubscription(pending.id, 'sub_synthetic');
  assert.equal((await service.listRecent(10, 'campaign_c2')).length, 0);
  await service.verify(pending.id, 'pay_first');
  await service.verify(pending.id, 'pay_first');
  assert.equal(notifications, 1, 'sequential verification retries do not repeat side effects');
  assert.equal((await service.markFailed(pending.id, 'late failure')).status, 'verified');
  assert.equal((await service.listRecent(10, 'campaign_c2')).length, 1);
  const recurring = await service.recordSubscriptionCharge({ razorpaySubscriptionId: 'sub_synthetic', paymentId: 'pay_next', amountPaise: 50000 });
  assert.equal(recurring?.campaignId, 'c2'); assert.equal(recurring?.source, 'campaign_c2');
  await service.markRefunded(pending.id);
  await assert.rejects(service.verify(pending.id, 'pay_first'), /refunded/);
  assert.deepEqual((await service.listRecent(10, 'campaign_c2')).map(record => record.id), [recurring!.id]);
});

test('historical admin source aliases and known built-in titles have recent/stats parity after 150 other donations', async () => {
  const aliases: [string, string][] = [
    ['Crowd Funding Campaign', 'c1'], ['Pitru Paksha Campaign', 'c2'], ['Gau Seva Campaign', 'c4'],
    ['Support Emergency Rescue & Relief Operations Across India', 'c1'],
    ['Let this Pitr Paksha be a time of remembrance, gratitude and compassion.', 'c2'],
    ['This Tuesday, Turn Your Faith Into Seva', 'c3'],
    ['1,400+ Lives Depend on Your Kindness — Donate Today', 'c4'],
    ['This Thursday, Let’s Feed 1,400+ Gaumata', 'c5'],
    ['Celebrate Your Special Day by Sharing Happiness', 'c6'],
    ['This Navratri, Your Donation Can Give a Voiceless Life a Second Chance.', 'c7'],
  ];
  for (const [suffix, id] of aliases) {
    const historical = row({ id: `old-${id}`, source: `campaign_${suffix}`, causeTitle: 'Unrelated current title' });
    const fixture = mongoFixture([historical, ...Array.from({ length: 150 }, (_, index) => row({ id: `other-${index}`,
      source: 'campaign_unrelated', timestamp: '2026-02-01T00:00:00.000Z' }))]);
    assert.equal(attributedCampaignId(historical), id);
    assert.equal(expression(campaignAttributionExpression(), historical), id);
    assert.deepEqual((await fixture.repository.listRecent(1, `campaign_${id}`)).map(item => item.id), [historical.id]);
    assert.equal((await fixture.repository.listRecent(1, `campaign_${suffix}`))[0].id, historical.id);
    assert.equal(validateDonationPayload({ ...input, source: historical.source }).campaignId, id);
  }
  assert.equal(attributedCampaignId({ source: 'campaign_Arbitrary CMS title', causeTitle: aliases[3][0] }), 'Arbitrary CMS title');
  assert.equal(attributedCampaignId({ campaignId: 'custom-id', source: 'campaign_Crowd Funding Campaign' }), 'custom-id');
});

test('Navratri c7 compatibility canonicalizes old IDs in JS and Mongo attribution without changing other IDs', async () => {
  const historical = row({ id: 'navratri-old', campaignId: 'navratri', source: 'campaign_navratri', causeTitle: 'Old Navratri title' });
  const sourceOnly = row({ id: 'navratri-source', campaignId: undefined, source: 'campaign_navratri' });
  for (const donation of [historical, sourceOnly]) {
    assert.equal(attributedCampaignId(donation), 'c7');
    assert.equal(expression(campaignAttributionExpression(), donation), 'c7');
    assert.equal(toAdminDonation(donation).source, 'campaign_c7');
    assert.equal(toAdminDonation(donation).campaignId, 'c7');
    const fixture = mongoFixture([donation, row({ id: 'refunded-navratri', campaignId: 'c7', source: 'campaign_c7', status: 'refunded' })]);
    assert.equal((await fixture.repository.listRecent(10, 'campaign_c7')).length, 1);
    assert.equal((await fixture.repository.listRecent(10, 'campaign_navratri')).length, 1);
  }
  const immutable = row({ campaignId: 'custom-immutable', source: 'campaign_navratri' });
  assert.equal(attributedCampaignId(immutable), 'custom-immutable');
  assert.equal(expression(campaignAttributionExpression(), immutable), 'custom-immutable');
});

test('campaign repository maps a legacy Navratri row to c7 and prefers c7 without duplicate CMS records', async () => {
  const makeCampaign = (id: string, title: string, active = true) => ({
    id, title, category: 'Faith', organizer: 'Punyakart Foundation', target: 0, image: '/navratri.jpg',
    description: title, sort_order: 7, has_tax_benefit: false, is_active: active,
    created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z',
  });
  const records: any[] = [makeCampaign('navratri', 'Historical CMS content'), makeCampaign('c7', 'Authoritative CMS content')];
  const matches = (record: any, filter: any) => {
    const ids = filter.id?.$in;
    return ids ? ids.includes(record.id) : record.id === filter.id;
  };
  const campaigns = {
    async createIndex() {},
    find(filter: any) { return { async toArray() { return records.filter(record => matches(record, filter)).map(record => structuredClone(record)); } }; },
    async findOne(filter: any) { return structuredClone(records.find(record => matches(record, filter)) || null); },
    aggregate(pipeline: any[]) {
      const match = pipeline.find(stage => stage.$match)?.$match;
      const rows = records.filter(record => !match || matches(record, match)).map(record => ({ ...structuredClone(record), raised: 0, donors: 0 }));
      return { async toArray() { return rows; } };
    },
    async updateOne(filter: any, update: any) {
      const record = records.find(item => matches(item, filter));
      if (!record) return { matchedCount: 0 };
      Object.assign(record, update.$set);
      return { matchedCount: 1 };
    },
    async deleteOne(filter: any) {
      const index = records.findIndex(item => matches(item, filter));
      if (index < 0) return { deletedCount: 0 };
      records.splice(index, 1);
      return { deletedCount: 1 };
    },
  };
  const repository = Object.create(MongoCampaignRepository.prototype) as MongoCampaignRepository;
  Object.assign(repository, {
    indexesReady: Promise.resolve(),
    getCollections: async () => ({ campaigns, donations: { async createIndex() {} } }),
  });

  assert.equal((await repository.findById('navratri'))?.id, 'c7');
  assert.equal((await repository.listWithStats(false)).filter(campaign => campaign.id === 'c7').length, 1);
  await repository.update('navratri', { title: 'Updated canonical content' });
  assert.equal(records.find(record => record.id === 'c7')?.title, 'Updated canonical content');
  assert.equal(records.find(record => record.id === 'navratri')?.title, 'Historical CMS content');
  await repository.deactivate('navratri');
  assert.equal(records.find(record => record.id === 'c7')?.is_active, false);
  assert.equal((await repository.listWithStats(true)).some(campaign => campaign.id === 'c7'), false, 'inactive c7 suppresses an active legacy duplicate');
  await repository.delete('navratri');
  assert.equal(records.some(record => record.id === 'c7'), false);
  assert.equal((await repository.findById('navratri'))?.id, 'c7', 'legacy row remains an untouched compatibility fallback');
});

test('subscription list, lookup, and new mandates canonicalize Navratri source without rewriting historical titles', async () => {
  const historical = {
    id: 'SUB-historical', donorName: 'Historical Donor', email: 'donor@example.invalid', phone: '9876543210', amount: 500,
    frequency: 'MONTHLY', causeTitle: 'Old Navratri title', startDate: '2026-01-01', nextBillingDate: '2026-02-01',
    status: 'ACTIVE' as const, paymentMethod: 'razorpay', source: 'campaign_navratri',
  };
  const inserted: any[] = [];
  const repo = {
    async list() { return [historical]; },
    async findByRazorpaySubscriptionId() { return historical; },
    async insert(record: any) { inserted.push(record); return record; },
  } as any;
  const service = new SubscriptionService(repo);
  assert.equal((await service.list())[0].source, 'campaign_c7');
  assert.equal((await service.findByRazorpaySubscriptionId('sub_old'))?.source, 'campaign_c7');
  await service.create({ ...historical, donorName: 'New Donor', razorpaySubscriptionId: undefined, source: 'campaign_navratri' });
  assert.equal(inserted[0].source, 'campaign_c7');
  assert.equal(inserted[0].causeTitle, 'Old Navratri title');
});

test('separate service instances share one persisted verification winner and one donation total', async () => {
  const fixture = mongoFixture([row({ status: 'initiated', campaignId: 'c2', type: 'monthly', autoPay: true,
    razorpaySubscriptionId: 'sub_seed', receiptNumber: '' })]);
  let notifications = 0; let subscriptionsCreated = 0;
  const subscriptions = { async create() { subscriptionsCreated++; } } as unknown as SubscriptionService;
  const services = Array.from({ length: 12 }, () => new DonationService(fixture.makeRepository(), subscriptions, undefined,
    async () => { notifications++; }));
  const verified = await Promise.all(services.map(service => service.verify('DON-test', 'pay_shared')));
  assert.ok(verified.every(item => item.status === 'verified'));
  assert.equal(new Set(verified.map(item => item.receiptNumber)).size, 1);
  assert.equal(notifications, 1); assert.equal(subscriptionsCreated, 1);
  assert.equal(fixture.all().length, 1);
  assert.equal((await fixture.repository.listRecent(100, 'campaign_c2')).reduce((total, item) => total + item.amount, 0), 100);
  assert.ok(fixture.receiptSequence() >= 1, 'receipt allocation retains the existing gap-tolerant counter semantics');
  await services[0].verify('DON-test', 'pay_shared');
  assert.equal(notifications, 1);
});

test('persisted verification ownership loses safely to a concurrent refund without notification', async () => {
  const fixture = mongoFixture([row({ status: 'initiated', receiptNumber: 'PKF-existing' })]);
  let notified = 0;
  fixture.race(record => { record.status = 'refunded'; });
  const service = new DonationService(fixture.repository, {} as SubscriptionService, undefined, async () => { notified++; });
  await assert.rejects(service.verify('DON-test', 'pay_refundrace'), /can no longer be verified/);
  assert.equal(fixture.get().status, 'refunded'); assert.equal(fixture.get().receiptNumber, 'PKF-existing');
  assert.equal(notified, 0);
});

test('concurrent recurring callbacks converge by payment ID, reject other subscriptions, and never duplicate totals', async () => {
  const seed = row({ id: 'DON-seed', campaignId: 'c2', type: 'monthly', autoPay: true,
    razorpaySubscriptionId: 'sub_shared', paymentRef: 'pay_seed', receiptNumber: 'PKF-seed' });
  const fixture = mongoFixture([seed]);
  let notifications = 0; let bumps = 0;
  const subscriptions = {
    async findByRazorpaySubscriptionId() { return null; },
    async create() { assert.fail('A recurring charge must not replace the original subscription seed'); },
    async bumpNextBilling() { bumps++; },
  } as unknown as SubscriptionService;
  const services = Array.from({ length: 12 }, () => new DonationService(fixture.makeRepository(), subscriptions, undefined,
    async () => { notifications++; }));
  const charge = { razorpaySubscriptionId: 'sub_shared', paymentId: 'pay_repeat', amountPaise: 10000 };
  const results = await Promise.all(services.map(service => service.recordSubscriptionCharge(charge)));
  assert.equal(new Set(results.map(item => item?.id)).size, 1);
  assert.equal(results[0]?.id, recurringDonationId(charge.paymentId));
  assert.equal(new Set(results.map(item => item?.receiptNumber)).size, 1);
  assert.equal(fixture.all().length, 2); assert.equal(notifications, 1); assert.equal(bumps, 1);
  assert.equal((await fixture.repository.listRecent(100, 'campaign_c2')).reduce((total, item) => total + item.amount, 0), 200);
  await assert.rejects(services[0].recordSubscriptionCharge({ ...charge, razorpaySubscriptionId: 'sub_other' }), /does not match/);
  await assert.rejects(services[0].recordSubscriptionCharge({ ...charge, amountPaise: 9999 }), /does not match/);
  await assert.rejects(services[0].recordSubscriptionCharge({ ...charge, paymentId: 'pay_fractional', amountPaise: 10000.5 }), /amount does not match/);
  assert.equal(fixture.all().length, 2);
  await services[0].markRefunded(results[0]!.id);
  assert.equal((await services[1].recordSubscriptionCharge(charge))?.status, 'refunded');
  assert.equal(notifications, 1); assert.equal(bumps, 1);
  assert.equal((await fixture.repository.listRecent(100, 'campaign_c2')).reduce((total, item) => total + item.amount, 0), 100);
});

test('recurring retries preserve a failed persisted record and reject a mismatched subscription seed', async () => {
  const failed = row({ id: recurringDonationId('pay_failed'), paymentRef: 'pay_failed', status: 'failed', razorpaySubscriptionId: 'sub_shared' });
  const fixture = mongoFixture([failed]);
  const service = new DonationService(fixture.repository, {} as SubscriptionService, undefined, async () => assert.fail('No notification'));
  assert.equal((await service.recordSubscriptionCharge({ paymentId: 'pay_failed', razorpaySubscriptionId: 'sub_shared' }))?.status, 'failed');
  const wrongSeed = mongoFixture([row({ id: 'DON-wrong', razorpaySubscriptionId: 'sub_wrong' })]);
  const subscriptions = { async findByRazorpaySubscriptionId() { return { seedDonationId: 'DON-wrong', amount: 100 }; } } as unknown as SubscriptionService;
  const otherService = new DonationService(wrongSeed.repository, subscriptions, undefined, async () => {});
  await assert.rejects(otherService.recordSubscriptionCharge({ paymentId: 'pay_new', razorpaySubscriptionId: 'sub_shared', amountPaise: 10000 }), /seed subscription/);
  assert.equal(wrongSeed.all().length, 1);
});

test('simultaneous claims for one payment from two subscriptions cannot create two donation totals', async () => {
  const fixture = mongoFixture([
    row({ id: 'DON-seed-a', razorpaySubscriptionId: 'sub_a', paymentRef: 'pay_seed_a', receiptNumber: 'PKF-a' }),
    row({ id: 'DON-seed-b', razorpaySubscriptionId: 'sub_b', paymentRef: 'pay_seed_b', receiptNumber: 'PKF-b' }),
  ]);
  let notifications = 0;
  const subscriptions = { async findByRazorpaySubscriptionId() { return null; }, async bumpNextBilling() {} } as unknown as SubscriptionService;
  const services = ['sub_a', 'sub_b'].map(() => new DonationService(fixture.makeRepository(), subscriptions, undefined,
    async () => { notifications++; }));
  const results = await Promise.allSettled(services.map((service, index) => service.recordSubscriptionCharge({
    razorpaySubscriptionId: index === 0 ? 'sub_a' : 'sub_b', paymentId: 'pay_conflicting', amountPaise: 10000,
  })));
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(results.filter(result => result.status === 'rejected').length, 1);
  assert.equal(fixture.all().filter(item => item.paymentRef === 'pay_conflicting').length, 1);
  assert.equal(fixture.all().length, 3); assert.equal(notifications, 1);
  assert.equal((await fixture.repository.listRecent(100)).reduce((total, item) => total + item.amount, 0), 300);
});

test('gateway reconstruction is insert-only and cannot replace attributed or terminal donations', async () => {
  for (const status of ['verified', 'failed', 'refunded'] as const) {
    const original = row({ id: 'DON-real', campaignId: 'c2', source: 'campaign_c2', paymentRef: 'pay_import',
      receiptNumber: 'PKF-original', razorpayOrderId: 'order_real', status });
    const fixture = mongoFixture([original]);
    const snapshot = row({ id: 'DON-gateway', source: 'chennai_airport', paymentRef: 'pay_import',
      razorpayOrderId: 'order_real', receiptNumber: 'PKF-snapshot', fullName: 'Gateway reconstruction' });
    const results = await Promise.all(Array.from({ length: 10 }, () => fixture.makeRepository().upsertVerified(snapshot)));
    assert.ok(results.every(item => item.id === original.id && item.status === status && item.campaignId === 'c2'
      && item.receiptNumber === 'PKF-original' && item.fullName === original.fullName));
    assert.equal(fixture.all().length, 1);
  }
  const empty = mongoFixture([]);
  const imported = row({ id: 'DON-import', paymentRef: 'pay_single' });
  await Promise.all(Array.from({ length: 10 }, () => empty.makeRepository().upsertVerified(imported)));
  assert.equal(empty.all().length, 1);
  assert.equal((await empty.repository.listRecent(100)).reduce((total, item) => total + item.amount, 0), 100);
});

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DonationService, withoutClientToken } from '../backend/donationService.js';
import type { DonationRepository } from '../backend/db/DonationRepository.js';
import type { SubscriptionService } from '../backend/subscriptionService.js';
import type { StoredDonation } from '../backend/types.js';
import { toAdminDonation } from '../backend/adminDonation.js';
import { inheritedTrafficAttribution, storedTrafficAttribution } from '../backend/trafficAttribution.js';
import { createTrafficAttributionSession } from '../frontend/src/utils/trafficAttributionSession.js';
import { deriveTrafficAttribution, TRAFFIC_ATTRIBUTION_TTL_MS } from '../frontend/src/utils/trafficAttribution.js';
import { donorCsvRow, donorTrafficSource, DONOR_CSV_HEADERS, filterDonorRows } from '../frontend/src/admin/donorTraffic.js';
import { serializeCsv } from '../frontend/src/admin/adminApi.js';
import { DonorDetailsTab } from '../frontend/src/components/admin/DonorDetailsTab.js';

// Synthetic data only; the production server and all external integrations stay unopened.
const NOW = Date.parse('2026-10-10T06:00:00.000Z');
const SITE = 'https://punyakart.example';
const donor = {
  amount: 200, type: 'one-time', causeTitle: 'Synthetic campaign', campaignId: 'c2',
  source: 'campaign_c2', fullName: 'Synthetic Donor', phone: '9876543210',
  email: 'donor@example.invalid', address: 'Synthetic address', panNumber: '',
  want80G: true, paymentMethod: 'razorpay',
};
const snapshot = (source: string, now = NOW) => deriveTrafficAttribution({
  url: `${SITE}/campaigns/second?utm_source=${source}&utm_medium=paid_social&utm_campaign=Rescue_A&utm_content=Video_A`, now,
})!;

function fixture() {
  const records = new Map<string, StoredDonation>();
  let notificationCount = 0;
  const repository = {
    async initiate(row: Omit<StoredDonation, 'status'>) {
      const saved = structuredClone({ ...row, status: 'initiated' as const });
      records.set(row.id, saved);
      return structuredClone(saved);
    },
    async findById(id: string) { return structuredClone(records.get(id) || null); },
    async findByRazorpaySubscriptionId(id: string) {
      return structuredClone([...records.values()].find(row => row.razorpaySubscriptionId === id) || null);
    },
    async allocateReceiptNumber() { return `PKF-2026-27-${String(records.size).padStart(6, '0')}`; },
    async updateStatus(id: string, status: StoredDonation['status'], updates: Partial<StoredDonation>) {
      const existing = records.get(id);
      if (!existing) return null;
      const saved = { ...existing, ...updates, status };
      records.set(id, structuredClone(saved));
      return structuredClone(saved);
    },
    async listAll() { return [...records.values()].map(row => structuredClone(row)); },
    async listEligible() { return [...records.values()].filter(row => row.status === 'verified').map(row => structuredClone(row)); },
  } as unknown as DonationRepository;
  const subscriptions = {
    async create() {}, async findByRazorpaySubscriptionId() { return null; }, async bumpNextBilling() {},
  } as unknown as SubscriptionService;
  const service = new DonationService(repository, subscriptions, undefined, async () => { notificationCount++; });
  return { service, records, notifications: () => notificationCount };
}

test('regression: admin JSON includes saved campaign source, with no Chennai fallback for unknown history', async () => {
  const { service } = fixture();
  for (const source of ['campaign_c2', 'campaign_c6', 'crowd_funding', 'chennai_airport']) {
    const row = await service.initiate({ ...donor, source,
      campaignId: source.startsWith('campaign_') ? source.slice(9) : undefined, amount: 500 }, new Date(NOW));
    const dto = JSON.parse(JSON.stringify(toAdminDonation(row)));
    assert.equal(dto.source, source);
    assert.equal(dto.amount, 500);
    assert.equal(dto.status, 'initiated');
    assert.equal(donorTrafficSource(dto), 'unknown');
    assert.ok(!('clientToken' in dto) && !('metaAttribution' in dto));
  }
  const row = await service.initiate(donor, new Date(NOW));
  assert.equal(toAdminDonation({ ...row, source: '', campaignId: 'c2' }).source, 'campaign_c2');
  assert.equal(toAdminDonation({ ...row, source: undefined, campaignId: undefined }).source, 'unknown');
  assert.equal(toAdminDonation({ ...row, source: 'manual' }).source, 'manual');
  assert.equal(toAdminDonation({ ...row, source: 'chennai_airport', campaignId: 'c2' }).source, 'chennai_airport', 'conflicting saved history is not rewritten');
});

test('admin certificate download status does not mistake a sent 80G email for an actual PDF download', async () => {
  const { service } = fixture();
  const initiated = await service.initiate(donor, new Date(NOW));
  const verified = await service.verify(initiated.id, 'pay_EmailTrackingTest', new Date(NOW + 1000));
  const legacyEmailOnly = toAdminDonation(verified, new Map([[verified.id, {
    downloadedAt: new Date(NOW + 2000).toISOString(),
    source: 'email',
  }]]));
  assert.equal(legacyEmailOnly.certificateDownloaded, false);
  assert.equal(legacyEmailOnly.certificateDownloadedAt, '');
  assert.equal(legacyEmailOnly.certificateDownloadSource, '');

  const actualDownload = toAdminDonation(verified, new Map([[verified.id, {
    downloadedAt: new Date(NOW + 3000).toISOString(),
    source: 'public',
  }]]));
  assert.equal(actualDownload.certificateDownloaded, true);
  assert.equal(actualDownload.certificateDownloadSource, 'public');
});

test('arrival -> SPA navigation -> initiation -> verified persistence -> admin filter and CSV preserve traffic separately', async () => {
  for (const [tag, expected] of [['fb', 'facebook'], ['ig', 'instagram'], ['whatsapp', 'whatsapp'], ['newsletter', 'other']]) {
    const f = fixture();
    let browser = { url: `${SITE}/?utm_source=${tag}&utm_medium=social&utm_campaign=Rescue_A`, referrer: '' };
    const session = createTrafficAttributionSession({ now: () => NOW, readBrowser: () => browser, getStorage: () => undefined });
    session.initialize();
    browser = { url: `${SITE}/campaigns/second`, referrer: `${SITE}/` };
    const input = { ...donor, trafficAttribution: session.getForCheckout() };
    const initiated = await f.service.initiate(input, new Date(NOW));
    assert.equal(initiated.trafficAttribution?.source, expected);
    const verified = await f.service.verify(initiated.id, 'pay_Test1', new Date(NOW + 1000));
    const readback = await f.service.findById(verified.id);
    assert.equal(readback?.trafficAttribution?.source, expected);
    assert.equal(readback?.source, 'campaign_c2');
    assert.equal(readback?.amount, 200);
    const admin = JSON.parse(JSON.stringify(toAdminDonation(readback!)));
    assert.equal(filterDonorRows([admin], { trafficSource: expected as 'facebook' | 'instagram' | 'whatsapp' | 'other' }).length, 1);
    assert.equal(filterDonorRows([admin], { query: 'Rescue_A' }).length, 1);
    const csv = serializeCsv(DONOR_CSV_HEADERS, [donorCsvRow(admin)]);
    assert.ok(csv.includes('Campaign: c2'));
    assert.ok(csv.includes('Rescue_A'));
    const html = renderToStaticMarkup(React.createElement(DonorDetailsTab, { donations: [admin] }));
    assert.match(html, /Campaign \/ portal/);
    assert.match(html, /Traffic source/);
    assert.doesNotMatch(html, /Chennai Airport/);
    assert.equal((await f.service.listEligible()).reduce((sum, row) => sum + row.amount, 0), 200);
    assert.equal(f.notifications(), 1);
    assert.ok(!('trafficAttribution' in withoutClientToken(verified)), 'private attribution is not returned by public payment/receipt serializers');
  }
});

test('untrusted posted attribution is recomputed and cannot alter source, payment, CAPI consent or donor fields', async () => {
  const { service } = fixture();
  const raw = {
    ...snapshot('instagram'), source: 'facebook', evidence: 'referrer', inherited: true,
    email: 'private@example.invalid', fbclid: 'RAW_CLICK', token: 'PRIVATE_TOKEN',
    url: `${SITE}/?secret=PRIVATE_QUERY`, referrerHost: 'https://facebook.com/private?secret=PRIVATE',
  };
  const row = await service.initiate({ ...donor, trafficAttribution: raw }, new Date(NOW));
  assert.equal(row.trafficAttribution?.source, 'instagram');
  assert.equal(row.trafficAttribution?.evidence, 'utm');
  assert.equal(row.trafficAttribution?.inherited, undefined);
  assert.equal(row.source, 'campaign_c2');
  assert.equal(row.amount, 200);
  assert.equal(row.email, donor.email);
  assert.equal(row.metaAttribution, undefined);
  assert.equal(row.status, 'initiated');
  assert.doesNotMatch(JSON.stringify(row.trafficAttribution), /PRIVATE|RAW_CLICK|email|token|secret|fbclid/);
  assert.equal(raw.source, 'facebook', 'input snapshot is not mutated');
});

test('missing, malformed, stale and future attribution do not block a donation or invent traffic', async () => {
  const { service } = fixture();
  for (const trafficAttribution of [undefined, null, 'facebook', [], { source: 'instagram' },
    snapshot('facebook', NOW - TRAFFIC_ATTRIBUTION_TTL_MS), snapshot('facebook', NOW + 1)]) {
    const row = await service.initiate({ ...donor, trafficAttribution }, new Date(NOW));
    assert.equal(row.trafficAttribution, undefined);
    assert.equal(donorTrafficSource(toAdminDonation(row)), 'unknown');
  }
  const direct = deriveTrafficAttribution({ url: `${SITE}/`, referrer: '', now: NOW });
  const row = await service.initiate({ ...donor, trafficAttribution: direct }, new Date(NOW));
  assert.equal(donorTrafficSource(toAdminDonation(row)), 'direct_unknown');
});

test('saved attribution history does not expire on later admin reads and is still strictly allowlisted', async () => {
  const f = fixture();
  const row = await f.service.initiate({ ...donor, trafficAttribution: snapshot('whatsapp') }, new Date(NOW));
  const hostileStored = { ...row.trafficAttribution, rawCookie: 'PRIVATE_COOKIE', campaign: '=FORMULA', accessToken: 'PRIVATE_TOKEN' };
  const dto = toAdminDonation({ ...row, verifiedAt: new Date(NOW + 60 * 86400000).toISOString(), trafficAttribution: hostileStored });
  assert.equal(dto.trafficAttribution?.source, 'whatsapp');
  assert.equal(dto.trafficAttribution?.capturedAt, new Date(NOW).toISOString());
  assert.doesNotMatch(JSON.stringify(dto.trafficAttribution), /PRIVATE|FORMULA|rawCookie|accessToken/);
  assert.equal(storedTrafficAttribution({ ...hostileStored, capturedAt: 'not-a-date' }), undefined);
  assert.equal(storedTrafficAttribution(null), undefined);
  assert.equal(inheritedTrafficAttribution(undefined), undefined);
});

test('real recurring-charge service copies signup attribution as inherited without fabricating a new visit', async () => {
  const f = fixture();
  const signup = await f.service.initiate({
    ...donor, amount: 500, type: 'monthly', autoPay: true, trafficAttribution: snapshot('ig'),
  }, new Date(NOW));
  await f.service.attachRazorpaySubscription(signup.id, 'sub_TestTraffic');
  await f.service.verify(signup.id, 'pay_SignupTraffic', new Date(NOW + 1000));
  const second = await f.service.recordSubscriptionCharge({ razorpaySubscriptionId: 'sub_TestTraffic', paymentId: 'pay_RecurringTraffic', amountPaise: 50000 });
  assert.ok(second);
  assert.notEqual(second.id, signup.id);
  assert.equal(second.trafficAttribution?.source, 'instagram');
  assert.equal(second.trafficAttribution?.inherited, true);
  assert.equal(second.trafficAttribution?.capturedAt, signup.trafficAttribution?.capturedAt);
  assert.equal(second.source, signup.source);
  assert.equal(second.amount, 500);
  const admin = toAdminDonation(second);
  assert.equal(donorTrafficSource(admin), 'instagram');
  const html = renderToStaticMarkup(React.createElement(DonorDetailsTab, { donations: [admin] }));
  assert.match(html, /Original signup \(not a new visit\)/);
  const again = await f.service.recordSubscriptionCharge({ razorpaySubscriptionId: 'sub_TestTraffic', paymentId: 'pay_RecurringTraffic', amountPaise: 50000 });
  assert.equal(again?.id, second.id);
  assert.equal(f.records.size, 2);
  assert.equal((await f.service.listEligible()).reduce((sum, row) => sum + row.amount, 0), 1000);
});

test('HTTP admin donation list and search both use the corrected shared serializer behind admin auth', async () => {
  // Supplementary wiring assertion; starting server.ts would connect to production-configured integrations.
  const server = await readFile(new URL('../server.ts', import.meta.url), 'utf8');
  assert.match(server, /import \{ toAdminDonation \} from '\.\/backend\/adminDonation\.js'/);
  assert.doesNotMatch(server, /function toAdminDonation\(/);
  assert.match(server, /app\.get\('\/api\/admin\/donations', adminAuth/);
  assert.match(server, /app\.get\('\/api\/admin\/donations\/search', adminAuth/);
  assert.ok((server.match(/records\.map\(\(row\) => toAdminDonation\(row, downloads, receiptMap\)\)/g) || []).length === 2);
});

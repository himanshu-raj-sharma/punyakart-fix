import assert from 'node:assert/strict';
import test from 'node:test';
import { campaignDonationAvailable, snapshotForSource, startPublicSnapshotPolling, type PublicSnapshot } from '../frontend/src/utils/publicCampaignPolling';
import { parsePublicCampaign, type PublicCampaign } from '../frontend/src/hooks/usePublicCampaign';
import { canDonateToCampaignCard, mergeDiscoveryCampaigns, parseDiscoveryCampaigns, type CampaignCardItem } from '../frontend/src/utils/campaignDiscovery';

const settle = () => new Promise<void>(resolve => setImmediate(resolve));
const response = (payload: unknown, status = 200) => new Response(JSON.stringify(payload), { status });
const campaign = { id: 'c3', title: 'Confirmed campaign', is_active: true, raised: 100, target: 5000, donors: 1 };
const payload = (value = campaign) => ({ success: true, campaign: value });

function clock() {
  let id = 0;
  const pending = new Map<number, { callback: () => void; delay: number }>();
  return {
    pending,
    timers: {
      setTimeout: ((callback: () => void, delay: number) => { pending.set(++id, { callback, delay }); return id; }) as unknown as typeof setTimeout,
      clearTimeout: ((key: number) => { pending.delete(key); }) as unknown as typeof clearTimeout,
    },
    tick(delay: number) {
      const entry = [...pending.entries()].find(([, value]) => value.delay === delay);
      assert.ok(entry, `expected ${delay}ms timer`);
      pending.delete(entry[0]);
      entry[1].callback();
    },
  };
}

test('campaign snapshots validate identity and explicit availability, including real zero totals', () => {
  assert.equal(parsePublicCampaign(payload(), 'c3'), campaign);
  assert.equal(parsePublicCampaign(payload({ ...campaign, id: 'navratri' }), 'c7').id, 'c7');
  assert.throws(() => parsePublicCampaign(payload({ ...campaign, id: 'navratri' }), 'c3'));
  for (const value of [null, {}, payload({ ...campaign, id: 'c4' }), { success: true, campaign: { id: 'c3' } }]) {
    assert.throws(() => parsePublicCampaign(value, 'c3'));
  }
  assert.equal(parsePublicCampaign(payload({ ...campaign, raised: 0, donors: 0 }), 'c3').raised, 0);
  assert.equal(campaignDonationAvailable('ready', campaign), true);
  for (const status of ['loading', 'error'] as const) assert.equal(campaignDonationAvailable(status, campaign), false);
  assert.equal(campaignDonationAvailable('ready', { is_active: false }), false);
  assert.equal(campaignDonationAvailable('ready', {}), false);
  const previous: PublicSnapshot<PublicCampaign> = { source: '/api/campaigns/c3', data: campaign, status: 'ready' };
  assert.deepEqual(snapshotForSource(previous, '/api/campaigns/c4'), { source: '/api/campaigns/c4', data: null, status: 'loading' });
});

test('serial detail polling refreshes totals at 30s, retains stale details on error, and recovers', async () => {
  const time = clock();
  const states: PublicSnapshot<PublicCampaign>[] = [];
  const requests: Array<{ finish: (value: Response) => void; signal: AbortSignal }> = [];
  const stop = startPublicSnapshotPolling('/api/campaigns/c3', p => parsePublicCampaign(p, 'c3'), s => states.push(s),
    ((url, options) => {
      assert.equal(url, '/api/campaigns/c3');
      assert.equal(options?.cache, 'no-store');
      return new Promise<Response>(finish => requests.push({ finish, signal: options!.signal! }));
    }) as typeof fetch, time.timers);
  assert.equal(requests.length, 1);
  assert.deepEqual([...time.pending.values()].map(t => t.delay), [10_000], 'only deadline runs while fetch is pending');
  requests[0].finish(response(payload()));
  await settle();
  assert.equal(states.at(-1)?.data?.raised, 100);
  assert.deepEqual([...time.pending.values()].map(t => t.delay), [30_000]);
  time.tick(30_000);
  requests[1].finish(response(payload({ ...campaign, raised: 501, donors: 2 })));
  await settle();
  assert.equal(states.at(-1)?.data?.raised, 501);
  time.tick(30_000);
  requests[2].finish(response({ success: false }, 503));
  await settle();
  const stale = states.at(-1)!;
  assert.equal(stale.status, 'error');
  assert.equal(stale.data?.raised, 501);
  assert.equal(campaignDonationAvailable(stale.status, stale.data), false);
  time.tick(30_000);
  requests[3].finish(response(payload({ ...campaign, is_active: false })));
  await settle();
  assert.equal(states.at(-1)?.status, 'ready');
  assert.equal(campaignDonationAvailable(states.at(-1)!.status, states.at(-1)!.data), false);
  stop();
  assert.equal(time.pending.size, 0);
  assert.equal(requests[3].signal.aborted, true);
});

test('default browser transport invokes fetch with the global receiver', async () => {
  const originalFetch = globalThis.fetch;
  const time = clock();
  const states: PublicSnapshot<PublicCampaign>[] = [];
  let receiver: unknown;
  globalThis.fetch = function (this: unknown, input, init) {
    receiver = this;
    assert.equal(input, '/api/campaigns/c3');
    assert.equal(init?.cache, 'no-store');
    return Promise.resolve(response(payload()));
  } as typeof fetch;
  try {
    const stop = startPublicSnapshotPolling('/api/campaigns/c3', p => parsePublicCampaign(p, 'c3'), s => states.push(s), undefined, time.timers);
    await settle();
    assert.equal(receiver, globalThis);
    assert.equal(states.at(-1)?.status, 'ready');
    stop();
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('timeout is bounded even when transport ignores abort; late results and unmounted sources cannot publish', async () => {
  const time = clock();
  const states: PublicSnapshot<PublicCampaign>[] = [];
  const requests: Array<{ finish: (value: Response) => void; signal: AbortSignal }> = [];
  const transport = ((_url, options) => new Promise<Response>(finish => requests.push({ finish, signal: options!.signal! }))) as typeof fetch;
  const stop = startPublicSnapshotPolling('/api/campaigns/c3', p => parsePublicCampaign(p, 'c3'), s => states.push(s), transport, time.timers);
  time.tick(10_000);
  await settle();
  assert.equal(requests[0].signal.aborted, true);
  assert.equal(states.at(-1)?.status, 'error');
  time.tick(30_000);
  requests[0].finish(response(payload()));
  await settle();
  assert.equal(states.at(-1)?.status, 'error', 'late timed-out success is ignored');
  const count = states.length;
  stop();
  assert.equal(requests[1].signal.aborted, true);
  assert.equal(time.pending.size, 0);
  const stopNew = startPublicSnapshotPolling('/api/campaigns/c4', p => parsePublicCampaign(p, 'c4'), s => states.push(s),
    (async () => response(payload({ ...campaign, id: 'c4' }))) as typeof fetch, time.timers);
  await settle();
  requests[1].finish(response(payload()));
  await settle();
  assert.equal(states.length, count + 2);
  assert.equal(states.at(-1)?.data?.id, 'c4');
  stopNew();
  assert.equal(time.pending.size, 0);
});

test('listing polling replaces removed campaigns and makes every offline preview nonpayable', async () => {
  const time = clock();
  const fallback: CampaignCardItem = { id: 'c7', title: 'Navratri', category: 'Faith', organizer: 'Foundation', image: '', hasTaxBenefit: false };
  const states: PublicSnapshot<CampaignCardItem[]>[] = [];
  let value: unknown = { success: true, campaigns: [{ ...fallback, is_active: true, raised: 0, donors: 0, target: 0 }] };
  const stop = startPublicSnapshotPolling('/api/campaigns', parseDiscoveryCampaigns, s => states.push(s),
    (async () => response(value)) as typeof fetch, time.timers);
  await settle();
  const display = () => {
    const state = states.at(-1)!;
    return mergeDiscoveryCampaigns([fallback], state.status === 'ready' ? state.data! : undefined);
  };
  assert.equal(canDonateToCampaignCard(display()[0]), true);
  value = { success: true, campaigns: [] };
  time.tick(30_000);
  await settle();
  assert.deepEqual(display(), []);
  value = { success: false };
  time.tick(30_000);
  await settle();
   assert.equal(display()[0].id, 'c7');
  assert.equal(canDonateToCampaignCard(display()[0]), false);
  assert.equal(display()[0].raised, undefined);
  stop();
  assert.equal(time.pending.size, 0);
});

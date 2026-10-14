import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  donorFeedMessage, formatRelativeTime, parsePublicDonations, publicFeedForSource, publicStat,
  startPublicDonationPolling, startDonationRotation, type PublicDonationFeed,
} from '../frontend/src/utils/publicDonations';
import { LiveWallOfCompassion } from '../frontend/src/components/campaign/LiveWallOfCompassion';
import { ImpactBanner } from '../frontend/src/components/campaign/ImpactBanner';

const donation = { id: 'verified-1', name: 'A*** S***', amount: 501, date: '2026-09-01T10:00:00.000Z' };
const payload = (donations: unknown[] = [donation]) => ({ success: true, donations });
const response = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });
const settle = () => new Promise<void>(resolve => setImmediate(resolve));

function clock() {
  const pending = new Map<number, { callback: () => void; delay: number }>();
  let id = 0;
  return {
    pending,
    timers: {
      setTimeout: ((callback: () => void, delay: number) => {
        pending.set(++id, { callback, delay });
        return id;
      }) as unknown as typeof setTimeout,
      clearTimeout: ((timer: number) => { pending.delete(timer); }) as unknown as typeof clearTimeout,
    },
    tick(expectedDelay = 15_000) {
      const [key, task] = [...pending.entries()][0] ?? [];
      assert.ok(task, 'a retry must be scheduled');
      assert.equal(task.delay, expectedDelay);
      pending.delete(key);
      task.callback();
    },
  };
}

test('public name is preserved, genuine anonymity stays anonymous, private fields never propagate', () => {
  const parsed = parsePublicDonations(payload([
    { ...donation, donor_name: 'Private Full Name', fullName: 'Private Full Name', email: 'private@example.test' },
    { ...donation, id: 'anonymous', name: 'Anonymous', fullName: 'Hidden Name' },
  ]));
  assert.deepEqual(parsed, [donation, { ...donation, id: 'anonymous', name: 'Anonymous' }]);
  assert.equal(JSON.stringify(parsed).includes('Private'), false);
  assert.equal(JSON.stringify(parsed).includes('Hidden'), false);
});

test('empty success is distinct from malformed, failed, and invalid legacy records', () => {
  assert.deepEqual(parsePublicDonations(payload([])), []);
  for (const value of [null, {}, { success: false, donations: [] }, { success: true, donations: {} }]) {
    assert.throws(() => parsePublicDonations(value));
  }
  for (const change of [
    { name: undefined, donor_name: 'Legacy Name' }, { amount: 0 }, { amount: -1 },
    { amount: Infinity }, { amount: '501' }, { date: 'not a date' }, { date: undefined }, { id: '' },
  ]) assert.throws(() => parsePublicDonations(payload([{ ...donation, ...change }])));
});

test('duplicate public IDs do not create duplicate cards', () => {
  assert.deepEqual(parsePublicDonations(payload([donation, donation])), [donation]);
});

test('old verified dates cannot be presented as recent or just now', () => {
  const now = Date.parse('2026-10-10T10:00:00.000Z');
  assert.equal(formatRelativeTime(donation.date, now), '1 month ago');
  assert.equal(formatRelativeTime('2026-10-10T09:58:00.000Z', now), '2 minutes ago');
  assert.equal(formatRelativeTime('invalid', now), '');
  assert.equal(formatRelativeTime('2026-10-10T10:00:30.000Z', now), 'in less than a minute');
});

test('hook source projection hides previous campaign data before effects run', () => {
  const old: PublicDonationFeed = { source: 'campaign_c3', status: 'ready', donations: [donation] };
  assert.equal(publicFeedForSource(old, 'campaign_c3'), old);
  assert.deepEqual(publicFeedForSource(old, 'campaign_c6'), { source: 'campaign_c6', status: 'loading', donations: [] });
});

test('poll lifecycle waits for completion, polls at 15s, and aborts/clears on unmount', async () => {
  const time = clock();
  const published: PublicDonationFeed[] = [];
  let finish!: (value: Response) => void;
  let calls = 0;
  let signal: AbortSignal | null | undefined;
  const transport = (async (url, options) => {
    calls++;
    assert.equal(url, '/api/donations/recent?limit=9&source=campaign_c1');
    signal = options?.signal;
    return new Promise<Response>(resolve => { finish = resolve; });
  }) as typeof fetch;
  const stop = startPublicDonationPolling('campaign_c1', 9, value => published.push(value), transport, time.timers);
  assert.equal(calls, 1);
  assert.equal(time.pending.size, 0, 'no timer can overlap an in-flight request');
  assert.equal(published[0].status, 'loading');
  finish(response(payload()));
  await settle();
  assert.deepEqual(published.at(-1)?.donations, [donation]);
  time.tick();
  assert.equal(calls, 2);
  assert.equal(time.pending.size, 0);
  stop();
  assert.equal(signal?.aborted, true);
  finish(response(payload([{ ...donation, id: 'late' }])));
  await settle();
  assert.equal(published.length, 2, 'late responses cannot update unmounted hooks');
  assert.equal(time.pending.size, 0);
});

test('source switch rejects a late previous response even if transport ignores abort', async () => {
  const time = clock();
  const states: PublicDonationFeed[] = [];
  let finishOld!: (value: Response) => void;
  const stopOld = startPublicDonationPolling('campaign_c3', 10, s => states.push(s),
    (() => new Promise<Response>(resolve => { finishOld = resolve; })) as typeof fetch, time.timers);
  stopOld();
  const stopNew = startPublicDonationPolling('campaign_c6', 10, s => states.push(s),
    (async () => response(payload([{ ...donation, id: 'birthday' }]))) as typeof fetch, time.timers);
  await settle();
  finishOld(response(payload()));
  await settle();
  assert.equal(states.at(-1)?.source, 'campaign_c6');
  assert.equal(states.at(-1)?.donations[0].id, 'birthday');
  stopNew();
  assert.equal(time.pending.size, 0);
});

test('poll failures clear donors, expose unavailable, and recover to true empty', async () => {
  const time = clock();
  const states: PublicDonationFeed[] = [];
  const responses = [response(payload()), response({}, 503), response(payload([]))];
  const stop = startPublicDonationPolling('campaign_c2', 10, s => states.push(s),
    (async () => responses.shift()!) as typeof fetch, time.timers);
  await settle();
  time.tick();
  await settle();
  assert.equal(states.at(-1)?.status, 'error');
  assert.deepEqual(states.at(-1)?.donations, []);
  assert.match(donorFeedMessage('error', 0)!, /unavailable/);
  time.tick();
  await settle();
  assert.equal(states.at(-1)?.status, 'ready');
  assert.equal(donorFeedMessage('ready', 0), 'No recent donations to display.');
  stop();
});

test('malformed successful responses are unavailable rather than falsely empty', async () => {
  const time = clock();
  const states: PublicDonationFeed[] = [];
  const stop = startPublicDonationPolling('campaign_c3', 10, s => states.push(s),
    (async () => response({ success: true, donations: [{ donor_name: 'Private' }] })) as typeof fetch, time.timers);
  await settle();
  assert.equal(states.at(-1)?.status, 'error');
  stop();
});

test('toast rotation restarts visibly when a list shrinks during its hidden transition', () => {
  const time = clock();
  let visible = false;
  let index = 0;
  const stop = startDonationRotation(3, value => { visible = value; }, () => { index++; }, time.timers);
  assert.equal(visible, true);
  time.tick(6_500);
  assert.equal(visible, false);
  stop();
  const stopSingle = startDonationRotation(1, value => { visible = value; }, () => { index++; }, time.timers);
  assert.equal(visible, true, 'a canceled reveal cannot permanently hide the remaining donor');
  assert.equal(time.pending.size, 0);
  assert.equal(index, 0);
  stopSingle();
  const stopAgain = startDonationRotation(2, value => { visible = value; }, () => { index++; }, time.timers);
  time.tick(6_500);
  time.tick(400);
  assert.equal(index, 1);
  assert.equal(visible, true);
  stopAgain();
  assert.equal(time.pending.size, 0);
});

test('default toast timers preserve the browser global receiver', () => {
  const originalSetTimeout = globalThis.setTimeout;
  const originalClearTimeout = globalThis.clearTimeout;
  let receiver: unknown;
  const pending = new Set<number>();
  let id = 0;
  globalThis.setTimeout = function (this: unknown, callback, _delay) {
    receiver = this;
    const timer = ++id;
    pending.add(timer);
    return timer as unknown as ReturnType<typeof setTimeout>;
  } as typeof setTimeout;
  globalThis.clearTimeout = function (this: unknown, timer) {
    receiver = receiver || this;
    pending.delete(timer as number);
  } as typeof clearTimeout;
  try {
    const stop = startDonationRotation(2, () => {}, () => {});
    assert.equal(receiver, globalThis);
    stop();
    assert.equal(pending.size, 0);
  } finally {
    globalThis.setTimeout = originalSetTimeout;
    globalThis.clearTimeout = originalClearTimeout;
  }
});

test('rendered donor wall contains public name and date, with truthful empty/error states', () => {
  const markup = renderToStaticMarkup(createElement(LiveWallOfCompassion, { donors: [donation] }));
  assert.match(markup, /A\*\*\* S\*\*\*/);
  assert.match(markup, /dateTime="2026-09-01T10:00:00.000Z"/i);
  const empty = renderToStaticMarkup(createElement(LiveWallOfCompassion, { donors: [], status: 'ready' }));
  assert.match(empty, /No recent donations/);
  assert.doesNotMatch(empty, /DINESH|Sivamurugan/);
  const error = renderToStaticMarkup(createElement(LiveWallOfCompassion, { donors: [], status: 'error' }));
  assert.match(error, /temporarily unavailable/);
  assert.doesNotMatch(error, /No recent donations/);
});

test('real totals determine progress; CMS display labels cannot fabricate totals', () => {
  const markup = renderToStaticMarkup(createElement(ImpactBanner, {
    raised: 250, target: 1000, donors: 2,
    content: { progress_percent: 99, impact_raised_label: 'FAKE RAISED', impact_donors_label: 'FAKE DONORS' },
  }));
  assert.match(markup, /25%/);
  assert.match(markup, /₹250/);
  assert.doesNotMatch(markup, /99%|FAKE/);
  const unknown = renderToStaticMarkup(createElement(ImpactBanner, { status: 'error' }));
  assert.match(unknown, /totals are temporarily unavailable/);
  assert.doesNotMatch(unknown, /5\.8L|479|29%/);
  assert.equal(publicStat(undefined), null);
  assert.equal(publicStat(NaN), null);
  assert.equal(publicStat(-1), null);
  assert.equal(publicStat(0), 0);
});

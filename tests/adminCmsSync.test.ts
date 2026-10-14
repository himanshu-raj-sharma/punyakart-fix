import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createAdminRequestAuthority, createAdminSessionStore, parseCampaignDonationPresets, validateCampaignContentAmounts } from '../frontend/src/admin/adminCmsSync.js';
import { fetchAdminJson } from '../frontend/src/admin/adminApi.js';
import { ADMIN_FETCH_MS } from '../frontend/src/admin/adminTypes.js';
import { createCampaignSchema, updateCampaignSchema } from '../backend/validation/campaignSchema.js';
import { NAVRATRI_DEFAULT_CAMPAIGN } from '../frontend/src/data/navratriCampaign.js';
import { seedDefaultCampaignsIfEmpty } from '../backend/campaignSeed.js';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

test('blocked session storage access keeps an isolated memory session and logout clears it', () => {
  const unavailable = () => { throw new DOMException('Storage blocked', 'SecurityError'); };
  const session = createAdminSessionStore(unavailable, 'test-slot');
  assert.equal(session.read(), '');
  session.persist('  inert-test-marker  ');
  assert.ok(session.read().length > 0);
  const separateDocument = createAdminSessionStore(unavailable, 'test-slot');
  assert.equal(separateDocument.read(), '', 'fallback is not shared across session store instances');
  session.clear();
  assert.equal(session.read(), '');
});

test('failed storage writes/removal cannot restore stale stored data after logout', () => {
  let blocked = false;
  const session = createAdminSessionStore(() => ({
    getItem: () => 'old-inert-marker',
    setItem: () => { if (blocked) throw new Error('Write blocked'); },
    removeItem: () => { throw new Error('Removal blocked'); },
  }), 'test-slot');
  assert.ok(session.read().length > 0);
  blocked = true;
  session.persist('new-inert-marker');
  assert.ok(session.read().startsWith('new-'));
  session.clear();
  blocked = false;
  assert.equal(session.read(), '', 'logout tombstone overrides the old storage value');
});

test('normal session storage persistence and logout still use the session slot', () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (name: string) => values.get(name) ?? null,
    setItem: (name: string, value: string) => { values.set(name, value); },
    removeItem: (name: string) => { values.delete(name); },
  };
  const session = createAdminSessionStore(() => storage, 'test-slot');
  session.persist('inert-test-marker');
  assert.equal(values.size, 1);
  assert.ok(createAdminSessionStore(() => storage, 'test-slot').read().length > 0);
  session.clear();
  assert.equal(values.size, 0);
  assert.equal(session.read(), '');
});

test('actual refresh authority permits all seven reads and only the newest batch can commit', async () => {
  const authority = createAdminRequestAuthority();
  authority.activate();
  const committed: number[][] = [];
  const batch = (pending: ReturnType<typeof deferred<number>>[]) => {
    const request = authority.begin()!;
    return { request, done: Promise.all(pending.map((read) => read.promise)).then((values) => {
      if (request.isCurrent()) committed.push(values);
    }).finally(request.finish) };
  };
  const oldReads = Array.from({ length: 7 }, () => deferred<number>());
  const newReads = Array.from({ length: 7 }, () => deferred<number>());
  const old = batch(oldReads);
  const latest = batch(newReads);
  assert.equal(old.request.signal.aborted, true);
  newReads.slice(0, 6).forEach((read) => read.resolve(2));
  await Promise.resolve();
  assert.deepEqual(committed, [], 'six successful endpoints cannot commit a live batch');
  newReads[6].resolve(2);
  await latest.done;
  oldReads.forEach((read) => read.resolve(1));
  await old.done;
  assert.deepEqual(committed, [Array(7).fill(2)], 'late transport results cannot overwrite the newest batch');
});

test('logout/unmount invalidates in-flight refresh and rejects callbacks until a new session starts', async () => {
  for (const lifecycle of ['logout', 'unmount']) {
    const authority = createAdminRequestAuthority();
    authority.activate();
    const pending = deferred<void>();
    const request = authority.begin()!;
    let unlocked = false;
    let persistenceWrites = 0;
    const refresh = pending.promise.then(() => {
      if (!request.isCurrent()) return;
      unlocked = true;
      persistenceWrites += 1;
    });
    authority.deactivate();
    assert.equal(request.signal.aborted, true, lifecycle);
    assert.equal(authority.begin(), null, 'late save callbacks cannot start another refresh');
    authority.activate();
    const next = authority.begin()!;
    pending.resolve();
    await refresh;
    assert.equal(unlocked, false);
    assert.equal(persistenceWrites, 0);
    assert.equal(next.isCurrent(), true, 'old completion cannot cancel the new session');
    authority.deactivate();
  }
});

test('one failed endpoint prevents success and finishing cancels outstanding siblings', async () => {
  const authority = createAdminRequestAuthority();
  authority.activate();
  const request = authority.begin()!;
  const reads = Array.from({ length: 7 }, () => deferred<number>());
  let live = false;
  const done = Promise.all(reads.map((read) => read.promise)).then(() => {
    if (request.isCurrent()) live = true;
  }).finally(request.finish);
  reads[3].reject(new Error('Required endpoint failed'));
  await assert.rejects(done, /Required endpoint failed/);
  assert.equal(live, false);
  assert.equal(request.signal.aborted, true);
  reads.forEach((read) => read.resolve(1));
});

test('admin fetch forwards caller cancellation and removes its listener', async (context) => {
  const caller = new AbortController();
  const remove = context.mock.method(caller.signal, 'removeEventListener');
  context.mock.method(globalThis, 'fetch', async (_url: unknown, init?: RequestInit) => {
    return new Promise<Response>((_resolve, reject) => {
      init!.signal!.addEventListener('abort', () => reject(init!.signal!.reason), { once: true });
    });
  });
  const response = fetchAdminJson('/fake', '', { signal: caller.signal });
  caller.abort();
  await assert.rejects(response, (error: Error) => error.name === 'AbortError' && !/timed out/.test(error.message));
  assert.equal(remove.mock.callCount(), 1);
});

test('admin fetch respects an already-aborted caller and retains its timeout', async (context) => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  context.mock.method(globalThis, 'fetch', async (_url: unknown, init?: RequestInit) => {
    const signal = init!.signal!;
    signal.throwIfAborted();
    return new Promise<Response>((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(signal.reason), { once: true });
    });
  });
  const caller = new AbortController();
  caller.abort();
  await assert.rejects(fetchAdminJson('/fake', '', { signal: caller.signal }), { name: 'AbortError' });
  const timed = fetchAdminJson('/fake', '');
  const assertion = assert.rejects(timed, /request timed out/);
  context.mock.timers.tick(ADMIN_FETCH_MS);
  await assertion;
});

test('admin fetch removes listener on success and rejects unsuccessful envelopes', async (context) => {
  const caller = new AbortController();
  const remove = context.mock.method(caller.signal, 'removeEventListener');
  context.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ success: true, campaigns: [] })));
  assert.deepEqual(await fetchAdminJson('/fake', '', { signal: caller.signal }), { success: true, campaigns: [] });
  assert.equal(remove.mock.callCount(), 1);
  context.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ success: false, error: 'Unavailable' })));
  await assert.rejects(fetchAdminJson('/fake', ''), /Unavailable/);
});

test('seeded Navratri content and actual c6 empty hero round-trip through CMS create/update', async () => {
  type SeedInput = Parameters<Parameters<typeof seedDefaultCampaignsIfEmpty>[0]['create']>[0];
  const records: SeedInput[] = [];
  // Capture seed inputs in memory only; there is no repository, server, or database connection.
  const repository = {
    listWithStats: async () => [],
    create: async (record: SeedInput) => { records.push(record); },
  } as unknown as Parameters<typeof seedDefaultCampaignsIfEmpty>[0];
  await seedDefaultCampaignsIfEmpty(repository);
  for (const record of records) {
    const { id: _id, ...fields } = record;
    const created = createCampaignSchema.parse(fields);
    assert.deepEqual(updateCampaignSchema.parse(JSON.parse(JSON.stringify(created))), created);
  }
  const navratri = records.find((record) => record.id === NAVRATRI_DEFAULT_CAMPAIGN.id)!;
  assert.deepEqual(navratri.content, NAVRATRI_DEFAULT_CAMPAIGN.content);
  assert.equal(records.find((record) => record.id === 'c6')!.image, '');
  assert.equal(updateCampaignSchema.safeParse({ content: { seva_sankalp_text: 'x'.repeat(2001) } }).success, false);
  assert.equal(updateCampaignSchema.safeParse({ content: { unknown_field: 'not approved' } }).success, false);
});

test('optional hero does not weaken URL validation or required card images', () => {
  for (const image of ['javascript:alert(1)', 'data:image/png;base64,AAAA', '//external.example/image.jpg']) {
    assert.equal(updateCampaignSchema.safeParse({ image }).success, false, image);
  }
  assert.equal(updateCampaignSchema.safeParse({ image: '' }).success, true);
  assert.equal(updateCampaignSchema.safeParse({ image: '/campaign-images/photo.jpg' }).success, true);
  assert.equal(updateCampaignSchema.safeParse({ content: { contribution_cards: [
    { id: 'card', price: 200, unit: 'seva', title: 'Food', subtitle: '', image: '' },
  ] } }).success, false);
});

test('CMS presets never silently drop malformed input and all payable cards enforce ₹200 minimum', () => {
  assert.deepEqual(parseCampaignDonationPresets(' 501, 1001, 2100 '), [501, 1001, 2100]);
  assert.deepEqual(parseCampaignDonationPresets('200, 10000000'), [200, 10_000_000]);
  assert.deepEqual(parseCampaignDonationPresets(''), []);
  for (const input of ['99', '100', '101', '199', '200,', ',200', '200,,300', '1,000', '200,abc,300', '1e3', '200.5', 'Infinity', '10000001']) {
    assert.throws(() => parseCampaignDonationPresets(input), /whole-rupee donation amounts/);
  }
  for (const amount of [99, 100, 101, 199, 0, -100, 200.5, NaN, Infinity, 10_000_001]) {
    for (const [field, amountField] of [['contribution_cards', 'price'], ['about_cards', 'supportAmount'], ['recovery_stories', 'supportAmount']]) {
      assert.throws(() => validateCampaignContentAmounts({ [field]: [{ [amountField]: amount }] }), /must be a whole-rupee amount/);
    }
    assert.equal(updateCampaignSchema.safeParse({ donation_presets: [amount] }).success, false);
    assert.equal(updateCampaignSchema.safeParse({ content: { contribution_cards: [
      { id: 'card', price: amount, unit: 'seva', title: 'Food', subtitle: '', image: '/food.jpg' },
    ] } }).success, false);
    assert.equal(updateCampaignSchema.safeParse({ content: { about_cards: [
      { id: 'card', supportAmount: amount, image: '/food.jpg', line1: '', line2: '', line3: '' },
    ] } }).success, false);
    assert.equal(updateCampaignSchema.safeParse({ content: { recovery_stories: [
      { id: 'story', supportAmount: amount, title: '', subtitle: '', statusBadge: '', beforeImg: '/before.jpg', afterImg: '/after.jpg', description: '' },
    ] } }).success, false);
  }
  assert.equal(updateCampaignSchema.safeParse({ donation_presets: [200, 10_000_000], target: 0 }).success, true);
  assert.doesNotThrow(() => validateCampaignContentAmounts({ contribution_cards: [{ price: 200 }], about_cards: [{ supportAmount: 200 }], recovery_stories: [{ supportAmount: 200 }] }));
  assert.doesNotThrow(() => validateCampaignContentAmounts({ about_cards: [{ supportAmount: 10_000_000 }] }));
});

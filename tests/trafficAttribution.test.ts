import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { LegalPage } from '../frontend/src/pages/LegalPage';
import {
  deriveTrafficAttribution, sanitizeTrafficAttribution, sanitizeTrafficLandingPath, sanitizeTrafficUtm,
  MAX_TRAFFIC_UTM_LENGTH, TRAFFIC_ATTRIBUTION_TTL_MS, type TrafficAttribution,
} from '../frontend/src/utils/trafficAttribution';
import {
  createTrafficAttributionSession, getTrafficAttributionForCheckout, initializeTrafficAttribution,
  MAX_TRAFFIC_SESSION_LENGTH, resetTrafficAttributionSession, TRAFFIC_ATTRIBUTION_SESSION_KEY,
  type TrafficBrowserContext, type TrafficSessionStorage,
} from '../frontend/src/utils/trafficAttributionSession';

// Synthetic fixtures only: no server, credentials, gateway, database, browser automation or external calls.
const NOW = Date.parse('2026-10-10T12:00:00.000Z');
const ORIGIN = 'https://fundraiser.example.invalid';
const iso = (time = NOW) => new Date(time).toISOString();
const direct = (time = NOW): TrafficAttribution => ({ version: 1, source: 'direct_unknown', evidence: 'none', capturedAt: iso(time), landingPath: '/' });
const arrival = (search = '', referrer = '') => deriveTrafficAttribution({ url: `${ORIGIN}/${search}`, referrer, now: NOW })!;

class MemoryStorage implements TrafficSessionStorage {
  data = new Map<string, string>();
  writes = 0;
  getItem(key: string) { return this.data.get(key) ?? null; }
  setItem(key: string, value: string) { this.writes += 1; this.data.set(key, value); }
  removeItem(key: string) { this.data.delete(key); }
}

function fixture(storage: TrafficSessionStorage = new MemoryStorage()) {
  let now = NOW;
  let browser: TrafficBrowserContext | undefined = { url: `${ORIGIN}/?utm_source=instagram`, referrer: '', navigationType: 'navigate' };
  let reads = 0;
  const session = () => createTrafficAttributionSession({
    now: () => now, getStorage: () => storage,
    readBrowser: () => { reads += 1; return browser; },
  });
  return {
    storage, session, setTime: (time: number) => { now = time; },
    setBrowser: (value: TrafficBrowserContext | undefined) => { browser = value; },
    reads: () => reads,
  };
}

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

test('all supported UTM aliases have deterministic sources, preserving the sanitized display label', () => {
  const sources = {
    fb: 'facebook', facebook: 'facebook', ig: 'instagram', instagram: 'instagram',
    wa: 'whatsapp', whatsapp: 'whatsapp', google: 'google', bing: 'bing', yt: 'youtube', youtube: 'youtube',
    linkedin: 'linkedin', tg: 'telegram', telegram: 'telegram', twitter: 'x', x: 'x', meta: 'meta',
    msg: 'meta', messenger: 'meta', an: 'meta', audience_network: 'meta',
  };
  for (const [alias, expected] of Object.entries(sources)) {
    for (const label of [alias, alias.toUpperCase(), ` ${alias} `]) {
      const result = arrival(`?utm_source=${encodeURIComponent(label)}`);
      assert.equal(result.source, expected, alias);
      assert.equal(result.evidence, 'utm');
      assert.equal(result.utmSource, label.trim());
      assert.equal(result.utmMedium, undefined, 'a platform never proves paid/organic medium');
    }
  }
});

test('unknown UTM labels are other and source UTM outranks both referrer and click flags', () => {
  const result = arrival('?utm_source=community_newsletter&utm_medium=email&utm_campaign=October.v2&utm_content=header_A-1&fbclid=fake&gclid=fake', 'https://www.google.com/search?q=private');
  assert.equal(result.source, 'other');
  assert.equal(result.evidence, 'utm');
  assert.equal(result.utmSource, 'community_newsletter');
  assert.equal(result.utmMedium, 'email');
  assert.equal(result.utmCampaign, 'October.v2');
  assert.equal(result.utmContent, 'header_A-1');
  assert.equal(result.referrerHost, 'www.google.com');
  assert.equal(result.hasMetaClick, true);
  assert.equal(result.hasGoogleClick, true);
  assert.equal(arrival('?utm_source=__proto__').source, 'direct_unknown');
  assert.equal(arrival('?utm_source=constructor').source, 'other');
});

test('known external hostnames match exact/subdomain boundaries across all platforms', () => {
  const groups = {
    facebook: ['facebook.com', 'fb.com', 'fb.me', 'fb.watch'],
    instagram: ['instagram.com'], whatsapp: ['whatsapp.com', 'wa.me'],
    google: ['google.com', 'google.co.in', 'google.co.uk', 'google.com.au', 'google.ca', 'google.de', 'google.fr', 'google.co.jp', 'google.co.nz', 'google.com.sg', 'google.ae', 'g.co'],
    bing: ['bing.com'], youtube: ['youtube.com', 'youtu.be'], linkedin: ['linkedin.com', 'lnkd.in'],
    telegram: ['telegram.org', 'telegram.me', 't.me'], x: ['twitter.com', 'x.com', 't.co'],
  };
  for (const [source, domains] of Object.entries(groups)) {
    for (const host of domains) {
      for (const variant of [host, `l.${host}`, host.toUpperCase(), `${host}.`]) {
        const result = arrival('', `https://${variant}/private/path?email=synthetic%40example.invalid#secret`);
        assert.equal(result.source, source, variant);
        assert.equal(result.evidence, 'referrer');
        assert.equal(result.referrerHost, variant.toLowerCase().replace(/\.$/, ''));
      }
      for (const spoof of [`${host}.evil.test`, `not${host}`]) {
        assert.equal(arrival('', `https://${spoof}/`).source, 'referral', spoof);
      }
    }
  }
});

test('an arbitrary external hostname is referral, never inferred social or paid traffic', () => {
  const result = arrival('?fbclid=fake', 'https://community.example.invalid/private?token=secret');
  assert.equal(result.source, 'referral');
  assert.equal(result.referrerHost, 'community.example.invalid');
  assert.equal(result.utmMedium, undefined);
});

test('fbclid is only ambiguous Meta, gclid alone is Google, known referrer beats either', () => {
  assert.equal(arrival('?fbclid=SYNTHETIC_META_ID').source, 'meta');
  assert.equal(arrival('?fbclid=').source, 'meta', 'presence does not require reading an ID');
  assert.equal(arrival('?gclid=SYNTHETIC_GOOGLE_ID').source, 'google');
  assert.equal(arrival('?fbclid=fake&gclid=fake').source, 'meta', 'two flags still cannot prove Facebook');
  assert.equal(arrival('?fbclid=fake').evidence, 'click_id');
  assert.equal(arrival('?fbclid=fake', 'https://l.instagram.com/').source, 'instagram');
  assert.equal(arrival('?fbclid=fake', 'https://www.google.com/').source, 'google');
  assert.equal(arrival('?gclid=fake', 'https://wa.me/').source, 'whatsapp');
  assert.equal(arrival('?fbclid=fake', 'https://m.facebook.com/').utmMedium, undefined);
  assert.equal(arrival('?utm_medium=cpc&gclid=fake').utmMedium, 'cpc', 'medium is retained only when explicitly supplied');
});

test('no evidence, hidden referrer and internal navigation are captured direct_unknown; unavailable data is absent', () => {
  for (const referrer of ['', `${ORIGIN}/campaigns`, 'https://www.fundraiser.example.invalid/', 'https://punyakart.com/', 'https://www.punyakart.com/admin']) {
    assert.deepEqual(arrival('', referrer), direct());
  }
  assert.equal(arrival('?utm_medium=social').source, 'direct_unknown', 'medium alone cannot identify a source');
  assert.equal(arrival('?utm_medium=social').evidence, 'none');
  assert.equal(sanitizeTrafficAttribution(undefined, NOW), undefined, 'historic missing data must remain unknown/not recorded');
  assert.equal(deriveTrafficAttribution({ url: undefined, now: NOW }), undefined);
});

test('UTM values are bounded ASCII labels and reject PII, templates, URL/formula/control injection without truncation', () => {
  for (const value of [
    '', ' ', undefined, null, 42, {}, 'synthetic@example.invalid', 'https://example.invalid', 'www.example.invalid',
    'example.com', '//example.invalid', '{{campaign.name}}', '{source}', '${source}', '%7Bsource%7D',
    'campaign.name', 'adset_id', 'utm_source', 'undefined', 'null', '<script>',
    '=SUM(1)', '+123456789', '-danger', '@formula', '.hidden', '_private',
    'test\nprivate', 'test\rprivate', 'test\tprivate', 'test\0private', 'test\u007fprivate',
    'café', 'a\u202eb', '\u00a0fb', '\ufefffb', '9876543210', '91-98765-43210', 'call 98765 43210',
    'A'.repeat(MAX_TRAFFIC_UTM_LENGTH + 1),
  ]) assert.equal(sanitizeTrafficUtm(value), undefined, String(value));
  for (const value of ['fb', 'October.v2', 'Community Bulletin', 'campaign_A-2', 'A'.repeat(MAX_TRAFFIC_UTM_LENGTH)]) {
    assert.equal(sanitizeTrafficUtm(value), value);
  }
  assert.equal(sanitizeTrafficUtm('  fb  '), 'fb');
});

test('invalid source falls back to valid referrer; duplicate UTM parameters are discarded as ambiguous', () => {
  const bad = arrival('?utm_source=synthetic%40example.invalid&utm_content=%3Dformula&utm_term=PRIVATE_TERM', 'https://l.instagram.com/');
  assert.equal(bad.source, 'instagram');
  assert.equal(bad.utmSource, undefined);
  assert.equal(bad.utmContent, undefined);
  assert.equal('utmTerm' in bad, false);
  const duplicate = arrival('?utm_source=fb&utm_source=ig&utm_campaign=valid&utm_content=one&utm_content=two');
  assert.equal(duplicate.source, 'direct_unknown');
  assert.equal(duplicate.utmSource, undefined);
  assert.equal(duplicate.utmContent, undefined);
  assert.equal(duplicate.utmCampaign, 'valid');
});

test('landing paths allow public pages/slugs and reject private/arbitrary/encoded paths', () => {
  for (const path of ['/', '/campaigns', '/campaigns/c1', '/campaigns/gau-seva', '/campaigns/education', '/blogs/kindness-2026', '/crowd-funding', '/privacy', '/terms', '/refund']) {
    assert.equal(sanitizeTrafficLandingPath(path), path);
    assert.equal(deriveTrafficAttribution({ url: `${ORIGIN}${path}?token=SECRET_QUERY#PRIVATE_HASH`, now: NOW })?.landingPath, path);
  }
  assert.equal(sanitizeTrafficLandingPath('/campaigns/'), '/campaigns');
  for (const path of ['/admin', '/admin/donors', '/login', '/my-donations', '/receipt/private', '/thank-you', '/api/donations',
    '/campaigns/receipt-secret', '/campaigns/login', '/campaigns/token-abc', '/campaigns/donor-abc',
    '/campaigns/abc9876543210', '/campaigns/sponsor-98765-43210', '/campaigns/abcdef123456abcd', '/campaigns/slug/secret',
    '/campaigns/%61dmin', '/campaigns/synthetic@example.invalid', '/campaigns/a?token=secret', '/campaigns/a#private',
    '/private', '//campaigns', '/campaigns/' + 'a'.repeat(65), '/campaigns/../admin']) {
    assert.equal(sanitizeTrafficLandingPath(path), undefined, path);
  }
});

test('only allowlisted fields can enter the snapshot, never raw URLs, query strings, IDs, contacts or UA', () => {
  const result = deriveTrafficAttribution({
    url: `${ORIGIN}/campaigns/gau-seva?utm_source=ig&utm_medium=social&utm_campaign=autumn&utm_content=header&fbclid=FAKE_CLICK_META&gclid=FAKE_CLICK_GOOGLE&email=private%40example.invalid&token=SECRET_TOKEN#PRIVATE_HASH`,
    referrer: 'https://l.instagram.com/private/PERSON?email=PRIVATE_EMAIL#REFERRER_HASH', now: NOW,
  })!;
  assert.deepEqual(result, {
    version: 1, capturedAt: iso(), source: 'instagram', evidence: 'utm',
    utmSource: 'ig', utmMedium: 'social', utmCampaign: 'autumn', utmContent: 'header',
    referrerHost: 'l.instagram.com', landingPath: '/campaigns/gau-seva', hasMetaClick: true, hasGoogleClick: true,
  });
  const json = JSON.stringify(result);
  for (const marker of ['FAKE_CLICK', 'SECRET_TOKEN', 'PRIVATE_', 'PERSON', 'email', 'https://', '?', '#']) assert.equal(json.includes(marker), false);
  const posted = sanitizeTrafficAttribution({ ...direct(), userAgent: 'Mobile WhatsApp', phone: '9876543210', email: 'private@example.invalid', url: 'https://secret.invalid', fbclid: 'fake', gclid: 'fake' }, NOW);
  assert.deepEqual(posted, direct(), 'raw extras do not become evidence');
});

test('unavailable URL constructor, malformed URLs, protocols and credentials fail closed', () => {
  for (const url of ['', null, '/relative', 'invalid', 'javascript:alert(1)', 'data:text/plain,hello', 'ftp://example.invalid',
    'https://', 'https://name:password@example.invalid/', `${ORIGIN}/\nsecret`, `${ORIGIN}/?${'x'.repeat(8193)}`]) {
    assert.equal(deriveTrafficAttribution({ url, now: NOW }), undefined, String(url));
  }
  for (const referrer of ['invalid', 'javascript:alert(1)', 'https://name:password@facebook.com', 'https://127.0.0.1/private', 'https://localhost/private']) {
    assert.deepEqual(arrival('', referrer), direct());
  }
  withGlobals({ URL: { value: undefined } }, () => {
    assert.equal(deriveTrafficAttribution({ url: ORIGIN, now: NOW }), undefined);
  });
});

test('shared ingress sanitizer recomputes source/evidence, ignores inherited and retains only literal boolean flags', () => {
  const result = sanitizeTrafficAttribution({
    version: 1, source: 'facebook', evidence: 'utm', inherited: true, capturedAt: iso(),
    referrerHost: 'L.INSTAGRAM.COM', landingPath: '/privacy', hasMetaClick: true, hasGoogleClick: 'true', arbitrary: 'PRIVATE',
  }, NOW);
  assert.deepEqual(result, { version: 1, source: 'instagram', evidence: 'referrer', capturedAt: iso(), referrerHost: 'l.instagram.com', landingPath: '/privacy', hasMetaClick: true });
  assert.equal(sanitizeTrafficAttribution({ ...direct(), source: 'facebook', evidence: 'utm' }, NOW)?.source, 'direct_unknown');
  for (const referrerHost of ['facebook.com.evil.test', 'notfacebook.com']) {
    assert.equal(sanitizeTrafficAttribution({ ...direct(), referrerHost }, NOW)?.source, 'referral');
  }
  for (const referrerHost of ['https://facebook.com/path?private=1', 'person@facebook.com', 'facebook.com:443', 'facebook.com/path', 'facebook.com\n', '.facebook.com', 'punyakart.com', 'admin.punyakart.com', '127.0.0.1', 'x'.repeat(254)]) {
    assert.equal(sanitizeTrafficAttribution({ ...direct(), referrerHost }, NOW)?.referrerHost, undefined);
  }
  for (const flag of [false, undefined, null, 1, 'true', 'fake-click']) {
    assert.deepEqual(sanitizeTrafficAttribution({ ...direct(), hasMetaClick: flag, hasGoogleClick: flag }, NOW), direct());
  }
});

test('timestamps use the supplied clock, expire exactly at 30 minutes and cannot be future/invalid/renewed', () => {
  const input = { ...direct(), utmSource: 'fb' };
  assert.equal(sanitizeTrafficAttribution(input, NOW + TRAFFIC_ATTRIBUTION_TTL_MS - 1)?.capturedAt, iso());
  assert.equal(sanitizeTrafficAttribution(input, NOW + TRAFFIC_ATTRIBUTION_TTL_MS), undefined);
  assert.equal(sanitizeTrafficAttribution(input, NOW - 1), undefined);
  assert.equal(sanitizeTrafficAttribution(input, NaN), undefined);
  assert.equal(sanitizeTrafficAttribution(input, Infinity), undefined);
  for (const capturedAt of [null, NOW, '', 'yesterday', '2026-10-10', '2026-10-10T12:00:00Z', '2026-02-30T12:00:00.000Z', '2026-10-10T12:00:00.001Z']) {
    assert.equal(sanitizeTrafficAttribution({ ...input, capturedAt }, NOW), undefined);
  }
  for (const input of [null, undefined, [], 'fake', 1, {}, { ...direct(), version: 2 }, { ...direct(), version: '1' }]) {
    assert.equal(sanitizeTrafficAttribution(input, NOW), undefined);
  }
  for (const now of [NaN, Infinity, 9e15]) assert.equal(deriveTrafficAttribution({ url: ORIGIN, now }), undefined);
  const ancient = deriveTrafficAttribution({ url: `${ORIGIN}/?utm_source=fb`, now: 1000 });
  assert.equal(sanitizeTrafficAttribution(ancient, 1001)?.source, 'facebook', 'fake clocks are not compared with wall time');
});

test('initialization captures once before SPA navigation and checkout gets detached frozen snapshots', () => {
  const f = fixture();
  const session = f.session();
  const initial = session.initialize()!;
  assert.equal(initial.source, 'instagram');
  f.setTime(NOW + 5000);
  f.setBrowser({ url: `${ORIGIN}/campaigns/gau-seva?utm_source=google`, referrer: ORIGIN, navigationType: 'navigate' });
  const checkout = session.getForCheckout()!;
  assert.deepEqual(checkout, initial);
  assert.notEqual(checkout, initial);
  assert.equal(Object.isFrozen(checkout), true);
  assert.deepEqual(session.initialize(), initial, 'StrictMode/repeated init cannot reattribute');
  assert.equal(f.reads(), 1);
  assert.equal((f.storage as MemoryStorage).writes, 1);
  assert.throws(() => { (checkout as TrafficAttribution).utmSource = 'fb'; }, TypeError);
  assert.equal(session.getForCheckout()?.source, 'instagram');
});

test('internal page navigation and hidden referrers inherit the last meaningful tab touch without extending its lifetime', () => {
  const f = fixture();
  f.session().initialize();
  f.setTime(NOW + 60_000);
  for (const referrer of [ORIGIN, `${ORIGIN}/campaigns`, '', 'https://www.fundraiser.example.invalid/campaigns']) {
    f.setBrowser({ url: `${ORIGIN}/campaigns/gau-seva`, referrer, navigationType: 'navigate' });
    const next = f.session().initialize()!;
    assert.equal(next.source, 'instagram');
    assert.equal(next.capturedAt, iso());
    assert.equal(next.landingPath, '/');
    assert.equal(next.inherited, true);
  }
});

test('refresh/history never replaces or renews stored hints even when referrer or URL still names an external source', () => {
  const f = fixture();
  f.session().initialize();
  f.setTime(NOW + 120_000);
  for (const navigationType of ['reload', 'back_forward']) {
    f.setBrowser({ url: `${ORIGIN}/?utm_source=fb`, referrer: 'https://www.google.com/', navigationType });
    const result = f.session().initialize()!;
    assert.equal(result.source, 'instagram');
    assert.equal(result.capturedAt, iso());
    assert.equal(result.inherited, true);
  }
});

test('without navigation timing, unchanged sanitized arrival hints conservatively keep their original capture time', () => {
  const f = fixture();
  f.session().initialize();
  f.setTime(NOW + 120_000);
  f.setBrowser({ url: `${ORIGIN}/?utm_source=instagram&private=NEVER_PERSIST`, referrer: '' });
  assert.equal(f.session().initialize()?.capturedAt, iso());
});

test('new explicit UTM or external document arrivals replace an earlier meaningful touch', () => {
  const f = fixture();
  f.session().initialize();
  const cases: Array<[TrafficBrowserContext, string]> = [
    [{ url: `${ORIGIN}/campaigns?utm_source=wa`, referrer: '', navigationType: 'navigate' }, 'whatsapp'],
    [{ url: `${ORIGIN}/campaigns/gau-seva`, referrer: 'https://www.bing.com/search?q=private', navigationType: 'navigate' }, 'bing'],
    [{ url: `${ORIGIN}/`, referrer: 'https://community.example.invalid/article', navigationType: 'navigate' }, 'referral'],
    [{ url: `${ORIGIN}/?fbclid=FAKE_ID`, referrer: '', navigationType: 'navigate' }, 'meta'],
    [{ url: `${ORIGIN}/?utm_medium=email&utm_campaign=autumn`, referrer: '', navigationType: 'navigate' }, 'direct_unknown'],
  ];
  cases.forEach(([browser, source], index) => {
    const now = NOW + (index + 1) * 1000;
    f.setTime(now);
    f.setBrowser(browser);
    const next = f.session().initialize()!;
    assert.equal(next.source, source);
    assert.equal(next.capturedAt, iso(now));
    assert.equal(next.inherited, undefined);
  });
  f.setTime(NOW + 10_000);
  f.setBrowser({ url: `${ORIGIN}/?utm_source=ig`, referrer: '', navigationType: 'navigate' });
  f.session().initialize();
  f.setTime(NOW + 11_000);
  assert.equal(f.session().initialize()?.capturedAt, iso(NOW + 11_000), 'an explicit new navigate can be the same campaign again');
});

test('medium/campaign-only touch is meaningful to session retention but never invents a source', () => {
  const f = fixture();
  f.setBrowser({ url: `${ORIGIN}/?utm_medium=social&utm_campaign=autumn`, referrer: '', navigationType: 'navigate' });
  f.session().initialize();
  f.setTime(NOW + 5000);
  f.setBrowser({ url: `${ORIGIN}/campaigns`, referrer: ORIGIN, navigationType: 'navigate' });
  const result = f.session().initialize()!;
  assert.equal(result.utmCampaign, 'autumn');
  assert.equal(result.utmMedium, 'social');
  assert.equal(result.source, 'direct_unknown');
  assert.equal(result.inherited, true);
  assert.equal(result.capturedAt, iso());
});

test('checkout expiry uses actual supplied clock and discards old UTM evidence rather than recapturing a stale URL', () => {
  const f = fixture();
  const session = f.session();
  const frozenAtInitiation = session.initialize()!;
  f.setTime(NOW + TRAFFIC_ATTRIBUTION_TTL_MS - 1);
  assert.equal(session.getForCheckout()?.source, 'instagram');
  f.setTime(NOW + TRAFFIC_ATTRIBUTION_TTL_MS);
  assert.deepEqual(session.getForCheckout(), direct(NOW + TRAFFIC_ATTRIBUTION_TTL_MS));
  assert.equal(frozenAtInitiation.source, 'instagram', 'previous donation payload remains frozen');
  assert.equal(frozenAtInitiation.capturedAt, iso());
  assert.deepEqual(JSON.parse(f.storage.getItem(TRAFFIC_ATTRIBUTION_SESSION_KEY)!), direct(NOW + TRAFFIC_ATTRIBUTION_TTL_MS));
});

test('expired storage on reload/history cannot revive stale ads, but a genuinely new arrival can', () => {
  for (const navigationType of ['reload', 'back_forward', 'navigate']) {
    const f = fixture();
    f.session().initialize();
    f.setTime(NOW + TRAFFIC_ATTRIBUTION_TTL_MS);
    f.setBrowser({ url: `${ORIGIN}/?utm_source=instagram`, referrer: 'https://l.instagram.com/', navigationType });
    const next = f.session().initialize()!;
    assert.equal(next.source, navigationType === 'navigate' ? 'instagram' : 'direct_unknown');
    assert.equal(next.capturedAt, iso(NOW + TRAFFIC_ATTRIBUTION_TTL_MS));
    if (navigationType !== 'navigate') assert.equal(next.referrerHost, undefined);
  }
});

test('bounded storage is validated, strips foreign fields, and ignores forged source/evidence/inherited', () => {
  const storage = new MemoryStorage();
  storage.setItem('unrelated-tab-data', 'KEEP');
  storage.setItem(TRAFFIC_ATTRIBUTION_SESSION_KEY, JSON.stringify({
    ...direct(), source: 'facebook', evidence: 'utm', inherited: true,
    utmSource: 'ig', email: 'PRIVATE_EMAIL', rawUrl: 'PRIVATE_URL',
  }));
  const f = fixture(storage);
  f.setBrowser({ url: `${ORIGIN}/campaigns`, referrer: ORIGIN, navigationType: 'navigate' });
  assert.equal(f.session().initialize()?.source, 'instagram');
  const written = storage.getItem(TRAFFIC_ATTRIBUTION_SESSION_KEY)!;
  assert.equal(written.includes('PRIVATE_'), false);
  assert.equal(written.includes('inherited'), false, 'inherited is local reuse metadata, not a trusted posted fact');
  assert.ok(written.length <= MAX_TRAFFIC_SESSION_LENGTH);
  assert.equal(storage.getItem('unrelated-tab-data'), 'KEEP');

  for (const encoded of [
    '{malformed', '[]', 'null', '1', '"fake"', JSON.stringify({ ...direct(), version: 2 }),
    JSON.stringify({ ...direct(), capturedAt: iso(NOW - TRAFFIC_ATTRIBUTION_TTL_MS) }),
    JSON.stringify({ ...direct(), capturedAt: iso(NOW + 1) }), 'x'.repeat(MAX_TRAFFIC_SESSION_LENGTH + 1),
  ]) {
    storage.setItem(TRAFFIC_ATTRIBUTION_SESSION_KEY, encoded);
    const next = f.session().initialize()!;
    assert.equal(next.source, 'direct_unknown');
    assert.equal(next.inherited, undefined);
    assert.equal(storage.getItem('unrelated-tab-data'), 'KEEP');
  }
});

test('privacy-minimized storage holds one bounded sanitized snapshot, not raw arrival data or a visit history', () => {
  const f = fixture();
  f.setBrowser({
    url: `${ORIGIN}/campaigns/gau-seva?utm_source=ig&utm_campaign=autumn&fbclid=FAKE_RAW_CLICK&email=FAKE_EMAIL&token=FAKE_TOKEN#FAKE_HASH`,
    referrer: 'https://l.instagram.com/FAKE_PATH?token=FAKE_REFERRER_SECRET', navigationType: 'navigate',
  });
  f.session().initialize();
  const storage = f.storage as MemoryStorage;
  assert.equal(storage.data.size, 1);
  const stored = storage.getItem(TRAFFIC_ATTRIBUTION_SESSION_KEY)!;
  assert.ok(stored.length <= MAX_TRAFFIC_SESSION_LENGTH);
  assert.doesNotMatch(stored, /FAKE_|https:|email|token|userAgent|history/);
  f.setBrowser({ url: `${ORIGIN}/?utm_source=google`, referrer: '', navigationType: 'navigate' });
  f.setTime(NOW + 1000);
  f.session().initialize();
  assert.equal(storage.data.size, 1);
  assert.doesNotMatch(storage.getItem(TRAFFIC_ATTRIBUTION_SESSION_KEY)!, /instagram/);
});

test('blocked storage access/read/write/remove is nonfatal with memory fallback and no repeated failing access', () => {
  let calls = 0;
  const denied = () => { calls += 1; throw new Error('Synthetic storage denied'); };
  const browser = () => ({ url: `${ORIGIN}/?utm_source=wa`, referrer: '', navigationType: 'navigate' });
  const deniedAccess = createTrafficAttributionSession({ now: () => NOW, readBrowser: browser, getStorage: denied });
  assert.equal(deniedAccess.initialize()?.source, 'whatsapp');
  assert.equal(deniedAccess.getForCheckout()?.source, 'whatsapp');
  deniedAccess.reset();
  assert.equal(calls, 1);

  for (const operation of ['getItem', 'setItem', 'removeItem'] as const) {
    const storage = new MemoryStorage();
    if (operation === 'removeItem') storage.setItem(TRAFFIC_ATTRIBUTION_SESSION_KEY, '{invalid');
    storage[operation] = denied;
    const f = fixture(storage);
    const session = f.session();
    assert.equal(session.initialize()?.source, 'instagram', operation);
    assert.equal(session.getForCheckout()?.source, 'instagram', operation);
    session.reset();
    assert.equal(session.initialize()?.source, 'instagram', operation);
  }
});

test('reset removes only our key and allows fresh capture; a fresh tab has no inherited profile', () => {
  const storage = new MemoryStorage();
  storage.setItem('staff-or-unrelated', 'KEEP');
  const f = fixture(storage);
  const session = f.session();
  session.initialize();
  session.reset();
  assert.equal(storage.getItem(TRAFFIC_ATTRIBUTION_SESSION_KEY), null);
  assert.equal(storage.getItem('staff-or-unrelated'), 'KEEP');
  f.setTime(NOW + 1000);
  f.setBrowser({ url: `${ORIGIN}/?utm_source=telegram`, referrer: '', navigationType: 'navigate' });
  assert.equal(session.initialize()?.source, 'telegram');
  assert.equal(session.getForCheckout()?.inherited, undefined);
  const anotherTab = fixture();
  anotherTab.setBrowser({ url: ORIGIN, referrer: '', navigationType: 'navigate' });
  assert.deepEqual(anotherTab.session().initialize(), direct());
});

test('SSR, unavailable document/window/location or failed browser capture emit no snapshot rather than direct_unknown', () => {
  for (const descriptors of [
    { window: { value: undefined }, document: { value: undefined } },
    { window: { get() { throw new Error('No window'); } }, document: { value: {} } },
    { window: { value: { location: { href: ORIGIN } } }, document: { value: undefined } },
    { window: { value: { location: { href: ORIGIN } } }, document: { get() { throw new Error('No document'); } } },
    { window: { value: { get location() { throw new Error('No location'); } } }, document: { value: { referrer: '' } } },
    { window: { value: { location: { href: ORIGIN } } }, document: { value: { get referrer() { throw new Error('No referrer access'); } } } },
  ]) {
    withGlobals(descriptors, () => {
      const session = createTrafficAttributionSession({ now: () => NOW });
      assert.equal(session.initialize(), undefined);
      assert.equal(session.getForCheckout(), undefined);
    });
  }
  const f = fixture();
  f.session().initialize();
  f.setBrowser(undefined);
  assert.equal(f.session().initialize(), undefined, 'unavailable browser cannot replay a stored profile');
  const current = fixture();
  const session = current.session();
  session.initialize();
  current.setTime(NOW + TRAFFIC_ATTRIBUTION_TTL_MS);
  current.setBrowser(undefined);
  assert.equal(session.getForCheckout(), undefined, 'expiry with unavailable browser does not fabricate direct');
});

test('successful browser boundary capture never accesses cookies, localStorage, UA or a third-party network', () => {
  const forbidden = () => { throw new Error('Forbidden browser access'); };
  const storage = new MemoryStorage();
  withGlobals({
    window: { value: {
      location: { href: `${ORIGIN}/?utm_source=ig` }, sessionStorage: storage,
      get localStorage() { return forbidden(); }, get navigator() { return forbidden(); },
      performance: { getEntriesByType: () => [{ type: 'navigate' }] },
      fetch: forbidden, fbq: forbidden,
    } },
    document: { value: { referrer: '', get cookie() { return forbidden(); }, set cookie(_value: string) { forbidden(); } } },
    fetch: { value: forbidden }, navigator: { get: forbidden },
  }, () => {
    const session = createTrafficAttributionSession({ now: () => NOW });
    assert.equal(session.initialize()?.source, 'instagram');
    assert.equal(session.getForCheckout()?.source, 'instagram');
  });
});

test('public singleton helpers are SSR safe and successful empty browser capture is direct_unknown', () => {
  withGlobals({ window: { value: undefined }, document: { value: undefined } }, () => {
    resetTrafficAttributionSession();
    assert.equal(initializeTrafficAttribution(), undefined);
    assert.equal(getTrafficAttributionForCheckout(), undefined);
  });
  withGlobals({
    window: { value: { location: { href: ORIGIN }, sessionStorage: new MemoryStorage() } },
    document: { value: { referrer: '' } },
  }, () => {
    resetTrafficAttributionSession();
    assert.equal(initializeTrafficAttribution()?.source, 'direct_unknown');
    assert.equal(getTrafficAttributionForCheckout()?.evidence, 'none');
    resetTrafficAttributionSession();
  });
});

test('wiring captures before React render and freezes attribution into initiation only, never verifier requests', async () => {
  const main = await readFile(new URL('../frontend/src/main.tsx', import.meta.url), 'utf8');
  assert.ok(main.indexOf('initializeTrafficAttribution();') < main.indexOf('createRoot(document'));
  const modal = await readFile(new URL('../frontend/src/components/DonationModal.tsx', import.meta.url), 'utf8');
  assert.equal((modal.match(/trafficAttribution:\s*getTrafficAttributionForCheckout\(\)/g) ?? []).length, 1);
  const initialPayload = modal.slice(modal.indexOf('const payload = {'), modal.indexOf("fetch('/api/donations/initiate'"));
  assert.match(initialPayload, /trafficAttribution: getTrafficAttributionForCheckout\(\)/);
  assert.match(initialPayload, /metaTracking: collectMetaTrackingPayload\(metaTrackingConsent\)/);
  for (const verifier of modal.matchAll(/fetch\('\/api\/donations\/verify-razorpay',[\s\S]*?body: JSON\.stringify\(\{([\s\S]*?)\}\)/g)) {
    assert.doesNotMatch(verifier[1], /trafficAttribution/);
  }
});

test('privacy copy explains first-party session summary, internal donation snapshot and uncertain source without changing optional Meta consent', () => {
  const html = renderToStaticMarkup(React.createElement(LegalPage, { kind: 'privacy', language: 'en' }));
  for (const phrase of [/up to 30 minutes/, /current browser tab/, /saved with the donation/, /no persistent cross-visit visitor profile/,
    /raw advertising click IDs/, /best-effort/, /Direct \/ unknown/, /Unknown \/ not recorded/, /separate, unchecked choice/, /not existing sitewide Meta PageView tracking/]) {
    assert.match(html, phrase);
  }
  assert.doesNotMatch(html, /session storage only for the staff admin key/);
});

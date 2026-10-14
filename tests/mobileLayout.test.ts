import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { hasGenericMobileDonationBar, observeMobileDonationBar } from '../frontend/src/utils/mobileLayout';

test('only landing and generic campaign details mount the shared mobile bar', () => {
  assert.equal(hasGenericMobileDonationBar('landing'), true);
  assert.equal(hasGenericMobileDonationBar('campaign-detail', 'new-campaign'), true);
  for (const id of ['', 'c1', 'detail']) assert.equal(hasGenericMobileDonationBar('campaign-detail', id), false);
  for (const page of ['crowd', 'second-campaign', 'tuesday-campaign', 'fourth-campaign',
    'fifth-campaign', 'birthday-campaign', 'navratri-campaign', 'blogs', 'privacy',
    'terms', 'refund', 'thank-you', 'my-donations', 'admin']) {
    assert.equal(hasGenericMobileDonationBar(page), false, page);
  }
});

test('each full-widget campaign has exactly one marked mobile bar', async () => {
  for (const page of ['TuesdayCampaignPage', 'SecondCampaignPage', 'LegacyCrowdFundingPage']) {
    const source = await readFile(new URL(`../frontend/src/pages/${page}.tsx`, import.meta.url), 'utf8');
    assert.equal((source.match(/<div data-mobile-donation-bar/g) || []).length, 1, page);
    const mobileBars = source.match(/<div[^>]*className="[^"]*fixed bottom-0[^"]*sm:hidden[^>]*>/g) || [];
    assert.equal(mobileBars.length, 1, page);
    assert.match(mobileBars[0], /overflow-y-auto/);
    assert.match(mobileBars[0], /45dvh/);
    assert.match(mobileBars[0], /safe-area-inset-bottom/);
  }
});

test('full-widget campaign desktop donation controls do not duplicate the mobile bar', async () => {
  const second = await readFile(new URL('../frontend/src/pages/SecondCampaignPage.tsx', import.meta.url), 'utf8');
  const legacy = await readFile(new URL('../frontend/src/pages/LegacyCrowdFundingPage.tsx', import.meta.url), 'utf8');
  const contribution = await readFile(new URL('../frontend/src/components/campaign/CauseContributionSection.tsx', import.meta.url), 'utf8');
  assert.match(second, /hideDonationOnMobile/);
  assert.match(contribution, /hideDonationOnMobile \? 'hidden sm:block '/);
  assert.match(legacy, /<div className="hidden sm:block">/);
  assert.match(legacy, /Donation amount presets/);
});

test('Tuesday campaign keeps the full donation widget desktop-only', async () => {
  const source = await readFile(new URL('../frontend/src/pages/TuesdayCampaignPage.tsx', import.meta.url), 'utf8');
  assert.match(source, /<div className="mt-4 hidden sm:block rounded-2xl border border-orange-100/);
  assert.match(source, /<div data-mobile-donation-bar className="[^\"]*fixed bottom-0[^\"]*sm:hidden/);
  assert.match(source, /aria-describedby=\{amountError \? 'desktop-donation-amount-error' : undefined\}/);
  assert.match(source, /id="desktop-donation-amount-error"/);
});

test('all full-widget mobile bars keep amount input and donation CTA half-and-half', async () => {
  for (const page of ['TuesdayCampaignPage', 'SecondCampaignPage', 'LegacyCrowdFundingPage']) {
    const source = await readFile(new URL(`../frontend/src/pages/${page}.tsx`, import.meta.url), 'utf8');
    assert.match(source, /flex items-stretch overflow-hidden rounded-xl border-2/);
    assert.ok((source.match(/w-1\/2 min-w-0/g) || []).length >= 2, page);
    assert.match(source, /border-l-2 border-orange-200 bg-\[#FF6B00\]/);
    assert.doesNotMatch(source, /<span>Donate Now<\/span>[\s\S]*?<\/button>\s*\n\s*<div className="grid grid-cols-2 gap-2 mt-2/);
  }
});

test('all campaign product cards use the unified orange minus-price-plus control', async () => {
  const files = [
    '../frontend/src/components/campaign/CauseContributionSection.tsx',
    '../frontend/src/pages/TuesdayCampaignPage.tsx',
    '../frontend/src/pages/LegacyCrowdFundingPage.tsx',
  ];
  for (const file of files) {
    const source = await readFile(new URL(file, import.meta.url), 'utf8');
    assert.match(source, /bg-\[#FF6B00\] text-white shadow-2xs/);
    assert.match(source, /border-r border-white\/35/);
    assert.match(source, /border-l border-white\/35/);
    assert.match(
      source,
      /aria-label=\{\s*(?:`Add |(?:qty|inCartQty)\s*>\s*0)/,
      'the center control must label its add action or announce the selected quantity',
    );
    assert.match(source, /Add .* worth ₹/);
  }
});

test('mobile spacing follows lazy mounts, resized and hidden bars, viewport changes, and cleanup', (t) => {
  const values = new Map<string, string>();
  const media = { matches: true };
  let bars: any[] = [];
  let onMutate: (records: any[]) => void = () => {};
  let onResize: () => void = () => {};
  const frames = new Map<number, () => void>();
  const events = new Map<string, () => void>();
  let nextFrame = 0;
  let disconnected = 0;
  const originals = new Map<string, PropertyDescriptor | undefined>();
  const setGlobal = (name: string, value: unknown) => {
    originals.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
  };
  t.after(() => originals.forEach((descriptor, name) => {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else Reflect.deleteProperty(globalThis, name);
  }));
  const root = { style: {
    getPropertyValue: (key: string) => values.get(key) || '',
    setProperty: (key: string, value: string) => values.set(key, value),
    removeProperty: (key: string) => values.delete(key),
  } };
  setGlobal('document', { documentElement: root, body: {}, querySelectorAll: () => bars });
  setGlobal('window', {
    innerHeight: 700, matchMedia: () => media, getComputedStyle: (bar: any) => bar.style,
    requestAnimationFrame: (callback: () => void) => { frames.set(++nextFrame, callback); return nextFrame; },
    cancelAnimationFrame: (id: number) => frames.delete(id),
    addEventListener: (name: string, callback: () => void) => events.set(name, callback),
    removeEventListener: (name: string) => events.delete(name),
  });
  setGlobal('ResizeObserver', class {
    constructor(callback: () => void) { onResize = callback; }
    observe() {} unobserve() {} disconnect() { disconnected++; }
  });
  setGlobal('MutationObserver', class {
    constructor(callback: (records: any[]) => void) { onMutate = callback; }
    observe() {} disconnect() { disconnected++; }
  });
  const flush = () => { const pending = [...frames.values()]; frames.clear(); pending.forEach((callback) => callback()); };
  const height = () => values.get('--mobile-donation-bar-height');
  const stop = observeMobileDonationBar();
  assert.equal(height(), '0px');
  let barHeight = 240;
  const bar = { style: { display: 'block', visibility: 'visible', opacity: '1' },
    getBoundingClientRect: () => ({ width: 320, height: barHeight, top: 700 - barHeight, bottom: 700 }) };
  bars = [bar]; onMutate([{ type: 'childList' }]); flush();
  assert.equal(height(), '240px');
  barHeight = 260.2; onResize(); flush(); assert.equal(height(), '261px');
  bar.style.display = 'none'; onMutate([{ type: 'attributes', target: bar }]); flush();
  assert.equal(height(), '0px');
  bar.style.display = 'block'; media.matches = false; events.get('resize')!(); flush();
  assert.equal(height(), '0px');
  media.matches = true; events.get('resize')!(); flush(); assert.equal(height(), '261px');
  bars = []; onMutate([{ type: 'childList' }]); flush(); assert.equal(height(), '0px');
  stop(); assert.equal(height(), undefined); assert.equal(disconnected, 2); assert.equal(events.size, 0);
});

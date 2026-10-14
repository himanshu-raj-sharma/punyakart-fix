import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { build } from 'esbuild';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { PublicCampaign } from '../frontend/src/hooks/usePublicCampaign';
import type { PublicSnapshot } from '../frontend/src/utils/publicCampaignPolling';
import { getCampaignDonationSelection } from '../frontend/src/utils/campaignDiscovery';

// In-memory SSR fixture, not a production build or a browser/effects test.
const bundle = await build({
  stdin: { contents: "export { CampaignDetailPage } from './frontend/src/pages/CampaignDetailPage';", resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, write: false, platform: 'node', format: 'cjs', packages: 'external',
  loader: { '.jpg': 'dataurl', '.jpeg': 'dataurl', '.png': 'dataurl', '.webp': 'dataurl' },
  plugins: [{
    name: 'generic-campaign-snapshot-fixture',
    setup(builder) {
      builder.onResolve({ filter: /hooks\/usePublicCampaign$/ }, () => ({ path: 'snapshot', namespace: 'fixture' }));
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({
        contents: 'export function usePublicCampaign(id) { globalThis.requestedCampaignId = id; return globalThis.campaignSnapshot; }', loader: 'js',
      }));
    },
  }],
});
const compiled = { exports: {} as { CampaignDetailPage: React.ComponentType<{ campaignId: string; language: string; onOpenCheckout: () => void }> } };
const context = {
  module: compiled, exports: compiled.exports, require: createRequire(import.meta.url), console,
  campaignSnapshot: { campaign: null as PublicCampaign | null, status: 'loading' as PublicSnapshot<PublicCampaign>['status'] },
  requestedCampaignId: '',
};
runInNewContext(bundle.outputFiles[0].text, context);
const record: PublicCampaign = {
  id: 'cms-custom', title: 'Generic CMS title', category: 'Care category', organizer: 'CMS organizer',
  is_active: true, raised: 501, donors: 2, target: 0, image: '/cms.jpg',
  content: { hero_subtitle: 'Generic CMS subtitle', section_visibility: { allocation: false } },
};
function render(campaign: PublicCampaign | null, status: PublicSnapshot<PublicCampaign>['status']) {
  context.campaignSnapshot = { campaign, status };
  return renderToStaticMarkup(React.createElement(compiled.exports.CampaignDetailPage, {
    campaignId: record.id, language: 'en', onOpenCheckout() { throw new Error('SSR must not donate'); },
  }));
}

test('generic page uses its route with shared hook and retains CMS/no-fixed-goal rendering', () => {
  const html = render(record, 'ready');
  assert.equal(context.requestedCampaignId, record.id);
  for (const text of ['Generic CMS title', 'Generic CMS subtitle', 'Care category', 'CMS organizer', '₹501 raised', 'No fixed goal']) assert.ok(html.includes(text), text);
  assert.doesNotMatch(html, /disabled=""|100%|width:/);
  assert.match(html, /Donate to this campaign/);
});

test('generic stale snapshot stays visible but disables checkout and reports refresh failure', () => {
  const html = render(record, 'error');
  assert.match(html, /Generic CMS title/);
  assert.match(html, /₹501 raised/);
  assert.match(html, /disabled=""/);
  assert.match(html, /last confirmed snapshot/);
  assert.match(html, /Donations are temporarily unavailable/);
});

test('generic explicit inactive status disables checkout and fresh active snapshot re-enables updated content', () => {
  const inactive = render({ ...record, is_active: false }, 'ready');
  assert.match(inactive, /currently inactive/);
  assert.match(inactive, /disabled=""/);
  const recovered = render({ ...record, title: 'Refreshed CMS title', raised: 750, target: 1000, donors: 3 }, 'ready');
  assert.match(recovered, /Refreshed CMS title/);
  assert.match(recovered, /₹750 raised/);
  assert.match(recovered, /75%/);
  assert.doesNotMatch(recovered, /disabled=""|last confirmed snapshot/);
});

test('generic missing source never renders a previous campaign or checkout, and missing totals stay unknown', () => {
  assert.match(render(null, 'loading'), /Loading campaign/);
  assert.match(render(null, 'error'), /Campaign unavailable/);
  const mismatch = render({ ...record, id: 'different-route' }, 'ready');
  assert.match(mismatch, /Campaign not found/);
  assert.doesNotMatch(mismatch, /Generic CMS title|Donate to this campaign/);
  const unknown = render({ ...record, raised: undefined, target: undefined, donors: undefined }, 'ready');
  assert.match(unknown, /— raised/);
  assert.doesNotMatch(unknown, /No fixed goal|₹0 raised|NaN/);
  assert.match(render({ ...record, title: '' }, 'ready'), /disabled=""/);
});

// Exercise real form handlers with isolated hook state and a receipt-download sink.
// No HTTP request, payment gateway, browser, server, or database is involved.
const formsBundle = await build({
  stdin: {
    contents: `
      export { DonationCard } from './frontend/src/components/DonationCard';
      export { ManualReceiptTab } from './frontend/src/components/admin/ManualReceiptTab';
      export { CauseContributionSection } from './frontend/src/components/campaign/CauseContributionSection';
      export { RescueStoriesCarousel } from './frontend/src/components/campaign/RescueStoriesCarousel';
    `,
    resolveDir: process.cwd(), loader: 'ts',
  },
  bundle: true, write: false, platform: 'node', format: 'cjs', packages: 'external',
  loader: { '.jpg': 'dataurl', '.jpeg': 'dataurl', '.png': 'dataurl', '.webp': 'dataurl' },
  plugins: [{
    name: 'receipt-download-sink',
    setup(builder) {
      builder.onResolve({ filter: /admin\/adminApi$/ }, () => ({ path: 'receipt', namespace: 'fixture' }));
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({
        contents: 'export async function downloadAdminPdf(...args) { globalThis.receipts.push(JSON.parse(args[3].body)); }', loader: 'js',
      }));
    },
  }],
});

function formFixture() {
  const states: unknown[] = [];
  let cursor = 0;
  const receipts: { amount: number }[] = [];
  const local = { exports: {} as Record<string, (props: any) => React.ReactNode> };
  const nodeRequire = createRequire(import.meta.url);
  const fixtureReact = {
    ...React,
    useState(initial: unknown) {
      const index = cursor++;
      if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial;
      return [states[index], (next: unknown) => { states[index] = typeof next === 'function' ? next(states[index]) : next; }];
    },
  };
  runInNewContext(formsBundle.outputFiles[0].text, {
    module: local, exports: local.exports, console, receipts,
    require: (name: string) => name === 'react' ? fixtureReact : nodeRequire(name),
  });
  return {
    receipts,
    render(name: string, props: Record<string, unknown>) {
      cursor = 0;
      return local.exports[name](props);
    },
  };
}

function elements(node: React.ReactNode): React.ReactElement<any>[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!React.isValidElement<{ children?: React.ReactNode }>(node)) return [];
  return [node, ...elements(node.props.children)];
}

test('Chennai one-time and monthly custom entry reject ₹199 and open checkout at ₹200', () => {
  for (const donationType of ['one-time', 'monthly']) {
    const fixture = formFixture();
    const checkouts: { amount: number; source: string }[] = [];
    const props = {
      source: 'chennai_airport', language: 'en', donationType, selectedAmount: 5000,
      onDonationTypeChange() {}, onAmountChange() {},
      onOpenCheckout: (donation: { amount: number; source: string }) => checkouts.push(donation),
    };
    for (const amount of ['199', '200']) {
      let tree = fixture.render('DonationCard', props);
      const input = elements(tree).find((element) => element.type === 'input' && element.props.inputMode === 'numeric')!;
      assert.equal(input.props.min, 200);
      input.props.onChange({ target: { value: amount } });
      tree = fixture.render('DonationCard', props);
      elements(tree).find((element) => element.type === 'form')!.props.onSubmit({ preventDefault() {} });
      assert.equal(checkouts.length, amount === '199' ? 0 : 1);
    }
    assert.equal(checkouts[0].amount, 200);
    assert.equal(checkouts[0].source, 'chennai_airport');
  }
});

test('manual receipt input and submission enforce ₹200 before any receipt download', async () => {
  const fixture = formFixture();
  let created = 0;
  const props = { adminKey: '', onCreated() { created += 1; } };
  const initial = elements(fixture.render('ManualReceiptTab', props));
  initial.find((element) => element.type === 'select')!.props.onChange({ target: { value: 'cash' } });
  initial.find((element) => element.props.placeholder === 'Staff name who is issuing this receipt')!.props.onChange({ target: { value: 'Test staff' } });
  initial.find((element) => element.type === 'input' && element.props.type === 'checkbox')!.props.onChange({ target: { checked: true } });
  for (const amount of ['199', '200']) {
    let tree = fixture.render('ManualReceiptTab', props);
    const input = elements(tree).find((element) => element.type === 'input' && element.props.type === 'number')!;
    assert.equal(input.props.min, 200);
    assert.equal(input.props.max, 10_000_000);
    assert.equal(input.props.step, '1');
    input.props.onChange({ target: { value: amount } });
    tree = fixture.render('ManualReceiptTab', props);
    await elements(tree).find((element) => element.type === 'form')!.props.onSubmit({ preventDefault() {} });
    assert.equal(fixture.receipts.length, amount === '199' ? 0 : 1);
  }
  assert.equal(fixture.receipts[0].amount, 200);
  assert.equal(created, 1);
});

test('legacy CMS amounts below ₹200 leave valid contribution presets and support actions', () => {
  const navratriCard = { id: 'navratri', title: 'Navratri', category: 'Faith', organizer: 'Foundation', image: '', hasTaxBenefit: false };
  for (const donationPresets of [[], [100, 101, 199], undefined]) {
    assert.equal(getCampaignDonationSelection({ ...navratriCard, donationPresets })[1], 200);
  }
  assert.equal(getCampaignDonationSelection({ ...navratriCard, donationPresets: [199, 501, 1001] })[1], 501);
  const fixture = formFixture();
  const selected: number[] = [];
  const props = {
    onDonateAmount() {}, onOpenTaxModal() {}, cart: [], onUpdateCartQty() {},
    customAmountValue: '', onCustomAmountChange() {}, selectedPreset: null,
    onPresetChange: (amount: number) => selected.push(amount),
    presets: [100, 101, 199],
  };
  for (const presets of [[100, 101, 199], [100, 200, 501]]) {
    const tree = fixture.render('CauseContributionSection', { ...props, presets });
    const buttons = elements(tree).filter((element) => element.type === 'button'
      && Array.isArray(element.props.children) && element.props.children[0] === '₹');
    assert.ok(buttons.length > 0, 'old invalid-only presets must have valid fallbacks');
    selected.length = 0;
    buttons.forEach((button) => button.props.onClick());
    assert.deepEqual(selected, presets.includes(200) ? [200, 501] : [1000, 2000, 5000, 10000]);
  }
  const supportAmounts: number[] = [];
  const tree = formFixture().render('RescueStoriesCarousel', {
    content: { about_cards: [{ id: 'old', supportAmount: 199 }] },
    onSupportStory: (amount: number) => supportAmounts.push(amount),
  });
  const actions = elements(tree).filter((element) => element.props.role === 'button' && element.props.onClick);
  assert.ok(actions.length > 0);
  actions.forEach((action) => action.props.onClick());
  assert.ok(supportAmounts.length > 0);
  assert.ok(supportAmounts.every((amount) => amount >= 200));
});

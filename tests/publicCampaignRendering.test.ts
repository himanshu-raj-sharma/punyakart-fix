import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { build } from 'esbuild';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// Isolated in-memory SSR only: inject campaign snapshots without effects, API or DB access.
const bundle = await build({
  stdin: {
    contents: `export { TuesdayCampaignPage } from './frontend/src/pages/TuesdayCampaignPage';
      export { SecondCampaignPage } from './frontend/src/pages/SecondCampaignPage';
      export { LegacyCrowdFundingPage } from './frontend/src/pages/LegacyCrowdFundingPage';
      export { CampaignsDiscoverySection } from './frontend/src/components/campaign/CampaignsDiscoverySection';`,
    resolveDir: process.cwd(), loader: 'ts',
  },
  bundle: true, write: false, platform: 'node', format: 'cjs', packages: 'external',
  loader: { '.jpg': 'dataurl', '.jpeg': 'dataurl', '.png': 'dataurl', '.webp': 'dataurl' },
  plugins: [{
    name: 'campaign-snapshot-fixture',
    setup(builder) {
      builder.onResolve({ filter: /hooks\/usePublicCampaign$/ }, () => ({ path: 'snapshot', namespace: 'fixture' }));
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({
        contents: 'export function usePublicCampaign() { return globalThis.campaignSnapshot; }', loader: 'js',
      }));
    },
  }],
});
const compiled = { exports: {} as Record<string, React.ComponentType<any>> };
const context = {
  module: compiled, exports: compiled.exports, require: createRequire(import.meta.url), console,
  campaignSnapshot: { campaign: null as any, status: 'loading' },
};
runInNewContext(bundle.outputFiles[0].text, context);
const Page = compiled.exports.TuesdayCampaignPage;
const renderPage = (campaignId: string) => renderToStaticMarkup(React.createElement(Page, {
  campaignId, onOpenCheckout() { throw new Error('SSR must not donate'); }, onOpen80GSearch() {},
}));

test('discovery first render includes Navratri and seven visibly nonpayable previews with unknown stats', () => {
  const html = renderToStaticMarkup(React.createElement(compiled.exports.CampaignsDiscoverySection, { onDonateClick() {} }));
  assert.match(html, /Navratri/);
  assert.equal((html.match(/Preview — donations unavailable/g) || []).length, 7);
  assert.equal((html.match(/disabled=""/g) || []).length, 7);
  assert.equal((html.match(/Raised: —/g) || []).length, 7);
  assert.doesNotMatch(html, /25,000|335,795|Donors: 34|No fixed target/);
});

test('every dedicated c1-c7 page uses the shared material allocation table', () => {
  const renderers: Record<string, React.ComponentType<any>> = {
    c1: compiled.exports.LegacyCrowdFundingPage,
    c2: compiled.exports.SecondCampaignPage,
    c3: Page,
    c4: Page,
    c5: Page,
    c6: Page,
    c7: Page,
  };
  for (const campaignId of Object.keys(renderers)) {
    context.campaignSnapshot = { status: 'ready', campaign: { id: campaignId, is_active: true, content: {} } };
    const html = renderToStaticMarkup(React.createElement(renderers[campaignId], {
      campaignId,
      language: 'en',
      amount: 1000,
      onAmountAndCauseTitleChange() {},
      onOpenCheckout() {},
      onOpen80GSearch() {},
    }));
    const section = html.match(/<section id="where-money-goes"[\s\S]*?<\/section>/)?.[0] || '';
    assert.match(section, /Where Your Money Goes\?/i, campaignId);
    for (const heading of ['Material', 'Required Qty', 'Price\/Unit']) assert.match(section, new RegExp(heading), campaignId);
    assert.doesNotMatch(section, /Contribution|Purpose/);
    assert.equal((section.match(/<tr\b/g) || []).length, 5, campaignId);
  }
});

test('allocation prices follow CMS contribution-card prices for C2-C7', () => {
  const cards = [601, 701, 801, 901].map((price, index) => ({
    id: `cms-allocation-${index}`,
    title: `CMS Material ${index + 1}`,
    subtitle: 'Configured allocation item',
    unit: 'unit',
    price,
    image: '/cms-allocation.jpg',
  }));
  for (const campaignId of ['c2', 'c3', 'c4', 'c5', 'c6', 'c7']) {
    context.campaignSnapshot = { status: 'ready', campaign: {
      id: campaignId, is_active: true, content: { contribution_cards: cards },
    } };
    const Renderer = campaignId === 'c2' ? compiled.exports.SecondCampaignPage : Page;
    const html = renderToStaticMarkup(React.createElement(Renderer, {
      campaignId,
      language: 'en',
      amount: 1000,
      onAmountAndCauseTitleChange() {},
      onOpenCheckout() {},
      onOpen80GSearch() {},
    }));
    const section = html.match(/<section id="where-money-goes"[\s\S]*?<\/section>/)?.[0] || '';
    for (const price of cards.map((card) => `₹${card.price.toLocaleString('en-IN')}`)) assert.match(section, new RegExp(price.replace('₹', '₹')), campaignId);
  }
});

test('all shared campaigns disable checkout until active availability is confirmed, including stale snapshots', () => {
  for (const campaignId of ['c3', 'c4', 'c5', 'c6', 'c7']) {
    for (const [status, active] of [['loading', true], ['error', true], ['ready', false]] as const) {
      context.campaignSnapshot = { status, campaign: { id: campaignId, is_active: active, raised: 501 } };
      const html = renderPage(campaignId);
      assert.ok((html.match(/disabled=""/g) || []).length >= 3, `${campaignId} ${status}`);
      assert.match(html, /[Dd]onations are (?:temporarily )?unavailable/);
      if (status === 'error') assert.match(html, /last confirmed snapshot/);
    }
  }
});

test('Second and Legacy show failed availability and disable their owned checkout buttons', () => {
  for (const [name, campaignId, disabledCount] of [['SecondCampaignPage', 'c2', 1], ['LegacyCrowdFundingPage', 'c1', 4]] as const) {
    context.campaignSnapshot = { status: 'error', campaign: { id: campaignId, is_active: true, raised: 501 } };
    const html = renderToStaticMarkup(React.createElement(compiled.exports[name], {
      campaignId, language: 'en', amount: 1000, onAmountAndCauseTitleChange() {}, onOpenCheckout() {}, onOpen80GSearch() {},
    }));
    assert.match(html, /Donations are temporarily unavailable/);
    assert.match(html, /last confirmed snapshot/);
    assert.ok((html.match(/disabled=""/g) || []).length >= disabledCount);
  }
});

test('C3-C6 use valid CMS subtitle, banner, contribution and about cards; allocation stays standardized', () => {
  for (const campaignId of ['c3', 'c4', 'c5', 'c6']) {
    context.campaignSnapshot = { status: 'ready', campaign: {
      id: campaignId, is_active: true,
      content: {
        hero_title: 'Configured heading', hero_subtitle: 'Configured subtitle', about_banner_description: 'Configured banner',
        contribution_cards: [{ id: 'cms-item', title: 'Configured item', subtitle: 'Configured item subtitle', unit: 'kit', price: 501, image: '/cms.jpg' }],
        about_cards: [{ id: 'cms-about', line1: 'Configured story', line2: 'Configured story detail', line3: 'Configured story appeal', supportAmount: 501, image: '/cms.jpg' }],
        allocation_rows: [{ amount: 'BAD', purpose: 'Do not use CMS allocation override' }],
      },
    } };
    const html = renderPage(campaignId);
    for (const marker of ['Configured heading', 'Configured subtitle', 'Configured banner', 'Configured item', 'Configured story', 'id="impact-card-cms-item"']) {
      assert.ok(html.includes(marker), `${campaignId}: ${marker}`);
    }
    assert.doesNotMatch(html, /Do not use CMS allocation override/);
  }
});

test('invalid CMS cards preserve each campaign default cards', () => {
  for (const [campaignId, defaultId] of [['c3', 't-green-grass'], ['c4', 'gau-green-grass'], ['c5', 'gau-green-grass'], ['c6', 'birthday-meal']]) {
    context.campaignSnapshot = { status: 'ready', campaign: { id: campaignId, is_active: true, content: {
      contribution_cards: [{ id: 'invalid', price: 0 }], about_cards: [{ id: 'invalid', supportAmount: 0 }],
    } } };
    const html = renderPage(campaignId);
    assert.doesNotMatch(html, /id="impact-card-invalid"/);
    assert.match(html, /aria-label="Support story:/);
    if (campaignId !== 'c6') assert.ok(html.includes(`id="impact-card-${defaultId}"`));
    else assert.ok((html.match(/id="impact-card-/g) || []).length >= 4);
  }
});

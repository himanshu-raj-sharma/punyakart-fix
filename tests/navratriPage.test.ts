import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import { build } from 'esbuild';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { NAVRATRI_DEFAULT_CAMPAIGN } from '../frontend/src/data/navratriCampaign';

// Bundle image imports in memory for SSR; no files, server, DB, network or effects are run.
const bundle = await build({
  entryPoints: [fileURLToPath(new URL('../frontend/src/pages/TuesdayCampaignPage.tsx', import.meta.url))],
  bundle: true, write: false, platform: 'node', format: 'cjs', packages: 'external',
  loader: { '.jpg': 'dataurl', '.jpeg': 'dataurl', '.png': 'dataurl', '.webp': 'dataurl' },
});
const compiled = { exports: {} as { TuesdayCampaignPage: React.ComponentType<any> } };
runInNewContext(bundle.outputFiles[0].text, { module: compiled, exports: compiled.exports, require: createRequire(import.meta.url), console });
const Page = compiled.exports.TuesdayCampaignPage;
function render(campaignId: string) {
  return renderToStaticMarkup(React.createElement(Page, {
    campaignId, onOpenCheckout() { throw new Error('SSR must not initiate checkout'); }, onOpen80GSearch() {},
  }));
}
const thursday = render('c5');
const navratri = render('navratri');

test('Navratri renders the SAME ordered section containers and layout classes as Thursday C5', () => {
  const sections = (html: string) => html.match(/<section\b[^>]*>/g);
  assert.deepEqual(sections(navratri), sections(thursday));
  assert.ok(sections(navratri)!.length >= 7);
  for (const marker of ['id="choose-cause"', 'id="rescue-stories"', 'MAKE A DONATION', 'Live Wall of Compassion']) {
    assert.ok(navratri.includes(marker), marker);
    assert.ok(thursday.includes(marker), marker);
  }
});

test('Navratri uses the supplied 16:9 hero and Navratri copy, not the abandoned simple layout', () => {
  assert.equal(NAVRATRI_DEFAULT_CAMPAIGN.image, '/navratri-hero.jpg');
  const hero = navratri.match(/<img\b[^>]*src="\/navratri-hero.jpg"[^>]*>/)?.[0];
  assert.ok(hero);
  assert.match(navratri, /aspect-\[16\/9\]/);
  assert.match(navratri, /aria-label="THIS NAVRATRI, LET YOUR DEVOTION BECOME THEIR HOPE"/);
  assert.match(navratri, /text-\[#FF6B00\]">NAVRATRI,<\/span>/);
  assert.match(navratri, /font-playfair font-normal">DEVOTION<\/span>/);
  assert.match(navratri, /font-playfair font-normal">HOPE<\/span>/);
  assert.match(navratri, /While we seek Maa Durga’s blessings, 1,400 voiceless souls are waiting for food, care, and protection\./);
  assert.match(navratri, /This Navratri, let your Seva become their strength\./);
  assert.match(navratri, /🪔 Worship Maa Durga through compassion\./);
  assert.doesNotMatch(navratri, /This Thursday|Active Every Tuesday|Grand Tuesday|navratri-seva\.svg|Decorative festival illustration/);
  assert.match(thursday, /Thursday/);
});

test('Navratri keeps the four C5 contribution cards and three C5 about cards pending supplied content', () => {
  for (const id of ['gau-green-grass', 'gau-fodder', 'gau-medicine-kit', 'gau-vegetables']) {
    assert.ok(navratri.includes(`id="impact-card-${id}"`));
    assert.ok(thursday.includes(`id="impact-card-${id}"`));
  }
  const storyButtons = (html: string) => html.match(/aria-label="Support story:[^"]*"/g);
  assert.equal(storyButtons(thursday)?.length, 3);
  assert.deepEqual(storyButtons(navratri), storyButtons(thursday));
  assert.match(navratri, /Decrease quantity of Green Grass/);
  assert.match(navratri, /Increase quantity of Green Grass/);
});

test('campaign story captions use the full card width below each photo on mobile', () => {
  assert.match(navratri, /grid grid-cols-1 sm:grid-cols-3/);
  assert.match(navratri, /class="flex-1 w-full min-w-0"/);
  assert.doesNotMatch(navratri, /<span className="block">\{card\.line1\}/);
});

test('Navratri allocation lists the four materials with requested quantities and card prices', () => {
  for (const marker of ['Where Your Money Goes?', 'Material', 'Required Qty', 'Price/Unit', 'Green Grass', 'Fodder', 'Medicine Kit', 'Vegetables', '1,000', '1,500', '1,200', '₹550', '₹1,150', '₹1,250', '₹750']) {
    assert.ok(navratri.includes(marker), marker);
  }
  assert.doesNotMatch(navratri, /WHERE YOUR CONTRIBUTION CAN HELP|Contribution.*Purpose/);
});

test('Navratri preview cannot claim live donors, totals or tax benefits while backend is unavailable', () => {
  assert.match(navratri, /Campaign preview: donations are unavailable/);
  assert.doesNotMatch(navratri, /Rameshwar Sharma|Pooja Venkatesh|100% Tax Exempt|50% deduction on all gifts/);
  const checkoutButtons = navratri.match(/<button\b[^>]*disabled=""[^>]*>/g) || [];
  assert.ok(checkoutButtons.length >= 3);
});

test('shared desktop and mobile donation inputs use the ₹200 whole-rupee boundary', () => {
  const inputs = navratri.match(/<input\b[^>]*aria-label="Donation amount in rupees"[^>]*>/g) || [];
  assert.equal(inputs.length, 2);
  for (const input of inputs) {
    assert.match(input, /min="200"/);
    assert.match(input, /max="10000000"/);
    assert.match(input, /step="1"/);
  }
  assert.deepEqual(NAVRATRI_DEFAULT_CAMPAIGN.donation_presets, [501, 1001, 2100, 5100]);
  assert.equal(NAVRATRI_DEFAULT_CAMPAIGN.content.allocation_rows[0].amount, '₹200');
  assert.match(NAVRATRI_DEFAULT_CAMPAIGN.faqs.find((faq) => faq.question.includes('own donation'))!.answer, /from ₹200 to/);
});

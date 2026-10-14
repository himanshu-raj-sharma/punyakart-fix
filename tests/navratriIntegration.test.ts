import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { NAVRATRI_DEFAULT_CAMPAIGN, NAVRATRI_DONATION_SOURCE } from '../frontend/src/data/navratriCampaign.js';
import { getQuickDonationSource } from '../frontend/src/utils/donationSource.js';
import { parseAppRoute } from '../frontend/src/utils/appRoutes.js';

test('Navratri route, quick-donate source, and shared checkout wiring are connected', async () => {
  assert.equal(getQuickDonationSource('navratri-campaign'), NAVRATRI_DONATION_SOURCE);
  assert.equal(parseAppRoute('/campaigns/navratri/').activePage, 'navratri-campaign');
  const app = await readFile(new URL('../frontend/src/App.tsx', import.meta.url), 'utf8');
  assert.match(app, /<TuesdayCampaignPage\s+campaignId="c7"/);
  assert.doesNotMatch(app, /import\('.\/pages\/NavratriCampaignPage'\)/);
  assert.match(app, /setSelectedCampaignId\('c7'\)/);
  assert.match(app, /openCheckout\('campaign_c7'\)/);
  assert.match(app, /campaignPathForId\(campaignId\)/);
});

test('production startup ensures the CMS record is present without overwriting existing campaigns', async () => {
  const seed = await readFile(new URL('../backend/campaignSeed.ts', import.meta.url), 'utf8');
  const server = await readFile(new URL('../server.ts', import.meta.url), 'utf8');
  assert.match(seed, /NAVRATRI_DEFAULT_CAMPAIGN/);
  assert.match(seed, /id: NAVRATRI_DEFAULT_CAMPAIGN\.id/);
  assert.match(seed, /target: NAVRATRI_DEFAULT_CAMPAIGN\.target/);
  assert.match(seed, /donation_presets: NAVRATRI_DEFAULT_CAMPAIGN\.donation_presets/);
  assert.match(seed, /if \(!existingIds\.has\(campaign\.id\)\)/);
  assert.match(server, /await seedDefaultCampaignsIfEmpty\(campaignRepo\)/);
});

test('Navratri seed has no fixed goal and uses campaign-safe presets/content', () => {
  assert.equal(NAVRATRI_DEFAULT_CAMPAIGN.target, 0);
  assert.equal(NAVRATRI_DEFAULT_CAMPAIGN.is_active, true);
  assert.deepEqual(NAVRATRI_DEFAULT_CAMPAIGN.donation_presets, [501, 1001, 2100, 5100]);
  assert.equal(NAVRATRI_DEFAULT_CAMPAIGN.has_tax_benefit, false);
  assert.match(NAVRATRI_DEFAULT_CAMPAIGN.image, /navratri-hero\.jpg$/);
});

test('campaign schema permits zero only for an explicitly no-goal CMS campaign', async () => {
  const schema = await readFile(new URL('../backend/validation/campaignSchema.ts', import.meta.url), 'utf8');
  assert.match(schema, /target: z\.number\(\)\.finite\(\)\.int\(\)\.min\(0\)/);
});

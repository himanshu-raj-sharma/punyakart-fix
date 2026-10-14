import assert from 'node:assert/strict';
import { test } from 'node:test';
import { campaignIdForSlug, campaignPathForId, canonicalCampaignId as frontendCanonicalCampaignId, resolveCampaignRouteSegment } from '../frontend/src/utils/campaignRoutes.js';
import { getCampaignShareUrl } from '../frontend/src/utils/campaignDiscovery.js';
import { normalizeDonationSource } from '../frontend/src/constants/donation.js';
import { canonicalCampaignId } from '../backend/campaignAttribution.js';

test('campaign links use readable stable slugs', () => {
  assert.equal(campaignPathForId('c1'), '/campaigns/rescue-relief');
  assert.equal(campaignPathForId('c2'), '/campaigns/pitru-paksha-seva');
  assert.equal(campaignPathForId('c3'), '/campaigns/tuesday-seva');
  assert.equal(campaignPathForId('c4'), '/campaigns/gau-seva');
  assert.equal(campaignPathForId('c5'), '/campaigns/thursday-gau-seva');
  assert.equal(campaignPathForId('c6'), '/campaigns/birthday-seva');
  assert.equal(campaignPathForId('c7'), '/campaigns/navratri');
  assert.equal(campaignPathForId('navratri'), '/campaigns/navratri');
});

test('legacy campaign URLs resolve to immutable IDs', () => {
  for (const [segment, id] of [
    ['c1', 'c1'], ['detail', 'c1'], ['second', 'c2'], ['education', 'c2'],
    ['tuesday', 'c3'], ['gau-seva', 'c4'], ['thursday-gau-seva', 'c5'],
    ['birthday', 'c6'], ['navratri', 'c7'], ['c7', 'c7'], ['pitru-paksha-seva', 'c2'],
  ] as const) {
    assert.equal(resolveCampaignRouteSegment(segment), id);
    assert.equal(campaignIdForSlug(segment), id);
  }
  assert.equal(resolveCampaignRouteSegment('%E0%A4%A'), '%E0%A4%A');
});

test('campaign sharing preserves readable route and attribution parameters', () => {
  const url = new URL(getCampaignShareUrl('c2', 'https://punyakart.example'));
  assert.equal(url.pathname, '/campaigns/pitru-paksha-seva');
  assert.equal(url.searchParams.get('utm_source'), 'whatsapp');
  assert.equal(url.searchParams.get('utm_medium'), 'share');
});

test('public campaign API aliases resolve to the same immutable IDs', () => {
  assert.equal(canonicalCampaignId('pitru-paksha-seva'), 'c2');
  assert.equal(canonicalCampaignId('tuesday-seva'), 'c3');
  assert.equal(canonicalCampaignId('rescue-relief'), 'c1');
  assert.equal(canonicalCampaignId('c2'), 'c2');
  assert.equal(frontendCanonicalCampaignId('navratri'), 'c7');
  assert.equal(frontendCanonicalCampaignId('campaign_navratri'.slice(9)), 'c7');
  assert.equal(normalizeDonationSource('campaign_navratri'), 'campaign_c7');
});

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { hasGenericMobileDonationBar } from '../frontend/src/utils/mobileLayout';
import {
  getCampaignDonationSelection,
  getCampaignDonationSource,
  getCampaignProgress,
  getCampaignShareUrl,
  getCampaignWhatsAppUrl,
  isCampaignCardActivation,
  mergeDiscoveryCampaigns,
  canDonateToCampaignCard,
  parseDiscoveryCampaigns,
} from '../frontend/src/utils/campaignDiscovery.js';

const legacy = { id: 'c1', title: 'Legacy', category: 'All Causes', organizer: 'Punyakart Foundation', target: 100, image: 'legacy', hasTaxBenefit: true };
const navratri = {
  id: 'c7', title: 'Navratri', category: 'Faith', organizer: 'Punyakart Foundation', target: 0,
  image: '/navratri-hero.jpg', hasTaxBenefit: false, donationPresets: [100, 501, 1001], isActive: true,
};

test('valid API lists are authoritative for every campaign, without legacy resurrection', () => {
  // Deliberate contract change: successful empty/disabled lists no longer restore legacy cards.
  assert.deepEqual(mergeDiscoveryCampaigns([legacy, navratri], []), []);
  assert.deepEqual(mergeDiscoveryCampaigns([legacy, navratri], [{ ...navratri, isActive: false }]), []);
  assert.deepEqual(mergeDiscoveryCampaigns([legacy, navratri], [{ ...legacy, isActive: false }]), []);
  assert.deepEqual(mergeDiscoveryCampaigns([legacy, navratri], [{ ...navratri, isActive: true }]).map(c => c.id), ['c7']);
  assert.equal(mergeDiscoveryCampaigns([legacy], [{ ...navratri, isActive: true }]).at(-1)?.id, 'c7');
});

test('offline previews retain Navratri but every card is nonpayable with unknown totals', () => {
  const previews = mergeDiscoveryCampaigns([{ ...legacy, raised: 25000, donors: 34, isApiConfirmed: true, isActive: true }, navratri]);
  assert.deepEqual(previews.map(c => c.id), ['c1', 'c7']);
  for (const card of previews) {
    assert.equal(canDonateToCampaignCard(card), false);
    assert.equal(card.raised, undefined);
    assert.equal(card.donors, undefined);
    assert.equal(card.target, undefined);
    assert.equal(getCampaignProgress(card.raised, card.target), null);
  }
});

test('listing parser rejects malformed success and preserves real zero totals', () => {
  for (const payload of [null, {}, { success: false, campaigns: [] }, { success: true, campaigns: [null] }]) {
    assert.throws(() => parseDiscoveryCampaigns(payload));
  }
  assert.deepEqual(parseDiscoveryCampaigns({ success: true, campaigns: [] }), []);
  const [card] = parseDiscoveryCampaigns({ success: true, campaigns: [{ ...legacy, is_active: true, raised: 0, donors: 0, target: 0 }] });
  assert.equal(card.raised, 0);
  assert.equal(card.donors, 0);
  assert.equal(card.target, 0);
  assert.equal(canDonateToCampaignCard(card), true);
});

test('legacy Navratri discovery records normalize to c7 before rendering or donation selection', () => {
  const [card] = parseDiscoveryCampaigns({ success: true, campaigns: [{
    id: 'navratri', title: 'Legacy Navratri', category: 'Faith', organizer: 'Foundation',
    is_active: true, donation_presets: [501], target: 0,
  }] });
  assert.equal(card.id, 'c7');
  assert.deepEqual(getCampaignDonationSelection(card), ['Legacy Navratri', 501, 'c7']);
});

test('Navratri donation selection uses its first valid CMS preset and has a safe fallback', () => {
  assert.deepEqual(getCampaignDonationSelection(navratri), ['Navratri', 501, 'c7']);
  assert.deepEqual(getCampaignDonationSelection({ ...navratri, donationPresets: ['bad', 0, 501] }), ['Navratri', 501, 'c7']);
  assert.deepEqual(getCampaignDonationSelection({ ...navratri, donationPresets: [] }), ['Navratri', 200, 'c7']);
  assert.deepEqual(getCampaignDonationSelection({ ...navratri, donationPresets: [99, 100, 501] }), ['Navratri', 501, 'c7']);
  assert.deepEqual(getCampaignDonationSelection({ ...navratri, title: 'CMS Navratri Seva', donationPresets: [99, 501] }), ['CMS Navratri Seva', 501, 'c7']);
  for (const donationPresets of [[99], ['100', null, -100, 0, 100.5, NaN, Infinity, 10_000_001], null, '501']) {
    assert.deepEqual(getCampaignDonationSelection({ ...navratri, donationPresets }), ['Navratri', 200, 'c7']);
  }
  assert.deepEqual(getCampaignDonationSelection({ ...navratri, donationPresets: [10_000_000] }), ['Navratri', 10_000_000, 'c7']);
  assert.deepEqual(getCampaignDonationSelection({ ...legacy, donationPresets: [501] }), ['Legacy', 1000, 'c1']);
});

test('Navratri donation attribution uses the shared campaign source', () => {
  assert.equal(getCampaignDonationSource('c7'), 'campaign_c7');
  assert.equal(getCampaignDonationSource('navratri'), 'campaign_c7');
  assert.equal(getCampaignDonationSource('c2'), 'campaign_c2');
});

test('zero target has no progress percentage and valid targets remain bounded', () => {
  assert.equal(getCampaignProgress(0, 0), null);
  assert.equal(getCampaignProgress(undefined, 0), null);
  assert.equal(getCampaignProgress(50, 100), 50);
  assert.equal(getCampaignProgress(200, 100), 100);
  assert.equal(getCampaignProgress(Number.NaN, 100), null);
});

test('Navratri WhatsApp sharing uses the campaign path and attribution parameters', () => {
  const shareUrl = getCampaignShareUrl('c7', 'https://punyakart.com');
  assert.equal(shareUrl, 'https://punyakart.com/campaigns/navratri?utm_source=whatsapp&utm_medium=share');
  const whatsappUrl = getCampaignWhatsAppUrl(navratri, 'https://punyakart.com');
  assert.match(whatsappUrl, /api\.whatsapp\.com\/send\?text=/);
  assert.match(decodeURIComponent(whatsappUrl), /\/campaigns\/navratri\?utm_source=whatsapp&utm_medium=share/);
  assert.doesNotMatch(decodeURIComponent(whatsappUrl), /punyakart\.com[" ]/);
});

test('card action keyboard boundary is explicit and component wiring stays campaign-aware', async () => {
  assert.equal(isCampaignCardActivation('Enter', true), true);
  assert.equal(isCampaignCardActivation(' ', true), true);
  assert.equal(isCampaignCardActivation('Enter', false), false);
  const source = await readFile(new URL('../frontend/src/components/campaign/CampaignsDiscoverySection.tsx', import.meta.url), 'utf8');
  assert.match(source, /onCampaignClick\?\.\(card\.id, card\.title\)/);
  assert.match(source, /onDonateClick\(\.\.\.donation\)/);
  assert.match(source, /getCampaignWhatsAppUrl\(card\)/);
  assert.match(source, /onKeyDown=\{\(event\) => event\.stopPropagation\(\)\}/);
});

test('CMS form accepts zero goals and site-relative Navratri images', async () => {
  const source = await readFile(new URL('../frontend/src/components/admin/CampaignsTab.tsx', import.meta.url), 'utf8');
  assert.match(source, /Target amount \(INR; 0 = no fixed goal\)/);
  assert.match(source, /field === 'target' \|\| field === 'sort_order' \? '0'/);
  assert.match(source, /Image URL or site-relative path/);
  assert.match(source, /campaign\.target === 0 \? '· No fixed goal'/);
  const images = await readFile(new URL('../frontend/src/components/campaign/campaignImages.ts', import.meta.url), 'utf8');
  assert.match(images, /\[NAVRATRI_CAMPAIGN_ID\]: NAVRATRI_DEFAULT_CAMPAIGN\.image/);
  assert.match(images, /if \(campaignId === NAVRATRI_CAMPAIGN_ID\) \{\s*return !image\?\.trim\(\) \|\| image\.trim\(\) === '\/navratri-seva\.svg'\s*\? campaignImageFallbacks\[NAVRATRI_CAMPAIGN_ID\]\s*: image;/);
});

test('Navratri shared-page checkout resets frequency and global CTAs defer to its guarded donation controls', async () => {
  const source = await readFile(new URL('../frontend/src/App.tsx', import.meta.url), 'utf8');
  assert.match(source, /campaignId="c7"[\s\S]*?setDonationType\('one-time'\);\s*setSelectedAmount\(amount\);\s*setSelectedCauseTitle\(causeTitle \|\| 'Navratri'\);\s*setSelectedCampaignId\('c7'\);\s*openCheckout\('campaign_c7'\)/);
  assert.match(source, /const handleQuickDonate = \(\) => \{\s*if \(activePage === 'navratri-campaign'\) \{\s*document\.getElementById\('choose-cause'\)\?\.scrollIntoView\([\s\S]*?\);\s*return;\s*\}\s*openCheckout\(\);/);
  assert.match(source, /onOpenQuickDonate=\{handleQuickDonate\}/);
  assert.match(source, /onQuickDonate=\{handleQuickDonate\}/);
  assert.equal(hasGenericMobileDonationBar('navratri-campaign', 'c7'), false);
  assert.match(source, /const showGenericMobileBar = hasGenericMobileDonationBar\(activePage, campaignId\)/);
  assert.match(source, /showGenericMobileBar && \(\s*<StickyMobileBar/);
});

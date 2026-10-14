import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { getContributionTiers } from '../frontend/src/data/contributionTiers';
import { WhereYourMoneyGoes } from '../frontend/src/components/campaign/WhereYourMoneyGoes';
import { isValidDonationAmount } from '../frontend/src/constants/donation';

const amounts = ['₹200', '₹501', '₹1,001', '₹2,501', '₹5,001', 'Custom Amount'];
const animalPurposes = ['Animal Food & Care', 'Fodder & Daily Nutrition', 'Medicines & Treatment',
  'Special Care & Feeding', 'Larger Seva Contribution', 'Seva as per your श्रद्धा'];

test('all animal campaigns use the ₹200 minimum tiers and purposes, including Faith animal campaigns', () => {
  for (const id of ['c2', 'c3', 'c4', 'c5', 'c7', 'navratri']) {
    const rows = getContributionTiers(id, 'Faith');
    assert.deepEqual(rows.map((row) => row.amount), amounts);
    assert.deepEqual(rows.map((row) => row.purpose), animalPurposes);
  }
  assert.deepEqual(getContributionTiers('new-animal', 'Animals'), getContributionTiers('c5'));
});

test('other campaign purposes match their type while retaining the same amounts', () => {
  for (const [id, category, relevant] of [
    ['c1', 'All Causes', /Emergency/], ['c6', 'Children', /Birthday/],
    ['custom', 'Children', /Children/], ['custom', 'Education', /Learning/],
    ['custom', 'Elderly', /Elderly/], ['custom', 'Women', /Women/],
    ['custom', 'Disaster Relief', /Emergency/], ['custom', 'Faith', /Community/],
    ['custom', 'Specially Abled', /Essential Care/], ['custom', 'Unknown', /Essential Care/],
  ] as const) {
    const rows = getContributionTiers(id, category);
    assert.deepEqual(rows.map((row) => row.amount), amounts);
    assert.match(rows[0].purpose, relevant);
    assert.doesNotMatch(rows.map((row) => row.purpose).join(' '), /Fodder|Animal Food/);
  }
});

test('compact rendered table retains exact values despite old CMS tiers and has accessible headers', () => {
  const html = renderToStaticMarkup(React.createElement(WhereYourMoneyGoes, {
    campaignId: 'c5', content: { allocation_rows: [{ amount: '₹10,000', purpose: 'Old copy' }] },
  }));
  const cells = [...html.matchAll(/<td\b[^>]*>([^<]*)<\/td>/g)].map((match) => match[1]);
  assert.deepEqual(cells.filter((_, index) => index % 2 === 0), amounts);
  assert.match(html, /max-w-2xl/);
  assert.match(html, /text-xs sm:text-sm/);
  assert.match(html, /aria-labelledby=/);
  assert.equal((html.match(/scope="col"/g) || []).length, 2);
  assert.doesNotMatch(html, /₹10,000|Old copy/);
});

test('suggested ₹200 matches the universal minimum, including Chennai custom donations', () => {
  for (const source of ['campaign_c1', 'campaign_c2', 'campaign_c3', 'campaign_c4', 'campaign_c5', 'campaign_c6', 'campaign_c7', 'campaign_navratri', 'chennai_airport']) {
    assert.equal(isValidDonationAmount(200, source), true);
    assert.equal(isValidDonationAmount(199, source), false);
  }
  assert.equal(isValidDonationAmount(500, 'chennai_airport'), true);
});

test('every routed campaign detail renderer uses the shared contribution table', async () => {
  for (const name of ['TuesdayCampaignPage', 'SecondCampaignPage', 'LegacyCrowdFundingPage', 'CampaignDetailPage']) {
    const page = await readFile(new URL(`../frontend/src/pages/${name}.tsx`, import.meta.url), 'utf8');
    assert.equal((page.match(/<WhereYourMoneyGoes\b/g) || []).length, 1, name);
    assert.match(page, /<WhereYourMoneyGoes\s+campaignId=/, name);
  }
});

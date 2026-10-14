import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { AdminDonation, AdminTrafficAttribution } from '../frontend/src/admin/adminTypes';
import { DONATION_SOURCE_FILTERS, resolveAdminDonationSource } from '../frontend/src/admin/adminTypes';
import { serializeCsv } from '../frontend/src/admin/adminApi';
import {
  DONOR_CSV_HEADERS, TRAFFIC_SOURCE_OPTIONS, donorCsvRow, donorTrafficEvidence,
  donorTrafficSource, filterDonorRows, isEligibleDonorStatus, trafficSourceLabel,
} from '../frontend/src/admin/donorTraffic';
import { DonorDetailsTab } from '../frontend/src/components/admin/DonorDetailsTab';
import { deriveTrafficAttribution } from '../frontend/src/utils/trafficAttribution';

// Synthetic fixtures and SSR only: no API, browser globals, dotenv, DB or gateway.
function donation(overrides: Partial<AdminDonation> = {}): AdminDonation {
  return {
    id: 'synthetic', fullName: 'Synthetic Donor', email: 'donor@example.invalid',
    phone: '9876543210', address: 'Synthetic address', panNumber: '', amount: 100,
    type: 'one-time', causeTitle: 'Synthetic cause', fundRaiser: '',
    timestamp: '2026-01-01T12:00:00.000Z', verifiedAt: '2026-01-01T12:01:00.000Z',
    receiptNumber: 'SYN-01', transactionId: 'txn-synthetic', paymentRef: '',
    razorpayOrderId: '', status: 'verified', want80G: true, paymentMethod: 'razorpay',
    terminal: '', issuedBy: '', source: 'campaign_c3', campaignId: 'c3',
    certificateDownloaded: false, certificateDownloadedAt: '', certificateDownloadSource: '',
    receiptDownloaded: false, receiptDownloadedAt: '', receiptDownloadSource: '',
    ...overrides,
  };
}

function traffic(overrides: Partial<AdminTrafficAttribution> = {}): AdminTrafficAttribution {
  return {
    version: 1, source: 'facebook', evidence: 'utm', capturedAt: '2026-01-01T11:59:00.000Z',
    utmSource: 'fb', utmMedium: 'paid_social', utmCampaign: 'winter-giving',
    utmContent: 'creative-a', referrerHost: 'm.facebook.com', landingPath: '/campaign/c3',
    ...overrides,
  };
}

const rows = [
  donation({ id: 'facebook', amount: 500, certificateDownloaded: true, receiptDownloaded: true, trafficAttribution: traffic() }),
  donation({ id: 'instagram', amount: 1000, source: 'chennai_airport', campaignId: undefined, status: 'completed', trafficAttribution: traffic({ source: 'instagram', utmSource: 'ig' }) }),
  donation({ id: 'historical', fullName: 'Historical Donor', source: '', campaignId: 'c1' }),
  donation({ id: 'unknown', source: '', campaignId: undefined, amount: 5000, status: 'initiated' }),
  donation({ id: 'renewal', autoPay: true, type: 'monthly', trafficAttribution: traffic({ inherited: true }) }),
  donation({ id: 'direct', amount: 90000, status: 'failed', source: 'crowd_funding', trafficAttribution: { version: 1, source: 'direct_unknown', evidence: 'none', capturedAt: '2026-01-01T12:00:00.000Z' } }),
];

test('campaign resolver trusts explicit source, then campaignId, and never guesses from money or names', () => {
  assert.equal(resolveAdminDonationSource({ source: ' campaign_custom ', campaignId: 'other' }), 'campaign_custom');
  assert.equal(resolveAdminDonationSource({ source: ' CHENNAI_AIRPORT ', campaignId: 'c3' }), 'chennai_airport');
  assert.equal(resolveAdminDonationSource({ source: 'manual', campaignId: 'c3' }), 'manual');
  assert.equal(resolveAdminDonationSource({ source: 'unknown', campaignId: 'c3' }), 'unknown');
  assert.equal(resolveAdminDonationSource({ source: '', campaignId: ' c3 ' }), 'campaign_c3');
  assert.equal(resolveAdminDonationSource({ campaignId: 'c3' }), 'campaign_c3');
  assert.equal(resolveAdminDonationSource({ source: 'campaign_navratri', campaignId: 'navratri' }), 'campaign_c7');
  assert.equal(resolveAdminDonationSource({ campaignId: 'navratri' }), 'campaign_c7');
  for (const amount of [100, 500, 1000]) {
    assert.equal(resolveAdminDonationSource(donation({ amount, source: '', campaignId: undefined, fullName: 'Chennai Airport', causeTitle: 'Campaign c3' })), 'unknown');
  }
  assert.equal(resolveAdminDonationSource({ source: ' ', campaignId: ' ' }), 'unknown');
  assert.deepEqual(DONATION_SOURCE_FILTERS.map(({ id }) => id), ['all', 'chennai_airport', 'crowd_funding', 'manual']);
  assert.equal(DONATION_SOURCE_FILTERS[0].label, 'All campaigns / portals');
});

test('traffic labels keep canonical platforms, click hints, other referrals and historical unknowns distinct', () => {
  const expected = {
    facebook: 'Facebook', instagram: 'Instagram', whatsapp: 'WhatsApp', google: 'Google',
    bing: 'Bing', youtube: 'YouTube', linkedin: 'LinkedIn', telegram: 'Telegram', x: 'X',
    meta: 'Meta (platform unknown)', referral: 'Other referral',
    other: 'Other tagged source', direct_unknown: 'Direct / unknown', unknown: 'Unknown — not recorded',
  };
  for (const [source, label] of Object.entries(expected)) {
    const row = donation({ trafficAttribution: traffic({ source }) });
    assert.equal(donorTrafficSource(row), source);
    assert.equal(trafficSourceLabel(donorTrafficSource(row)), label);
  }
  assert.equal(donorTrafficSource(donation()), 'unknown');
  assert.equal(donorTrafficEvidence(donation()), 'Not recorded');
  for (const source of ['', 'nonsense', 'campaign_c3', '__proto__', 'Facebook']) {
    assert.equal(donorTrafficSource(donation({ trafficAttribution: traffic({ source }) })), 'unknown');
  }
  const referral = donation({ trafficAttribution: traffic({ source: 'referral', evidence: 'referrer', referrerHost: 'news.example.invalid' }) });
  assert.equal(donorTrafficEvidence(referral), 'Referrer');
  assert.equal(donorTrafficEvidence(donation({ trafficAttribution: traffic({ source: 'meta', evidence: 'click_id', hasMetaClick: true }) })), 'Click hint');
  assert.equal(donorTrafficEvidence(rows[5]), 'No referrer');
  assert.equal(donorTrafficEvidence(rows[0]), 'UTM');
  assert.equal(donorTrafficSource(donation({ trafficAttribution: { ...traffic(), version: 2 } as unknown as AdminTrafficAttribution })), 'unknown');
});

test('captured arrival snapshots use the same canonical platforms as admin labels and filters', () => {
  const now = Date.parse('2026-01-01T12:00:00.000Z');
  const cases = [
    ['?utm_source=fb', '', 'facebook', 'Facebook'],
    ['?utm_source=ig', '', 'instagram', 'Instagram'],
    ['?utm_source=wa', '', 'whatsapp', 'WhatsApp'],
    ['?utm_source=google', '', 'google', 'Google'],
    ['?utm_source=bing', '', 'bing', 'Bing'],
    ['?utm_source=yt', '', 'youtube', 'YouTube'],
    ['?utm_source=linkedin', '', 'linkedin', 'LinkedIn'],
    ['?utm_source=tg', '', 'telegram', 'Telegram'],
    ['?utm_source=twitter', '', 'x', 'X'],
    ['?utm_source=newsletter', '', 'other', 'Other tagged source'],
    ['', 'https://news.example.invalid/article', 'referral', 'Other referral'],
    ['?fbclid=synthetic-hint', '', 'meta', 'Meta (platform unknown)'],
    ['', '', 'direct_unknown', 'Direct / unknown'],
  ] as const;
  for (const [query, referrer, source, label] of cases) {
    const snapshot = deriveTrafficAttribution({ url: `https://punyakart.com/campaigns/c3${query}`, referrer, now });
    assert.ok(snapshot);
    const row = donation({ trafficAttribution: snapshot });
    assert.equal(donorTrafficSource(row), source);
    assert.equal(trafficSourceLabel(donorTrafficSource(row)), label);
    assert.equal(filterDonorRows([row], { trafficSource: source }).length, 1);
  }
});

test('donor SSR renders separate campaign and traffic cells, original signup, and unchanged financial/certificate summaries', () => {
  const html = renderToStaticMarkup(React.createElement(DonorDetailsTab, { donations: rows }));
  const body = html.match(/<tbody>([\s\S]*?)<\/tbody>/)?.[1] || '';
  const renderedRows = [...body.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/g)].map((match) => match[1]);
  assert.equal(renderedRows.length, rows.length);
  assert.match(html, />Campaign \/ portal<\/th>/);
  assert.match(html, />Traffic source<\/th>/);
  assert.match(html, /6 donor records · verified total ₹1,700/);
  assert.match(html, /80G downloaded \(1\)/);
  assert.match(html, /80G not downloaded \(3\)/);
  assert.match(html, /All traffic sources/);
  assert.equal((html.match(/<option\b/g) || []).length, TRAFFIC_SOURCE_OPTIONS.length + 1);
  assert.match(html, /never retrofilled/);
  assert.match(html, /hidden referrer/);
  assert.match(html, /best-effort attribution, not proof/);
  const cells = (index: number) => [...renderedRows[index].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/g)].map((match) => match[1]);
  assert.equal(cells(0).length, 12);
  assert.match(cells(0)[5], /Campaign: c3/);
  assert.doesNotMatch(cells(0)[5], /Facebook/);
  assert.match(cells(0)[6], /Facebook/);
  assert.match(cells(0)[6], /UTM campaign: winter-giving/);
  assert.match(cells(1)[5], /Chennai Airport/);
  assert.match(cells(1)[6], /Instagram/);
  assert.match(cells(2)[5], /Campaign: c1/);
  assert.match(cells(2)[6], /Unknown — not recorded/);
  assert.doesNotMatch(cells(2)[6], /Direct \/ unknown|Chennai Airport/);
  assert.match(cells(3)[5], /Unknown/);
  assert.match(cells(4)[6], /Original signup \(not a new visit\)/);
  assert.match(cells(5)[6], /Direct \/ unknown/);
});

test('traffic and search filters intersect with existing 80G filters without changing amounts or counts', () => {
  const before = structuredClone(rows);
  assert.equal(filterDonorRows(rows).length, 6);
  assert.deepEqual(filterDonorRows(rows, { trafficSource: 'facebook' }).map((row) => row.id), ['facebook', 'renewal']);
  assert.equal(filterDonorRows(rows, { trafficSource: 'unknown' }).length, 2);
  assert.equal(filterDonorRows(rows, { trafficSource: 'direct_unknown' }).length, 1);
  assert.equal(filterDonorRows(rows, { trafficSource: 'facebook', eightyGFilter: 'downloaded' }).length, 1);
  assert.equal(filterDonorRows(rows, { trafficSource: 'facebook', eightyGFilter: 'not-downloaded' }).length, 1);
  assert.equal(filterDonorRows(rows, { trafficSource: 'direct_unknown', eightyGFilter: 'not-downloaded' }).length, 0);
  assert.equal(filterDonorRows(rows, { eightyGFilter: 'downloaded' }).length, 1);
  assert.equal(filterDonorRows(rows, { eightyGFilter: 'not-downloaded' }).length, 3);
  assert.equal(filterDonorRows(rows, { query: ' INSTAGRAM ' }).length, 1);
  assert.equal(filterDonorRows(rows, { query: 'Campaign: c1' }).length, 1);
  assert.equal(filterDonorRows(rows, { query: 'winter-giving' }).length, 3);
  assert.equal(filterDonorRows(rows, { query: 'm.facebook.com' }).length, 3);
  assert.equal(filterDonorRows(rows, { query: 'original signup' }).length, 1);
  assert.equal(filterDonorRows(rows, { query: 'unknown — not recorded' }).length, 2);
  assert.equal(filterDonorRows(rows, { trafficSource: 'facebook', query: 'instagram' }).length, 0);
  assert.equal(filterDonorRows(rows, { trafficSource: 'facebook' }).reduce((sum, row) => sum + (isEligibleDonorStatus(row.status) ? row.amount : 0), 0), 600);
  assert.deepEqual(rows, before);
});

test('empty donor table spans both source columns and disables export', () => {
  const html = renderToStaticMarkup(React.createElement(DonorDetailsTab, { donations: [] }));
  assert.match(html, /colSpan="12"/);
  assert.match(html, /No donor records match this search/);
  assert.match(html, /disabled=""/);
  assert.match(html, /0 donor records · verified total ₹0/);
});

test('CSV columns align with all donor data, evidence and inherited signup attribution', () => {
  for (const row of rows) assert.equal(donorCsvRow(row).length, DONOR_CSV_HEADERS.length);
  const fields = Object.fromEntries(DONOR_CSV_HEADERS.map((header, index) => [header, donorCsvRow(rows[4])[index]]));
  assert.equal(fields['Campaign / portal'], 'Campaign: c3');
  assert.equal(fields['Traffic source'], 'Facebook');
  assert.equal(fields['Attribution evidence'], 'UTM');
  assert.equal(fields['UTM source'], 'fb');
  assert.equal(fields['UTM medium'], 'paid_social');
  assert.equal(fields['UTM campaign'], 'winter-giving');
  assert.equal(fields['UTM content'], 'creative-a');
  assert.equal(fields['Referrer host'], 'm.facebook.com');
  assert.equal(fields['Landing path'], '/campaign/c3');
  assert.equal(fields['Attribution captured at'], '2026-01-01T11:59:00.000Z');
  assert.equal(fields['Inherited attribution'], 'Yes — original signup (not a new visit)');
  assert.equal(fields.Amount, 100);
  assert.equal(fields['80G'], 'Not downloaded');
  assert.equal(fields['Transaction ID'], 'txn-synthetic');
  const historical = Object.fromEntries(DONOR_CSV_HEADERS.map((header, index) => [header, donorCsvRow(rows[2])[index]]));
  assert.equal(historical['Traffic source'], 'Unknown — not recorded');
  assert.equal(historical['Attribution evidence'], 'Not recorded');
  assert.equal(historical['Attribution captured at'], '');
  assert.equal(historical['Inherited attribution'], '');
});

test('pure CSV serializer protects formulas in headers and every text cell, preserving numeric cells and escaping delimiters', () => {
  for (const value of ['=SUM(1,2)', '+123', '-123', '@SUM(A1)', ' \t=1', '\r=1', '\n+1', '\tmetadata', '\u0000=1']) {
    const csv = serializeCsv([value], [[value, 100, -25, 0, 100.5]]);
    const protectedValue = `'${value}`;
    const escaped = /[",\r\n]/.test(protectedValue) ? `"${protectedValue.replace(/"/g, '""')}"` : protectedValue;
    assert.equal(csv, `${escaped}\n${escaped},100,-25,0,100.5`);
  }
  assert.equal(serializeCsv(['Name', 'Address'], [['Test "Donor", Jr', 'line1\rline2\nline3']]), 'Name,Address\n"Test ""Donor"", Jr","line1\rline2\nline3"');
  const malicious = donation({
    fullName: '=1', phone: '+919876543210', email: '@SUM(A1)', address: '-1', panNumber: '=2',
    source: '=3', receiptNumber: '=4', transactionId: '=5', causeTitle: '=6', fundRaiser: '=7',
    trafficAttribution: traffic({ utmSource: '=8', utmMedium: '=9', utmCampaign: '=10', utmContent: '=11' }),
  });
  const csv = serializeCsv(DONOR_CSV_HEADERS, [donorCsvRow(malicious)]);
  const cells = csv.split('\n')[1].split(',');
  assert.equal(cells.length, DONOR_CSV_HEADERS.length);
  for (const header of ['Name', 'Phone', 'Email', 'Address', 'PAN', 'Campaign / portal', 'Receipt No', 'Transaction ID', 'Cause', 'Fund raiser', 'UTM source', 'UTM medium', 'UTM campaign', 'UTM content']) {
    assert.ok(cells[DONOR_CSV_HEADERS.indexOf(header as (typeof DONOR_CSV_HEADERS)[number])].startsWith("'"), header);
  }
  assert.equal(cells[DONOR_CSV_HEADERS.indexOf('Amount')], '100');
  assert.equal(malicious.fullName, '=1');
  assert.equal(malicious.trafficAttribution?.utmCampaign, '=10');
});

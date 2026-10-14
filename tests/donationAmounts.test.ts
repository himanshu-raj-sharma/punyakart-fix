import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { validateDonationPayload } from '../backend/validation/donationSchema';
import { normalizeDonationSource as normalizeBackendSource, validateDonationInput } from '../backend/validation';
import { DonationService } from '../backend/donationService';
import { validateActiveCampaignDonation } from '../backend/campaignDonationGuard';
import type { DonationRepository } from '../backend/db/DonationRepository';
import { SubscriptionService } from '../backend/subscriptionService';
import type { MongoSubscriptionRepository } from '../backend/db/MongoSubscriptionRepository';
import type { DonationInput, StoredDonation, StoredSubscription } from '../backend/types';
import { BusinessError } from '../backend/errors';
import { getRazorpayMonthlyPlanId, RAZORPAY_MONTHLY_PLAN_BY_AMOUNT } from '../backend/razorpayMonthlyPlans';
import {
  AUTO_PAY_AMOUNTS, CHENNAI_MIN_DONATION_AMOUNT, DONATION_AMOUNT_ERROR,
  getDonationAmountError, getMinimumDonationAmount, isAutoPayAmount, isValidDonationAmount,
  MAX_DONATION_AMOUNT, MIN_DONATION_AMOUNT, normalizeDonationSource, parseDonationAmount,
} from '../frontend/src/constants/donation';
import { DonationModal } from '../frontend/src/components/DonationModal';
import { DonationCard } from '../frontend/src/components/DonationCard';
import { DisasterDonateCard } from '../frontend/src/components/DisasterDonateCard';
import { getQuickDonationSource } from '../frontend/src/utils/donationSource';
import { parseDonationCurrencyAmount } from '../frontend/src/utils/donationCurrency';
import type { DonationSource, Language } from '../frontend/src/types';

// Synthetic fixtures only: no dotenv, MongoDB connection, gateway, or notifications.
const input: DonationInput = {
  amount: 500, type: 'one-time', causeTitle: 'Synthetic donation amount check',
  fullName: 'Test Donor', email: 'donor@example.invalid', phone: '9876543210',
  address: 'Synthetic address', panNumber: '', want80G: true, paymentMethod: 'razorpay',
};
const invalidAmounts = [0, -1, -250, 0.5, 1.5, 99.99, 100.5, 499.99, 500.5, NaN, Infinity, -Infinity, MAX_DONATION_AMOUNT + 1];
const sources: DonationSource[] = ['chennai_airport', 'crowd_funding', 'campaign_c1', 'campaign_c2', 'campaign_c3', 'campaign_c4', 'campaign_c5', 'campaign_c6', 'campaign_custom', 'disaster_management', 'future_public_campaign', 'manual'];
const sourceCases: { source?: DonationSource; minimum: number }[] = [
  ...sources.map(source => ({ source, minimum: 200 })),
  { minimum: 200 }, { source: '', minimum: 200 }, { source: ' \t ', minimum: 200 },
  { source: ' CHENNAI_AIRPORT ', minimum: 200 }, { source: 'Chennai_Airport', minimum: 200 },
  { source: ' campaign_custom ', minimum: 200 }, { source: 'UNKNOWN', minimum: 200 },
];

test('all sources including Chennai and omitted source use the uniform ₹200 minimum', () => {
  assert.equal(MIN_DONATION_AMOUNT, 200);
  assert.equal(CHENNAI_MIN_DONATION_AMOUNT, 200);
  assert.equal(MAX_DONATION_AMOUNT, 10_000_000);
  assert.equal(DONATION_AMOUNT_ERROR, 'Every Contribution Counts ❤️ Donate a Minimum of ₹200 to Bring Hope & Relief.');
  assert.equal(DONATION_AMOUNT_ERROR, getDonationAmountError('crowd_funding'));
  assert.equal(isValidDonationAmount(200), true);
  assert.equal(parseDonationAmount('200'), 200);
  assert.equal(isValidDonationAmount(199), false);
  for (const { source, minimum } of sourceCases) {
    assert.equal(getMinimumDonationAmount(source), minimum, String(source));
    assert.equal(normalizeDonationSource(source), normalizeBackendSource(source));
    assert.equal(getDonationAmountError(source), DONATION_AMOUNT_ERROR);
  }
});

test('frontend, schema and legacy validators agree at 199/200 and all numeric limits', () => {
  for (const { source, minimum } of sourceCases) {
    for (const amount of [99, 100, 101, 199, 200, 201, 249, 499, 500, 501, 777, MAX_DONATION_AMOUNT, ...invalidAmounts]) {
      const valid = Number.isInteger(amount) && amount >= minimum && amount <= MAX_DONATION_AMOUNT;
      const resolved = normalizeDonationSource(source);
      assert.equal(isValidDonationAmount(amount, source ?? 'chennai_airport'), valid, `${source}: ${amount}`);
      assert.equal(parseDonationAmount(String(amount), source ?? 'chennai_airport'), valid ? amount : null);
      for (const type of ['one-time', 'monthly'] as const) {
        if (valid) {
          const payload = validateDonationPayload({ ...input, source, type, amount });
          assert.equal(payload.amount, amount);
          assert.equal(payload.source, resolved);
          const legacy = { ...input, source, type, amount };
          assert.doesNotThrow(() => validateDonationInput(legacy));
          assert.equal(legacy.source, resolved);
        } else {
          const amountError = (error: unknown) => error instanceof BusinessError && error.details?.amount === DONATION_AMOUNT_ERROR;
          assert.throws(() => validateDonationPayload({ ...input, source, type, amount }), amountError);
          assert.throws(() => validateDonationInput({ ...input, source, type, amount }), amountError);
        }
      }
    }
  }
  for (const amount of ['100', '500', null, undefined, true]) {
    assert.throws(() => validateDonationPayload({ ...input, amount }), BusinessError);
    assert.throws(() => validateDonationInput({ ...input, amount } as unknown as DonationInput), BusinessError);
  }
});

test('custom amount parsing does not turn signs, decimals, or malformed text into another charge', () => {
  for (const source of sources) {
    for (const text of ['', ' ', '0', '99', '100', '199', '-100', '+500', '100.5', '199.99', '200.5', '500.0', '1e3', 'NaN', 'Infinity', '1,000', '₹500', 'abc500', '10000001']) {
      assert.equal(parseDonationAmount(text, source), null, `${source}: ${text}`);
    }
    assert.equal(parseDonationAmount(' 500 ', source), 500);
    assert.equal(parseDonationAmount('00500', source), 500);
  }
  assert.equal(parseDonationAmount('00200', 'crowd_funding'), 200);
});

test('foreign-currency input uses the payable ₹200 INR threshold rather than native units', () => {
  assert.equal(parseDonationCurrencyAmount('3', 0.012), 250, '$3 is above ₹200');
  assert.equal(parseDonationCurrencyAmount('2', 0.012), null, '$2 is below ₹200');
  assert.equal(parseDonationCurrencyAmount('9', 0.044), 205, 'AED9 is above ₹200');
  assert.equal(parseDonationCurrencyAmount('8', 0.044), null);
  for (const { source } of sourceCases) {
    assert.equal(parseDonationCurrencyAmount('199', 1, source), null);
    assert.equal(parseDonationCurrencyAmount('200', 1, source), 200);
  }
  assert.equal(parseDonationCurrencyAmount(String(MAX_DONATION_AMOUNT), 1), MAX_DONATION_AMOUNT);
  assert.equal(parseDonationCurrencyAmount(String(MAX_DONATION_AMOUNT + 1), 1), null);
  for (const value of ['', ' ', '-2', '+2', '2.5', '1e3', 'abc2', 'Infinity']) {
    assert.equal(parseDonationCurrencyAmount(value, 0.012), null, value);
  }
  for (const rate of [0, -1, NaN, Infinity]) {
    assert.equal(parseDonationCurrencyAmount('100', rate), null);
  }
});

test('header/footer/sticky quick donations resolve every public campaign page to campaign attribution', async () => {
  const cases = [
    ['landing', '', 'chennai_airport'], ['crowd', '', 'crowd_funding'],
    ['second-campaign', 'second', 'campaign_c2'], ['tuesday-campaign', 'tuesday', 'campaign_c3'],
    ['fourth-campaign', 'gau-seva', 'campaign_c4'], ['fifth-campaign', 'thursday-gau-seva', 'campaign_c5'],
    ['birthday-campaign', 'birthday', 'campaign_c6'], ['campaign-detail', 'c1', 'campaign_c1'],
    ['campaign-detail', 'detail', 'campaign_c1'], ['campaign-detail', 'custom', 'campaign_custom'],
  ];
  for (const [page, campaignId, source] of cases) {
    assert.equal(getQuickDonationSource(page, campaignId), source);
  }
  const app = await readFile(new URL('../frontend/src/App.tsx', import.meta.url), 'utf8');
  assert.match(app, /source \?\? getQuickDonationSource\(activePage, campaignId\)/);
  assert.match(app, /onDisasterDonate=\{\(amt, causeTitle\) => \{[^}]*openCheckout\('crowd_funding'\)/);
});

test('donation initiation preserves valid amounts and normalized attribution, rejecting below-minimum amounts before saving', async () => {
  const saved: StoredDonation[] = [];
  const repository = {
    async initiate(donation: Omit<StoredDonation, 'status'>) {
      const row: StoredDonation = { ...donation, status: 'initiated' };
      saved.push(row);
      return row;
    },
  } as DonationRepository;
  const service = new DonationService(repository, {} as SubscriptionService);
  for (const { source, minimum } of sourceCases) {
    const resolved = normalizeDonationSource(source);
    for (const amount of [minimum, minimum + 1, 777, MAX_DONATION_AMOUNT]) {
      const campaignId = resolved.startsWith('campaign_') ? resolved.slice(9) : undefined;
      const row = await service.initiate({ ...input, source, campaignId, amount });
      assert.equal(row.amount, amount);
      assert.equal(row.source, resolved);
      assert.equal(row.campaignId, campaignId);
      assert.equal(row.amount * 100, amount * 100, 'gateway paise conversion stays exact');
    }
    const before = saved.length;
    for (const amount of [minimum - 1, ...invalidAmounts]) {
      await assert.rejects(service.initiate({ ...input, source, amount }), BusinessError);
    }
    assert.equal(saved.length, before, 'invalid amounts never reach persistence');
  }
  const before = saved.length;
  for (const amount of invalidAmounts) {
    await assert.rejects(service.initiate({ ...input, amount }), BusinessError);
  }
  assert.equal(saved.length, before, 'invalid amounts never reach persistence');
  const monthly = await service.initiate({ ...input, source: 'campaign_c3', type: 'monthly', amount: 200, autoPay: false });
  assert.equal(monthly.amount, 200);
  assert.equal(monthly.autoPay, false);
});

test('server entry guard rejects ₹199 and accepts ₹200 for every source before gateway work', async () => {
  const campaigns = { async findById(id: string) { return { id, title: 'Synthetic campaign', is_active: true }; } };
  for (const { source } of sourceCases) {
    await assert.rejects(validateActiveCampaignDonation({ ...input, source, amount: 199 }, campaigns),
      (error: unknown) => error instanceof BusinessError && error.details?.amount === DONATION_AMOUNT_ERROR);
    const donation = await validateActiveCampaignDonation({ ...input, source, amount: 200 }, campaigns);
    assert.equal(donation.amount, 200);
    assert.equal(donation.source, normalizeDonationSource(source));
  }
});

test('new monthly subscriptions enforce source minimums without changing gateway plans', async () => {
  const saved: StoredSubscription[] = [];
  const repository = { async insert(row: StoredSubscription) { saved.push(row); return row; } } as MongoSubscriptionRepository;
  const service = new SubscriptionService(repository);
  const base = { donorName: input.fullName, phone: input.phone, causeTitle: input.causeTitle, paymentMethod: 'razorpay' };
  for (const { source, minimum } of sourceCases) {
    const row = await service.create({ ...base, source, amount: minimum });
    assert.equal(row.amount, minimum);
    assert.equal(row.source, normalizeDonationSource(source));
    const before = saved.length;
    for (const amount of [minimum - 1, ...invalidAmounts]) {
      await assert.rejects(service.create({ ...base, source, amount }), BusinessError);
    }
    assert.equal(saved.length, before);
  }
  assert.equal(saved.length, sourceCases.length);
  assert.deepEqual([...AUTO_PAY_AMOUNTS], Object.keys(RAZORPAY_MONTHLY_PLAN_BY_AMOUNT).map(Number).sort((a, b) => a - b));
  assert.deepEqual([...AUTO_PAY_AMOUNTS], [500, 1000, 2000, 3500, 5000, 8500, 12000, 18000, 22000]);
  for (const amount of [1, 10, 199, 200, 249, 501, 777, 7500]) {
    assert.equal(isAutoPayAmount(amount), false);
    assert.equal(getRazorpayMonthlyPlanId(amount), null);
  }
  for (const amount of AUTO_PAY_AMOUNTS) {
    assert.ok(isAutoPayAmount(amount));
    assert.ok(getRazorpayMonthlyPlanId(amount));
  }
});

test('an existing monthly mandate retains its original amount instead of being raised to the new minimum', async () => {
  const existing = {
    id: 'SUB-synthetic-existing', donorName: input.fullName, phone: input.phone,
    amount: 1, causeTitle: input.causeTitle, source: 'chennai_airport', frequency: 'MONTHLY',
    status: 'ACTIVE', paymentMethod: 'razorpay', razorpaySubscriptionId: 'sub_synthetic',
    startDate: '2026-01-01', nextBillingDate: '2026-02-01',
  } as StoredSubscription;
  let inserts = 0;
  const repository = {
    async findByRazorpaySubscriptionId() { return existing; },
    async update(_id: string, patch: Partial<StoredSubscription>) {
      assert.equal(patch.amount, undefined);
      return { ...existing, ...patch };
    },
    async insert() { inserts += 1; },
  } as unknown as MongoSubscriptionRepository;
  const service = new SubscriptionService(repository);
  const row = await service.create({
    donorName: input.fullName, phone: input.phone, amount: 1, causeTitle: input.causeTitle,
    paymentMethod: 'razorpay', source: 'chennai_airport', razorpaySubscriptionId: 'sub_synthetic',
  });
  assert.equal(row.amount, 1);
  assert.equal(inserts, 0);
});

function renderCheckout(amount: number, source?: DonationSource, type: 'one-time' | 'monthly' = 'one-time') {
  return renderToStaticMarkup(React.createElement(DonationModal, {
    isOpen: true, onClose() {}, language: 'en', amount, type,
    causeTitle: 'Synthetic contribution', want80G: true, source, onCompleteDonation() {},
  }));
}

test('shared checkout renders each resolved source minimum with an editable amount, including omitted source', () => {
  for (const { source, minimum } of sourceCases) {
    const html = renderCheckout(minimum, source);
    const field = html.match(/<input\b[^>]*id="checkout-donation-amount"[^>]*>/)?.[0];
    assert.ok(field, String(source));
    assert.ok(field.includes(`min="${minimum}"`));
    assert.match(field, /step="1"/);
    assert.match(field, /max="10000000"/);
    assert.ok(field.includes(`value="${minimum}"`));
    assert.doesNotMatch(field, /readonly|disabled/i);
    assert.ok(html.includes(`Pay ₹${minimum} via Razorpay`));
    assert.ok(html.includes(getDonationAmountError(source).replaceAll('&', '&amp;')));
  }
});

test('below-minimum checkout input is preserved verbatim rather than raised to a minimum', () => {
  for (const { source, minimum } of sourceCases) {
    const html = renderCheckout(minimum - 1, source);
    const field = html.match(/<input\b[^>]*id="checkout-donation-amount"[^>]*>/)?.[0];
    assert.ok(field?.includes(`value="${minimum - 1}"`));
    assert.ok(html.includes('Pay ₹— via Razorpay'));
    assert.ok(html.includes(getDonationAmountError(source).replaceAll('&', '&amp;')));
  }
});

test('checkout displays the chosen amount, and unsupported monthly amounts cannot select Auto Pay', () => {
  for (const amount of [200, 249, 499, 777]) {
    const html = renderCheckout(amount, 'campaign_c3', 'monthly');
    const checkbox = html.match(/<input\b[^>]*id="monthly-autopay"[^>]*>/)?.[0];
    assert.ok(checkbox);
    assert.match(checkbox, /disabled/);
    assert.doesNotMatch(checkbox, /checked/);
    assert.ok(html.includes(`Pay ₹${amount} once (monthly intent) via Razorpay`));
  }
  const supported = renderCheckout(500, 'chennai_airport', 'monthly');
  const checkbox = supported.match(/<input\b[^>]*id="monthly-autopay"[^>]*>/)?.[0];
  assert.ok(checkbox);
  assert.doesNotMatch(checkbox, /disabled=/);
  assert.match(checkbox, /checked=/);
});

test('landing and disaster donation cards both use the ₹200 minimum', () => {
  const html = renderToStaticMarkup(React.createElement(DonationCard, {
    language: 'en', donationType: 'one-time', selectedAmount: 500,
    onDonationTypeChange() {}, onAmountChange() {}, onOpenCheckout() {},
  }));
  assert.ok(html.includes('Enter custom amount (min ₹200)'));
  assert.match(html.match(/<input\b[^>]*id="custom-amount-input"[^>]*>/)?.[0] || '', /min="200"/);
  const disaster = renderToStaticMarkup(React.createElement(DisasterDonateCard, { language: 'en', onDonate() {} }));
  assert.match(disaster.match(/<input\b[^>]*id="disaster-custom-amount"[^>]*>/)?.[0] || '', /min="200"/);
});

test('all 23 language packs interpolate source-specific placeholders in the donation card', async () => {
  const packs = new URL('../frontend/src/data/packs/', import.meta.url);
  const files = (await readdir(packs)).filter(name => name.endsWith('.json'));
  assert.equal(files.length, 23);
  for (const filename of files) {
    const pack = JSON.parse(await readFile(new URL(filename, packs), 'utf8'));
    assert.ok(pack.customAmountPlaceholder, filename);
    assert.match(pack.customAmountPlaceholder, /₹\s*\{min\}/, filename);
    assert.ok(pack.donationContributionImpact, filename);
    assert.ok(pack.donationMinError.includes('{min}'), filename);
    for (const source of ['chennai_airport', 'campaign_custom']) {
       const minimum = 200;
      const html = renderToStaticMarkup(React.createElement(DonationCard, {
        language: filename.replace('.json', '') as Language, source,
        donationType: 'one-time', selectedAmount: minimum,
        onDonationTypeChange() {}, onAmountChange() {}, onOpenCheckout() {},
      }));
      assert.ok(html.includes(pack.customAmountPlaceholder.replace('{min}', String(minimum))), `${filename}: ${source}`);
      assert.doesNotMatch(html, /\{min\}/);
    }
  }
});

test('editable amounts remain wired into initiation and gateway display uses its returned order amount', async () => {
  const source = await readFile(new URL('../frontend/src/components/DonationModal.tsx', import.meta.url), 'utf8');
  assert.match(source, /const chosenAmount = parseDonationAmount\(amountInput, resolvedSource\)/);
  assert.match(source, /const amount = paymentView === 'form' \? \(chosenAmount \?\? 0\) : sessionAmount/);
  assert.match(source, /const payload = \{\s*amount,/);
  assert.match(source, /autoPay: effectiveAutoPay/);
  assert.match(source, /amount: donation\.amount \* 100/);
  assert.match(source, /setSessionAmount\(donation\.amount\)/);
  assert.match(source, /if \(chosenAmount === null\)/);
  assert.match(source, /finishPayment\(pending, verifyData\.donation\)/);
  assert.match(source, /if \(!pending\.attempt\.complete\(donation, pending\.donation\)\) return;\s*trackMetaPurchase\(donation\)/);
  assert.match(source, /source: lockedSourceRef\.current/);
  assert.match(source, /if \(initiatingRef\.current \|\| paymentView !== 'form'\) return/);
});

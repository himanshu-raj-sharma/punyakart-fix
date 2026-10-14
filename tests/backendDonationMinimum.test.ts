import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DonationService } from '../backend/donationService';
import type { DonationRepository } from '../backend/db/DonationRepository';
import { BusinessError } from '../backend/errors';
import type { SubscriptionService } from '../backend/subscriptionService';
import type { StoredDonation, StoredSubscription } from '../backend/types';
import { createCampaignSchema, updateCampaignSchema } from '../backend/validation/campaignSchema';
import { DONATION_AMOUNT_ERROR, MAX_DONATION_AMOUNT } from '../frontend/src/constants/donation';

// Pure in-memory fixtures: no server, dotenv, DB, gateway or notification access.
const manualInput = {
  fullName: 'Synthetic Donor', email: 'donor@example.invalid', phone: '9876543210',
  address: 'Synthetic address', paymentMethod: 'cash', issuedBy: 'Synthetic Staff',
  causeTitle: 'Synthetic donation',
};

function memoryStore(initial: StoredDonation[] = []) {
  const rows = new Map(initial.map(row => [row.id, { ...row }]));
  let writes = 0;
  const repository = {
    async initiate(input: Omit<StoredDonation, 'status'>) {
      writes += 1;
      const row: StoredDonation = { ...input, status: 'initiated' };
      rows.set(row.id, row);
      return row;
    },
    async findById(id: string) { return rows.get(id) || null; },
    async allocateReceiptNumber() { return 'PKF-SYNTHETIC-000001'; },
    async updateStatus(id: string, status: StoredDonation['status'], updates: Partial<StoredDonation> = {}) {
      const row = rows.get(id);
      if (!row) return null;
      writes += 1;
      const updated = { ...row, ...updates, status };
      rows.set(id, updated);
      return updated;
    },
    async listAll() { return [...rows.values()]; },
    async findByRazorpaySubscriptionId(id: string) {
      return [...rows.values()].find(row => row.razorpaySubscriptionId === id) || null;
    },
    async searchForPublicCertificate(query: string) {
      return [...rows.values()].find(row => row.paymentRef === query) || null;
    },
    async upsertVerified(row: StoredDonation) { writes += 1; rows.set(row.id, row); return row; },
  } satisfies Partial<DonationRepository>;
  return { rows, repository: repository as unknown as DonationRepository, writes: () => writes };
}

const amountError = (error: unknown) => error instanceof BusinessError
  && error.code === 'VALIDATION_ERROR' && error.details?.amount === DONATION_AMOUNT_ERROR;

test('new manual receipts reject ₹199, fractions and out-of-range amounts before any writes', async () => {
  const store = memoryStore();
  let notifications = 0;
  const service = new DonationService(store.repository, {} as SubscriptionService, undefined,
    async () => { notifications += 1; });
  for (const amount of [0, 1, 100, 199, 199.99, 200.5, -200, NaN, Infinity, -Infinity,
    MAX_DONATION_AMOUNT + 1, '199', '199.99', '200.5', '1e3', '', null, undefined, true, [200], {}]) {
    await assert.rejects(service.createManualVerified({ ...manualInput, amount }), amountError, String(amount));
  }
  assert.equal(store.writes(), 0);
  assert.equal(store.rows.size, 0);
  assert.equal(notifications, 0);
});

test('new manual receipts accept ₹200 and the existing maximum, retaining exact whole rupees', async () => {
  const store = memoryStore();
  const notified: number[] = [];
  const service = new DonationService(store.repository, {} as SubscriptionService, undefined,
    async donation => { notified.push(donation.amount); });
  for (const amount of [200, '200', ' 00200 ', 201, 499, MAX_DONATION_AMOUNT]) {
    const row = await service.createManualVerified({ ...manualInput, amount });
    assert.equal(row.amount, Number(amount));
    assert.equal(row.source, 'manual');
    assert.equal(row.status, 'verified');
    assert.equal((await service.findById(row.id))?.amount, Number(amount));
  }
  assert.deepEqual(notified, [200, 200, 200, 201, 499, MAX_DONATION_AMOUNT]);
});

test('CMS create/update schemas apply the same minimum and error to all selectable donation fields', () => {
  const patches = (amount: number) => [
    { donation_presets: [amount] },
    { content: { contribution_cards: [{ id: 'card', price: amount, unit: 'unit', title: 'Title', subtitle: '', image: '/test.webp' }] } },
    { content: { about_cards: [{ id: 'card', image: '/test.webp', line1: '', line2: '', line3: '', supportAmount: amount }] } },
    { content: { recovery_stories: [{ id: 'story', title: '', subtitle: '', statusBadge: '', beforeImg: '/before.webp', afterImg: '/after.webp', description: '', supportAmount: amount }] } },
  ];
  for (const amount of [100, 199, 199.99, 200, 200.5, MAX_DONATION_AMOUNT, MAX_DONATION_AMOUNT + 1]) {
    const valid = Number.isInteger(amount) && amount >= 200 && amount <= MAX_DONATION_AMOUNT;
    for (const patch of patches(amount)) {
      for (const result of [updateCampaignSchema.safeParse(patch), createCampaignSchema.safeParse({
        title: 'Synthetic campaign', category: 'Synthetic', organizer: 'Synthetic', target: 1000, ...patch,
      })]) {
        assert.equal(result.success, valid, JSON.stringify(patch));
        if (!result.success) assert.ok(result.error.issues.every(issue => issue.message === DONATION_AMOUNT_ERROR));
      }
    }
  }
});

function historicalDonation(amount: number): StoredDonation {
  return {
    ...manualInput, amount, paymentMethod: 'razorpay', type: 'one-time', want80G: true,
    id: `DON-historical-${amount}`, timestamp: '2025-01-01T00:00:00.000Z', status: 'verified',
    receiptNumber: 'PKF-2024-25-000001', transactionId: `pay_historical${amount}`,
    paymentRef: `pay_historical${amount}`, source: 'chennai_airport',
  };
}

test('historical paid donation lookup and certificate issuance preserve sub-₹200 records', async () => {
  for (const amount of [1, 100, 199]) {
    const existing = historicalDonation(amount);
    const store = memoryStore([existing]);
    const service = new DonationService(store.repository, {} as SubscriptionService, undefined, async () => {});
    assert.equal((await service.findForCertificate(existing.paymentRef!)).donation.amount, amount);
    assert.equal((await service.issueCertificate(existing.id)).amount, amount);
    assert.deepEqual(store.rows.get(existing.id), existing);
    assert.equal(store.writes(), 0);
  }
});

test('captured historical payment imports retain sub-₹200 amounts', async () => {
  for (const amount of [1, 100, 199]) {
    const store = memoryStore();
    const service = new DonationService(store.repository, {} as SubscriptionService, {
      async findCapturedPayment() {
        return { id: `pay_imported${amount}`, amount: amount * 100, status: 'captured',
          contact: manualInput.phone, email: manualInput.email, created_at: 1735689600 };
      },
    }, async () => {});
    const result = await service.findForCertificate(`pay_imported${amount}`);
    assert.equal(result.donation.amount, amount);
    assert.equal(result.donation.status, 'verified');
    assert.equal((await service.findById(result.donation.id))?.amount, amount);
  }
});

test('existing monthly mandate charges retain original sub-₹200 amounts', async () => {
  for (const amount of [1, 100, 199]) {
    const seed: StoredDonation = { ...historicalDonation(amount), type: 'monthly', autoPay: true,
      razorpaySubscriptionId: `sub_historical${amount}` };
    const store = memoryStore([seed]);
    let billingBumps = 0;
    const subscriptions = {
      async findByRazorpaySubscriptionId() {
        return { amount, donorName: seed.fullName, phone: seed.phone, email: seed.email,
          causeTitle: seed.causeTitle, seedDonationId: seed.id } as StoredSubscription;
      },
      async bumpNextBilling() { billingBumps += 1; },
    } as unknown as SubscriptionService;
    const service = new DonationService(store.repository, subscriptions, undefined, async () => {});
    const charge = { razorpaySubscriptionId: seed.razorpaySubscriptionId!, paymentId: `pay_recurring${amount}`, amountPaise: amount * 100 };
    const result = await service.recordSubscriptionCharge(charge);
    assert.equal(result?.amount, amount);
    assert.equal(result?.status, 'verified');
    assert.equal(billingBumps, 1);
    assert.equal((await service.recordSubscriptionCharge(charge))?.amount, amount);
    assert.equal(billingBumps, 1, 'repeated webhook remains idempotent');
    assert.deepEqual(store.rows.get(seed.id), seed);
  }
});

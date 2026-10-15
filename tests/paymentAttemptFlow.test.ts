import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DonationService } from '../backend/donationService.js';
import type { DonationRepository } from '../backend/db/DonationRepository.js';
import type { PaymentAttemptRepository } from '../backend/db/PaymentAttemptRepository.js';
import type { StoredDonation } from '../backend/types.js';
import { verifyCapturedDonation } from '../backend/metaPaymentTracking.js';
import type { MetaConversionsService } from '../backend/metaConversions.js';

const NOW = new Date('2026-10-15T01:00:00.000Z');
const donor = {
  amount: 501,
  type: 'one-time',
  causeTitle: 'Synthetic campaign',
  source: 'campaign_c4',
  campaignId: 'c4',
  fullName: 'Synthetic Donor',
  email: 'donor@example.invalid',
  phone: '9876543210',
  address: 'Synthetic address',
  panNumber: '',
  want80G: true,
  autoPay: false,
  paymentMethod: 'razorpay',
} as const;

function makeFixture() {
  const donations = new Map<string, StoredDonation>();
  const attempts = new Map<string, StoredDonation>();
  const failureNotes = new Map<string, string>();
  let receiptSequence = 0;
  let notifications = 0;

  const donationRepo = {
    async initiate(row: Omit<StoredDonation, 'status'>) {
      const saved = { ...row, status: 'initiated' as const };
      donations.set(saved.id, structuredClone(saved));
      return structuredClone(saved);
    },
    async updateStatus(id: string, status: StoredDonation['status'], updates: Partial<StoredDonation> = {}) {
      const row = donations.get(id);
      if (!row) return null;
      const saved = { ...row, ...updates, status };
      donations.set(id, structuredClone(saved));
      return structuredClone(saved);
    },
    async verifyOnce(id: string, updates: Pick<StoredDonation, 'verifiedAt' | 'receiptNumber' | 'paymentRef'>) {
      const row = donations.get(id);
      if (!row) return { donation: null, transitioned: false };
      if (row.status === 'verified') return { donation: structuredClone(row), transitioned: false };
      const saved = { ...row, ...updates, status: 'verified' as const };
      donations.set(id, structuredClone(saved));
      return { donation: structuredClone(saved), transitioned: true };
    },
    async findById(id: string) { return structuredClone(donations.get(id) || null); },
    async findByReceipt(receipt: string) {
      return structuredClone([...donations.values()].find(row => row.receiptNumber === receipt) || null);
    },
    async findByRazorpayOrderId(orderId: string) {
      return structuredClone([...donations.values()].find(row => row.razorpayOrderId === orderId) || null);
    },
    async findByRazorpayQrId(qrId: string) {
      return structuredClone([...donations.values()].find(row => row.razorpayQrId === qrId) || null);
    },
    async findByRazorpaySubscriptionId(subscriptionId: string) {
      return structuredClone([...donations.values()].find(row => row.razorpaySubscriptionId === subscriptionId) || null);
    },
    async findByPaymentRef(paymentRef: string) {
      return structuredClone([...donations.values()].find(row => row.paymentRef === paymentRef) || null);
    },
    async listRecent(limit: number) { return [...donations.values()].filter(row => row.status === 'verified').slice(0, limit).map(row => structuredClone(row)); },
    async listEligible() { return [...donations.values()].filter(row => row.status === 'verified').map(row => structuredClone(row)); },
    async listAll() { return [...donations.values()].map(row => structuredClone(row)); },
    async searchForCertificate() { return null; },
    async searchForPublicCertificate() { return null; },
    async searchMatches() { return []; },
    async nextReceiptNumber() { receiptSequence += 1; return `PKF-2026-27-${String(receiptSequence).padStart(6, '0')}`; },
    async allocateReceiptNumber(id: string) {
      const row = donations.get(id);
      if (row?.receiptNumber) return row.receiptNumber;
      receiptSequence += 1;
      return `PKF-2026-27-${String(receiptSequence).padStart(6, '0')}`;
    },
    async upsertVerified(row: StoredDonation) {
      const existing = donations.get(row.id) ||
        [...donations.values()].find(item => item.paymentRef === row.paymentRef ||
          (row.razorpayOrderId && item.razorpayOrderId === row.razorpayOrderId));
      if (existing) return structuredClone(existing);
      const saved = structuredClone({ ...row, status: 'verified' as const });
      donations.set(saved.id, saved);
      return structuredClone(saved);
    },
    async findByPhone() { return []; },
    async verifyDonorSecret() { return false; },
  } as unknown as DonationRepository;

  const attemptRepo: PaymentAttemptRepository = {
    async create(row) {
      const saved: StoredDonation = { ...row, status: 'initiated' };
      attempts.set(saved.id, structuredClone(saved));
      return structuredClone(saved);
    },
    async findById(id) { return structuredClone(attempts.get(id) || null); },
    async findByRazorpayOrderId(orderId) {
      return structuredClone([...attempts.values()].find(row => row.razorpayOrderId === orderId) || null);
    },
    async findByRazorpayQrId(qrId) {
      return structuredClone([...attempts.values()].find(row => row.razorpayQrId === qrId) || null);
    },
    async findByRazorpaySubscriptionId(subscriptionId) {
      return structuredClone([...attempts.values()].find(row => row.razorpaySubscriptionId === subscriptionId) || null);
    },
    async findByPaymentRef(paymentRef) {
      return structuredClone([...attempts.values()].find(row => row.paymentRef === paymentRef) || null);
    },
    async updateStatus(id, status, updates = {}) {
      const row = attempts.get(id);
      if (!row) return null;
      const saved: StoredDonation = { ...row, ...updates, status };
      attempts.set(id, structuredClone(saved));
      return structuredClone(saved);
    },
    async markVerified(id, updates) {
      const row = attempts.get(id);
      if (!row) return { attempt: null, transitioned: false };
      if (row.status === 'verified') return { attempt: structuredClone(row), transitioned: false };
      const saved: StoredDonation = { ...row, ...updates, status: 'verified' };
      attempts.set(id, structuredClone(saved));
      return { attempt: structuredClone(saved), transitioned: true };
    },
    async recordPaymentFailureByOrder(orderId, reason) {
      const row = [...attempts.values()].find(item => item.razorpayOrderId === orderId);
      if (!row) return null;
      failureNotes.set(row.id, reason);
      // Mirror production: a failed payment event marks the attempt failed,
      // while keeping it eligible for reconciliation after a later capture.
      const saved = { ...row, status: 'failed' as const, failureReason: reason };
      attempts.set(saved.id, structuredClone(saved));
      return structuredClone(saved);
    },
    async recordRefundByOrder(orderId, reason) {
      const row = [...attempts.values()].find(item => item.razorpayOrderId === orderId);
      if (!row) return null;
      const saved = { ...row, failureReason: `Refund event observed: ${reason}` };
      attempts.set(saved.id, structuredClone(saved));
      return structuredClone(saved);
    },
    async listPendingForReconciliation(limit, olderThan) {
      return [...attempts.values()]
        .filter(row => ['initiated', 'pending_verification', 'failed'].includes(row.status) &&
          Date.parse(row.timestamp) <= olderThan.getTime())
        .slice(0, limit).map(row => structuredClone(row));
    },
    async listAdminPending(limit) {
      return [...attempts.values()].filter(row => ['initiated', 'pending_verification', 'failed'].includes(row.status))
        .slice(0, limit).map(row => structuredClone(row));
    },
    async markReconciliationAttempt() {},
    async upsertFromLegacy(row) {
      const current = attempts.get(row.id);
      if (current) return structuredClone(current);
      attempts.set(row.id, structuredClone(row));
      return structuredClone(row);
    },
  };

  const service = new DonationService(
    donationRepo,
    {} as never,
    undefined,
    async () => { notifications += 1; },
    attemptRepo,
  );
  const meta = { enabled: false, enqueuePurchase: async () => undefined } as unknown as MetaConversionsService;
  return { donations, attempts, failureNotes, service, meta, notifications: () => notifications };
}

test('new checkout lives in payment_attempts until Razorpay capture is verified', async () => {
  const fixture = makeFixture();
  const attempt = await fixture.service.initiate(donor, NOW);
  assert.equal(attempt.status, 'initiated');
  assert.equal(fixture.attempts.has(attempt.id), true);
  assert.equal(fixture.donations.has(attempt.id), false);

  await fixture.service.attachRazorpayOrder(attempt.id, 'order_synthetic123');
  const hydrated = (await fixture.service.findById(attempt.id))!;
  const payment = {
    id: 'pay_synthetic123',
    order_id: 'order_synthetic123',
    amount: 50100,
    currency: 'INR',
    status: 'captured',
    captured: true,
  };
  const verified = await verifyCapturedDonation(fixture.service, fixture.meta, hydrated, payment);
  assert.equal(verified.status, 'verified');
  assert.match(verified.receiptNumber, /^PKF-2026-27-/);
  assert.equal(verified.paymentRef, 'pay_synthetic123');
  assert.equal(fixture.donations.size, 1);
  assert.equal(fixture.attempts.get(attempt.id)?.status, 'verified');
  assert.equal((await fixture.service.listAll()).length, 1);
  assert.equal(fixture.notifications(), 1);

  // A duplicate/delayed webhook must converge on the existing donation.
  const duplicate = await verifyCapturedDonation(fixture.service, fixture.meta, hydrated, payment);
  assert.equal(duplicate.id, verified.id);
  assert.equal(fixture.donations.size, 1);
  assert.equal(fixture.notifications(), 1);
});

test('a failed payment attempt keeps the checkout reconcilable for a later captured retry', async () => {
  const fixture = makeFixture();
  const attempt = await fixture.service.initiate(donor, NOW);
  await fixture.service.attachRazorpayOrder(attempt.id, 'order_retry123');

  const failed = await fixture.service.recordPaymentFailureByRazorpayOrder(
    'order_retry123',
    'Synthetic customer timeout',
    new Date(NOW.getTime() + 1000),
  );
  assert.equal(failed?.id, attempt.id);
  assert.equal(fixture.attempts.get(attempt.id)?.status, 'failed', 'failed attempts remain eligible for reconciliation');
  assert.equal(fixture.failureNotes.get(attempt.id), 'Synthetic customer timeout');

  const payment = {
    id: 'pay_retry123',
    order_id: 'order_retry123',
    amount: 50100,
    currency: 'INR',
    status: 'captured',
    captured: true,
  };
  const verified = await verifyCapturedDonation(
    fixture.service, fixture.meta, (await fixture.service.findById(attempt.id))!, payment,
  );
  assert.equal(verified.status, 'verified');
  assert.equal(fixture.donations.size, 1);
  assert.equal(fixture.attempts.get(attempt.id)?.status, 'verified');
});

test('a refund webhook arriving before capture remains reconcilable and is retained as refunded only after capture', async () => {
  const fixture = makeFixture();
  const attempt = await fixture.service.initiate(donor, NOW);
  await fixture.service.attachRazorpayOrder(attempt.id, 'order_refund_first');
  await fixture.service.refundByRazorpayOrder('order_refund_first', 'Synthetic refund event before capture');
  assert.equal(fixture.attempts.get(attempt.id)?.status, 'initiated');
  assert.match(fixture.attempts.get(attempt.id)?.failureReason || '', /^Refund event observed:/);
  assert.equal(fixture.donations.has(attempt.id), false);

  const payment = {
    id: 'pay_refund_first',
    order_id: 'order_refund_first',
    amount: 50100,
    currency: 'INR',
    status: 'captured',
    captured: true,
  };
  const finalized = await verifyCapturedDonation(
    fixture.service, fixture.meta, (await fixture.service.findById(attempt.id))!, payment,
  );
  assert.equal(finalized.status, 'refunded');
  assert.equal(fixture.donations.get(attempt.id)?.status, 'refunded');
  assert.equal(fixture.attempts.get(attempt.id)?.status, 'verified');
  assert.equal(fixture.notifications(), 0);
});

test('admin donation list excludes initiated checkout attempts', async () => {
  const fixture = makeFixture();
  await fixture.service.initiate(donor, NOW);
  assert.equal((await fixture.service.listAll()).length, 0);
});

test('a confirmed donation repairs a stale failed attempt marker without duplicating its receipt', async () => {
  const fixture = makeFixture();
  const attempt = await fixture.service.initiate(donor, NOW);
  await fixture.service.attachRazorpayOrder(attempt.id, 'order_repair123');

  const payment = {
    id: 'pay_repair123',
    order_id: 'order_repair123',
    amount: 50100,
    currency: 'INR',
    status: 'captured',
    captured: true,
  };
  const verified = await verifyCapturedDonation(
    fixture.service, fixture.meta, (await fixture.service.findById(attempt.id))!, payment,
  );
  const receiptNumber = verified.receiptNumber;

  // Simulate the split write partially succeeding: donations is durable but
  // payment_attempts still has a retryable state after a transient DB error.
  fixture.attempts.set(attempt.id, {
    ...fixture.attempts.get(attempt.id)!,
    status: 'failed',
  });

  const repaired = await fixture.service.verify(attempt.id, payment.id);
  assert.equal(repaired.status, 'verified');
  assert.equal(repaired.receiptNumber, receiptNumber);
  assert.equal(fixture.donations.size, 1);
  assert.equal(fixture.attempts.get(attempt.id)?.status, 'verified');
  assert.equal(fixture.notifications(), 1, 'repair must not send a duplicate receipt notification');
});

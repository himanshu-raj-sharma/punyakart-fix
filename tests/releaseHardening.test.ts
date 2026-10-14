import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assertProductionConfig } from '../backend/productionConfig.js';
import {
  createRazorpayPaymentFinder,
  isCapturedPayment,
  paymentMatchesQuery,
  type RazorpayPaymentSnapshot,
} from '../backend/razorpayCertificateLookup.js';

const productionBase = {
  NODE_ENV: 'production',
  ADMIN_API_KEY: 'a'.repeat(32),
  RAZORPAY_KEY_ID: 'rzp_live_ok',
  RAZORPAY_KEY_SECRET: 'razorpay-secret',
} as NodeJS.ProcessEnv;

test('production config requires a strong donor JWT secret', () => {
  assert.throws(
    () => assertProductionConfig(productionBase),
    /DONOR_JWT_SECRET must be a random secret/,
  );

  assert.throws(
    () => assertProductionConfig({ ...productionBase, DONOR_JWT_SECRET: 'short-secret' }),
    /DONOR_JWT_SECRET must be a random secret/,
  );

  assert.throws(
    () => assertProductionConfig({ ...productionBase, DONOR_JWT_SECRET: 'password'.repeat(4) }),
    /DONOR_JWT_SECRET must be a random secret/,
  );

  assert.doesNotThrow(() => assertProductionConfig({
    ...productionBase,
    DONOR_JWT_SECRET: 'd'.repeat(32),
  }));
});

function payment(overrides: Partial<RazorpayPaymentSnapshot> = {}): RazorpayPaymentSnapshot {
  return {
    id: 'pay_lookup123',
    amount: 25000,
    status: 'captured',
    captured: true,
    email: 'donor@example.com',
    ...overrides,
  };
}

test('certificate lookup requires the exact captured gateway status', () => {
  assert.equal(isCapturedPayment(payment()), true);
  assert.equal(isCapturedPayment(payment({ captured: false })), true);

  for (const status of [undefined, 'authorized', 'refunded', 'failed', 'pending', 'CAPTURED']) {
    const candidate = payment({ status, captured: true });
    assert.equal(isCapturedPayment(candidate), false, `status ${String(status)} must be rejected`);
    assert.equal(paymentMatchesQuery(candidate, 'pay_lookup123'), false);
  }
});

test('certificate payment finder does not import refunded or non-captured payments', async () => {
  const captured = payment({ id: 'pay_captured123' });
  const refunded = payment({ id: 'pay_refunded123', status: 'refunded', captured: true });
  const authorized = payment({ id: 'pay_authorized123', status: 'authorized', captured: true });
  const razorpay = {
    payments: {
      fetch: async (id: string) => id === captured.id ? captured : id === refunded.id ? refunded : authorized,
      all: async () => ({ items: [refunded, authorized] }),
    },
    orders: {
      fetch: async () => ({}),
      fetchPayments: async () => ({ items: [refunded, authorized] }),
    },
  };
  const finder = createRazorpayPaymentFinder(razorpay);

  assert.equal((await finder.findCapturedPayment(captured.id))?.id, captured.id);
  assert.equal(await finder.findCapturedPayment(refunded.id), null);
  assert.equal(await finder.findCapturedPayment(authorized.id), null);
  assert.equal(await finder.findCapturedPayment('donor@example.com'), null);
});

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createPaymentSessionAuthority } from '../frontend/src/utils/paymentSession';

const expected = { id: 'DON-fixture', amount: 501 };
const verified = { ...expected, status: 'verified' };

test('closing checkout invalidates delayed initiation and gateway callbacks even if transport ignores abort', async () => {
  const authority = createPaymentSessionAuthority();
  const attempt = authority.begin();
  let resolve!: (value: typeof verified) => void;
  const delayed = new Promise<typeof verified>((done) => { resolve = done; });
  let navigations = 0;
  const response = delayed.then((data) => { if (attempt.complete(data, expected)) navigations++; });
  authority.cancel();
  resolve(verified);
  await response;
  assert.equal(navigations, 0);
  assert.equal(attempt.signal.aborted, true);
  assert.equal(attempt.isCurrent(), false);
});

test('status polling and Razorpay callback can complete the same active payment only once', async () => {
  const attempt = createPaymentSessionAuthority().begin();
  const accepted = await Promise.all(Array.from({ length: 12 }, async () => attempt.complete(verified, expected)));
  assert.equal(accepted.filter(Boolean).length, 1);
  assert.equal(attempt.signal.aborted, true);
});

test('edit/reopen makes old results inert and allows the new donation to complete', () => {
  const authority = createPaymentSessionAuthority();
  const oldAttempt = authority.begin();
  const next = authority.begin();
  assert.equal(oldAttempt.complete(verified, expected), false);
  assert.equal(oldAttempt.isCurrent(), false);
  assert.equal(next.isCurrent(), true);
  assert.equal(next.complete(verified, expected), true);
});

test('pending, failed, refunded, mismatched amounts/IDs and missing data never complete checkout', () => {
  const attempt = createPaymentSessionAuthority().begin();
  for (const value of [undefined, null, {}, { ...verified, id: 'DON-other' },
    { ...verified, amount: 100 }, { ...verified, status: 'initiated' },
    { ...verified, status: 'failed' }, { ...verified, status: 'refunded' }]) {
    assert.equal(attempt.complete(value, expected), false);
  }
  assert.equal(attempt.isCurrent(), true);
  assert.equal(attempt.complete(verified, expected), true);
});

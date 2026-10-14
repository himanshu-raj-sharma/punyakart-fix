import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveCampaignQuantityChange } from '../frontend/src/utils/campaignQuantity.js';

test('pre-add controls adjust the prepared quantity but never go below one', () => {
  assert.deepEqual(resolveCampaignQuantityChange(0, 1, 1), {
    target: 'stepper',
    nextCartQuantity: 0,
    nextStepperQuantity: 2,
  });
  assert.deepEqual(resolveCampaignQuantityChange(0, 1, -1), {
    target: 'stepper',
    nextCartQuantity: 0,
    nextStepperQuantity: 1,
  });
  assert.deepEqual(resolveCampaignQuantityChange(0, 3, -1), {
    target: 'stepper',
    nextCartQuantity: 0,
    nextStepperQuantity: 2,
  });
});

test('controls increment and decrement the quantity after a product is added', () => {
  assert.deepEqual(resolveCampaignQuantityChange(1, 1, 1), {
    target: 'cart',
    delta: 1,
    nextCartQuantity: 2,
    nextStepperQuantity: 2,
  });
  assert.deepEqual(resolveCampaignQuantityChange(3, 3, -1), {
    target: 'cart',
    delta: -1,
    nextCartQuantity: 2,
    nextStepperQuantity: 2,
  });
});

test('decreasing the final cart unit removes it and resets the next add quantity', () => {
  assert.deepEqual(resolveCampaignQuantityChange(1, 1, -1), {
    target: 'cart',
    delta: -1,
    nextCartQuantity: 0,
    nextStepperQuantity: 1,
  });
});

test('invalid values safely fall back to a quantity of one', () => {
  assert.deepEqual(resolveCampaignQuantityChange(-1, 0, -1), {
    target: 'stepper',
    nextCartQuantity: 0,
    nextStepperQuantity: 1,
  });
  assert.deepEqual(resolveCampaignQuantityChange(2, 2, Number.NaN), {
    target: 'cart',
    delta: 0,
    nextCartQuantity: 2,
    nextStepperQuantity: 2,
  });
});

import { nextCampaignCartQuantity } from '../frontend/src/utils/campaignQuantity.js';

test('live campaign quantities increment, decrement, and remove at zero', () => {
  assert.equal(nextCampaignCartQuantity(0, 1), 1);
  assert.equal(nextCampaignCartQuantity(1, 1), 2);
  assert.equal(nextCampaignCartQuantity(3, -1), 2);
  assert.equal(nextCampaignCartQuantity(1, -1), 0);
  assert.equal(nextCampaignCartQuantity(0, -1), 0);
});

test('live campaign quantity ignores invalid deltas and normalizes invalid counts', () => {
  assert.equal(nextCampaignCartQuantity(-5, 1), 1);
  assert.equal(nextCampaignCartQuantity(2, Number.NaN), 2);
});

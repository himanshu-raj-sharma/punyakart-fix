import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { resolveCampaignQuantityChange, nextCampaignCartQuantity } from '../frontend/src/utils/campaignQuantity.js';

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

test('C1 (LegacyCrowdFundingPage) wires plus/minus to live quantity and displays the updated price', async () => {
  const source = await readFile(
    new URL('../frontend/src/pages/LegacyCrowdFundingPage.tsx', import.meta.url),
    'utf8',
  );

  assert.match(source, /nextCampaignCartQuantity\(cardCounts\[amt\] \|\| 0, delta\)/);
  assert.match(source, /setCardCounts\(updated\)/);
  assert.match(source, /onAmountAndCauseTitleChange\(total, getCauseTitleForCounts\(updated\)\)/);
  assert.match(source, /Added \(\{qty\}\)/);
  assert.match(source, /card\.amt \* qty/);
  assert.match(source, /if \(hasEditedImpactCardQuantities\) return 0/);
});

test('C2 (SecondCampaignPage) uses the shared live cart quantity controls', async () => {
  const page = await readFile(
    new URL('../frontend/src/pages/SecondCampaignPage.tsx', import.meta.url),
    'utf8',
  );
  const controls = await readFile(
    new URL('../frontend/src/components/campaign/CauseContributionSection.tsx', import.meta.url),
    'utf8',
  );

  assert.match(page, /onUpdateCartQty=\{updateCartQuantity\}/);
  assert.match(controls, /handleStepperChange\(card, inCartQty, -1\)/);
  assert.match(controls, /handleStepperChange\(card, inCartQty, 1\)/);
  assert.match(controls, /onUpdateCartQty\(toProductItem\(card\), change\.delta\)/);
  assert.match(controls, /Added \(\{inCartQty\}\)/);
});

test('C3-C7 (TuesdayCampaignPage variants) share the same reactive quantity controls', async () => {
  const app = await readFile(new URL('../frontend/src/App.tsx', import.meta.url), 'utf8');
  const page = await readFile(
    new URL('../frontend/src/pages/TuesdayCampaignPage.tsx', import.meta.url),
    'utf8',
  );

  assert.match(app, /setSelectedCampaignId\('c3'\)/);
  for (const id of ['c4', 'c5', 'c6', 'c7']) {
    assert.ok(app.includes(`campaignId="${id}"`), `App should route ${id} to the Tuesday campaign component`);
  }
  assert.match(page, /campaignId = 'c3'/);
  assert.match(page, /updateQuantity\(id, change\.delta\)/);
  assert.match(page, /handleStepperChange\(card\.id, -1\)/);
  assert.match(page, /handleStepperChange\(card\.id, 1\)/);
  assert.match(page, /Added \(\{inCartQty\}\)/);
});

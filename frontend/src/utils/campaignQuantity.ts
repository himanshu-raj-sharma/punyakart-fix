export type CampaignQuantityChange =
  | {
      target: 'cart';
      nextCartQuantity: number;
      nextStepperQuantity: number;
    }
  | {
      target: 'stepper';
      nextCartQuantity: 0;
      nextStepperQuantity: number;
    };

/**
 * Keep the pre-add quantity selector and the already-added cart quantity in sync.
 * Before a product is added, +/- changes the amount prepared for adding.
 * After it is added, +/- changes the cart quantity; decrementing the last unit
 * removes it and resets the prepared quantity to one for the next add.
 */
export function resolveCampaignQuantityChange(
  currentCartQuantity: number,
  currentStepperQuantity: number,
  delta: number,
): CampaignQuantityChange {
  const cartQuantity =
    Number.isSafeInteger(currentCartQuantity) && currentCartQuantity > 0
      ? currentCartQuantity
      : 0;
  const stepperQuantity =
    Number.isSafeInteger(currentStepperQuantity) && currentStepperQuantity > 0
      ? currentStepperQuantity
      : 1;
  const safeDelta = Number.isSafeInteger(delta) ? delta : 0;

  if (cartQuantity > 0) {
    const nextCartQuantity = Math.max(0, cartQuantity + safeDelta);
    return {
      target: 'cart',
      nextCartQuantity,
      nextStepperQuantity: nextCartQuantity > 0 ? nextCartQuantity : 1,
    };
  }

  return {
    target: 'stepper',
    nextCartQuantity: 0,
    nextStepperQuantity: Math.max(1, stepperQuantity + safeDelta),
  };
}

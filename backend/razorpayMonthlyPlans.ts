/**
 * Razorpay Subscriptions — monthly Auto Pay plans (live).
 * Amount (INR) → Plan ID from Razorpay Dashboard → Subscriptions → Plans.
 *
 * Custom amounts (not in this map) need a dynamic plan via API later.
 */
export const RAZORPAY_MONTHLY_PLAN_BY_AMOUNT: Record<number, string> = {
  22000: 'plan_Ta1TlxJ66nXjN5', // PKF Monthly - Urgent Surgery
  18000: 'plan_Ta1TUBhN2eKeXY', // PKF Monthly - Life Saving Medical Care
  12000: 'plan_Ta1T8JngVgo31M', // PKF Monthly - Rescue & Recovery
  8500: 'plan_Ta1SppbayF3JGa', // PKF Monthly - Treatment
  5000: 'plan_Ta1SWOsO6wjYhX', // PKF Monthly - Emergency Treatment
  3500: 'plan_Ta1S9GzsR7NOxY', // PKF Monthly - Daily Medicine
  2000: 'plan_Ta1Ro0GjGCaNJy', // PKF Monthly - Feed Support
  1000: 'plan_Ta1RL6BjjFawxM', // PKF Monthly - Care Support
  500: 'plan_Ta1QkR7lrF52Cv', // PKF Monthly - Starter Support
};

export function getRazorpayMonthlyPlanId(amountInr: number): string | null {
  const id = RAZORPAY_MONTHLY_PLAN_BY_AMOUNT[amountInr];
  return id || null;
}

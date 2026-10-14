import { createHash } from 'node:crypto';

const PREFIX = 'DON-RECUR-';

/** One payment has one donation identity across callbacks and server processes. */
export function recurringDonationId(paymentId: string): string {
  return `${PREFIX}${createHash('sha256').update(paymentId.trim()).digest('hex')}`;
}

export function isRecurringDonationId(id: string): boolean {
  return id.startsWith(PREFIX);
}

import type { StoredDonation } from '../types.js';

export interface PaymentAttemptResolution {
  attempt: StoredDonation | null;
  transitioned: boolean;
}

/**
 * Checkout attempts live independently from confirmed donations.
 * The attempt keeps the original checkout identity so a delayed Razorpay
 * callback/webhook can still be matched and finalized exactly once.
 */
export interface PaymentAttemptRepository {
  create(attempt: Omit<StoredDonation, 'status'>): Promise<StoredDonation>;
  findById(id: string): Promise<StoredDonation | null>;
  findByRazorpayOrderId(orderId: string): Promise<StoredDonation | null>;
  findByRazorpayQrId(qrId: string): Promise<StoredDonation | null>;
  findByRazorpaySubscriptionId(subscriptionId: string): Promise<StoredDonation | null>;
  findByPaymentRef(paymentRef: string): Promise<StoredDonation | null>;
  updateStatus(
    id: string,
    status: StoredDonation['status'],
    updates?: Partial<StoredDonation>,
  ): Promise<StoredDonation | null>;
  markVerified(
    id: string,
    updates: Pick<StoredDonation, 'verifiedAt' | 'receiptNumber' | 'paymentRef'>,
  ): Promise<PaymentAttemptResolution>;
  recordPaymentFailureByOrder(
    orderId: string,
    reason: string,
    now?: Date,
  ): Promise<StoredDonation | null>;
  listPendingForReconciliation(limit: number, olderThan: Date): Promise<StoredDonation[]>;
  listAdminPending(limit: number): Promise<StoredDonation[]>;
  markReconciliationAttempt(id: string, now: Date): Promise<void>;
  upsertFromLegacy(attempt: StoredDonation): Promise<StoredDonation>;
}

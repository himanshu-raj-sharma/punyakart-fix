import { StoredDonation } from '../types';

export interface DonationRepository {
  initiate(
    donation: Omit<StoredDonation, 'status'>,
  ): Promise<StoredDonation>;

  updateStatus(
    id: string,
    status: StoredDonation['status'],
    updates?: Partial<StoredDonation>,
    options?: { idempotencyKey?: string },
  ): Promise<StoredDonation | null>;

  /** Atomic verification ownership; implemented by the production Mongo adapter.
   * Legacy/test adapters may omit this capability, without concurrency guarantees.
   */
  verifyOnce?(
    id: string,
    updates: Pick<StoredDonation, 'verifiedAt' | 'receiptNumber' | 'paymentRef'>,
  ): Promise<{ donation: StoredDonation | null; transitioned: boolean }>;

  findById(id: string): Promise<StoredDonation | null>;

  findByReceipt(receipt: string): Promise<StoredDonation | null>;

  findByRazorpayOrderId(
    orderId: string,
  ): Promise<StoredDonation | null>;

  findByRazorpayQrId(
    qrId: string,
  ): Promise<StoredDonation | null>;

  findByRazorpaySubscriptionId(
    subscriptionId: string,
  ): Promise<StoredDonation | null>;

  /** Indexed payment lookup used by webhook/retry paths. */
  findByPaymentRef?(paymentRef: string): Promise<StoredDonation | null>;

  /** Apply source attribution before sorting and limiting results. */
  listRecent(limit: number, source?: string): Promise<StoredDonation[]>;

  listEligible(): Promise<StoredDonation[]>;

  listAll(): Promise<StoredDonation[]>;

  /** Legacy unverified rows are reconciled until the one-time archive migration is run. */
  listPendingForReconciliation?(limit: number, olderThan: Date): Promise<StoredDonation[]>;
  markReconciliationAttempt?(id: string, now: Date): Promise<void>;

  searchForCertificate(
    query: string,
  ): Promise<StoredDonation | null>;

  searchForPublicCertificate(
    query: string,
  ): Promise<StoredDonation | null>;

  searchMatches(
    query: string,
    eligibleOnly: boolean,
  ): Promise<StoredDonation[]>;

  nextReceiptNumber(now?: Date): Promise<string>;

  /**
   * Atomically reserve the next unique receipt on this donation
   * or return the existing receipt if one has already been assigned.
   */
  allocateReceiptNumber(
    donationId: string,
    now?: Date,
  ): Promise<string>;

  upsertVerified(
    donation: StoredDonation,
  ): Promise<StoredDonation>;

  findByPhone(
    phone: string,
  ): Promise<StoredDonation[]>;

  verifyDonorSecret(
    phone: string,
    secretId: string,
  ): Promise<boolean>;
}

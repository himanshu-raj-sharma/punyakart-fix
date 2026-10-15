import { randomUUID } from 'node:crypto';
import { BusinessError } from './errors';
import { DonationRepository } from './db/DonationRepository';
import { StoredDonation, CertificateResult, FundRaiserReport, DonationInput } from './types';
import { SubscriptionService } from './subscriptionService';
import { validateDonationPayload } from './validation/donationSchema';
import { getCertificateDetails, notifyDonorAfterVerification } from './notifications/index';
import { GatewayPaymentFinder, mapRazorpayPaymentToDonation } from './razorpayCertificateLookup';
import { isCertificateEligible, isStrongCertificateQuery, verifyDonorDetailsAgainstDonation } from './db/certificateLookup';
import { validateCertificateForm } from './validation/certificateFormSchema';
import { timingSafeEqualText } from './security';
import logger from './logger';
import type { MetaAttribution } from './metaConversions.js';
import type { PaymentAttemptRepository } from './db/PaymentAttemptRepository.js';
import { recurringMetaAttribution } from './metaPaymentTracking.js';
import { sanitizeTrafficAttribution } from '../frontend/src/utils/trafficAttribution.js';
import { inheritedTrafficAttribution } from './trafficAttribution.js';
import { attributedCampaignId, canonicalSourceFilter, resolvedDonationSource, type DonationAttribution } from './campaignAttribution.js';
import { recurringDonationId, isRecurringDonationId } from './recurringDonationIdentity.js';
import { DONATION_AMOUNT_ERROR, isValidDonationAmount, parseDonationAmount } from '../frontend/src/constants/donation';

export function withoutClientToken(donation: StoredDonation): StoredDonation {
  const { clientToken: _token, metaAttribution, metaTrackingAllowed: _ignored, trafficAttribution: _traffic, ...rest } = donation;
  return {
    ...rest,
    metaTrackingAllowed: metaAttribution?.consent === true && donation.status === 'verified'
      && donation.paymentMethod === 'razorpay' && donation.source !== 'manual'
      && /^pay_[A-Za-z0-9]{1,64}$/.test(donation.paymentRef || ''),
  };
}

function normalizeIndianPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 10 ? digits.slice(-10) : digits;
}

/** Historical rows without source are treated as Chennai airport (landing). */
export function resolveDonationSource(donation: DonationAttribution | null | undefined): string {
  return resolvedDonationSource(donation || {});
}

export function filterDonationsBySource<T extends DonationAttribution>(
  records: T[],
  source?: string,
): T[] {
  const wanted = canonicalSourceFilter(source);
  if (!wanted || wanted === 'all') return records;
  return records.filter((row) => resolveDonationSource(row) === wanted);
}

export class DonationService {
  constructor(
    private readonly repository: DonationRepository,
    private readonly _subscriptions: SubscriptionService,
    private readonly gatewayLookup?: GatewayPaymentFinder,
    private readonly notifyAfterVerification: typeof notifyDonorAfterVerification = notifyDonorAfterVerification,
    private readonly paymentAttempts?: PaymentAttemptRepository,
  ) {}

  async listRecent(limit = 30, source?: string): Promise<StoredDonation[]> {
    if (!Number.isInteger(limit) || limit < 1) throw new BusinessError('Result limit is invalid.', 'VALIDATION_ERROR');
    return this.repository.listRecent(limit, source);
  }

  async listEligible(source?: string): Promise<StoredDonation[]> {
    return filterDonationsBySource(await this.repository.listEligible(), source);
  }

  /** Admin donor reports show only confirmed donations, never checkout attempts. */
  async listAll(source?: string): Promise<StoredDonation[]> {
    const records = await this.repository.listAll();
    return filterDonationsBySource(
      records.filter((row) => isCertificateEligible(row.status) || row.status === 'refunded'),
      source,
    );
  }

  async listPaymentAttempts(limit = 200): Promise<StoredDonation[]> {
    const safeLimit = Math.max(0, Math.min(500, Math.floor(limit)));
    if (!safeLimit) return [];
    const [legacyRows, separateRows] = await Promise.all([
      this.repository.listPendingForAdmin
        ? this.repository.listPendingForAdmin(safeLimit)
        : this.repository.listAll().then((records) =>
            records.filter((row) => ['initiated', 'pending_verification', 'failed'].includes(row.status))),
      this.paymentAttempts?.listAdminPending(safeLimit) || Promise.resolve([]),
    ]);
    const rows = new Map<string, StoredDonation>();
    for (const row of legacyRows) rows.set(row.id, row);
    for (const row of separateRows) rows.set(row.id, row);
    return [...rows.values()]
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      .slice(0, safeLimit);
  }

  async listPendingForReconciliation(limit = 25, olderThan = new Date(Date.now() - 60_000)): Promise<StoredDonation[]> {
    const [legacy, attempts] = await Promise.all([
      this.repository.listPendingForReconciliation
        ? this.repository.listPendingForReconciliation(limit, olderThan)
        : Promise.resolve([]),
      this.paymentAttempts?.listPendingForReconciliation(limit, olderThan) || Promise.resolve([]),
    ]);
    const byId = new Map<string, StoredDonation>();
    for (const row of [...legacy, ...attempts]) {
      if (row.status === 'initiated' || row.status === 'pending_verification' || row.status === 'failed') {
        byId.set(row.id, row);
      }
    }
    return [...byId.values()].sort((a, b) => a.timestamp.localeCompare(b.timestamp)).slice(0, Math.max(0, limit));
  }

  async markReconciliationAttempt(id: string, now = new Date()): Promise<void> {
    if (await this.repository.findById(id)) {
      await this.repository.markReconciliationAttempt?.(id, now);
      return;
    }
    await this.paymentAttempts?.markReconciliationAttempt(id, now);
  }

  async searchMatches(query: string): Promise<StoredDonation[]> {
    if (!query.trim()) {
      throw new BusinessError(
        'Enter a receipt number (PKF-), name, mobile number, or transaction ID.',
        'VALIDATION_ERROR',
      );
    }
    const q = query.trim();
    const matches = (await this.repository.searchMatches(q, false))
      .filter((row) => isCertificateEligible(row.status) || row.status === 'refunded');
    if (matches.length > 0) return matches;

    // Fallback: loose receipt match when fuzzy search misses FY-format IDs
    if (/pkf/i.test(q)) {
      const byReceipt = await this.repository.findByReceipt(q);
      if (byReceipt) return [byReceipt];
    }
    return [];
  }

  async initiate(input: unknown, now = new Date(), metaAttribution?: MetaAttribution): Promise<StoredDonation> {
    const validData = validateDonationPayload(input);
    const raw = input && typeof input === 'object' ? input as Record<string, unknown> : {};
    const trafficAttribution = sanitizeTrafficAttribution(raw.trafficAttribution, now.getTime());
    const normalized = {
      ...validData,
      causeTitle: validData.causeTitle.trim(),
      address: validData.address.trim(),
      panNumber: validData.panNumber?.trim().toUpperCase() || '',
      email: validData.email.trim().toLowerCase(),
      fullName: validData.fullName.trim(),
      phone: validData.phone.trim(),
      want80G: true,
      autoPay: validData.type === 'monthly' && Boolean(validData.autoPay),
      fundRaiser: validData.fundRaiser?.trim().replace(/\s+/g, ' ') || undefined,
    };

    const donation: Omit<StoredDonation, 'status'> = {
      ...normalized,
      id: `DON-${randomUUID()}`,
      timestamp: now.toISOString(),
      terminal:
        normalized.source === 'crowd_funding' || normalized.source?.startsWith('campaign_') ? 'Campaign Portal' : 'Chennai Airport Portal',
      source: normalized.source || 'chennai_airport',
      receiptNumber: '',
      transactionId: `TXN${Date.now()}${Math.floor(100 + Math.random() * 900)}`,
      clientToken: randomUUID(),
      ...(metaAttribution ? { metaAttribution } : {}),
      ...(trafficAttribution ? { trafficAttribution } : {}),
    };

    return this.paymentAttempts ? this.paymentAttempts.create(donation) : this.repository.initiate(donation);
  }

  private async updateCheckoutRecord(id: string, updates: Partial<StoredDonation>): Promise<StoredDonation> {
    const existingDonation = await this.repository.findById(id);
    const existingAttempt = existingDonation ? null : await this.paymentAttempts?.findById(id);
    const updated = existingDonation
      ? await this.repository.updateStatus(id, existingDonation.status, updates)
      : existingAttempt
        ? await this.paymentAttempts?.updateStatus(id, existingAttempt.status, updates)
        : null;
    if (!updated) throw new BusinessError('Donation/payment attempt not found', 'NOT_FOUND');
    return updated;
  }

  async attachRazorpayOrder(id: string, razorpayOrderId: string): Promise<StoredDonation> {
    return this.updateCheckoutRecord(id, { razorpayOrderId });
  }

  async attachRazorpayQr(id: string, razorpayQrId: string): Promise<StoredDonation> {
    return this.updateCheckoutRecord(id, { razorpayQrId });
  }

  async attachRazorpaySubscription(id: string, razorpaySubscriptionId: string): Promise<StoredDonation> {
    return this.updateCheckoutRecord(id, { razorpaySubscriptionId });
  }

  async findById(id: string): Promise<StoredDonation | null> {
    return (await this.repository.findById(id)) || (await this.paymentAttempts?.findById(id)) || null;
  }

  async findByPhone(phone: string): Promise<StoredDonation[]> {
    return this.repository.findByPhone(phone);
  }

  async verifyDonorSecret(phone: string, secretId: string): Promise<boolean> {
    return this.repository.verifyDonorSecret(phone, secretId);
  }

  async markFailed(id: string, reason: string): Promise<StoredDonation> {
    const existingDonation = await this.repository.findById(id);
    const existing = existingDonation || (await this.paymentAttempts?.findById(id)) || null;
    if (!existing) throw new BusinessError('Donation/payment attempt not found', 'NOT_FOUND');
    if (existing.status === 'verified' || existing.status === 'refunded') return existing;

    const updated = existingDonation
      ? await this.repository.updateStatus(id, 'failed', { failureReason: reason })
      : await this.paymentAttempts?.updateStatus(id, 'failed', { failureReason: reason });
    if (!updated) throw new BusinessError('Failed to update payment status', 'PERSISTENCE_ERROR');
    return updated;
  }

  assertClientToken(donation: StoredDonation, token?: string): void {
    if (!donation.clientToken || !token || !timingSafeEqualText(donation.clientToken, token)) {
      throw new BusinessError('Unauthorized', 'UNAUTHORIZED');
    }
  }

  async markRefunded(id: string, reason = 'Payment refunded', idempotencyKey?: string): Promise<StoredDonation> {
    const existing = await this.repository.findById(id);
    if (!existing) throw new BusinessError('Donation not found', 'NOT_FOUND');
    if (existing.status === 'refunded') {
      if (idempotencyKey && existing.idempotencyKey === idempotencyKey) return existing;
      return existing;
    }

    const updated = await this.repository.updateStatus(id, 'refunded', { failureReason: reason }, { idempotencyKey });
    if (!updated) throw new BusinessError('Failed to update donation', 'PERSISTENCE_ERROR');
    return updated;
  }

  async verify(id: string, paymentRef: string, now = new Date()): Promise<StoredDonation> {
    // Compatibility path for historical pending rows that have not yet been
    // moved by the explicit legacy-attempt migration.
    const existing = await this.repository.findById(id);
    if (existing) {
      if (isCertificateEligible(existing.status)) {
        // Repair the attempt ledger if the process restarted after the confirmed
        // donation was persisted but before the attempt was marked finalized.
        if (existing.paymentRef && this.paymentAttempts) {
          const attempt = await this.paymentAttempts.findById(id);
          if (attempt && attempt.status !== 'verified') {
            await this.paymentAttempts.markVerified(id, {
              verifiedAt: existing.verifiedAt || now.toISOString(),
              receiptNumber: existing.receiptNumber || '',
              paymentRef: existing.paymentRef,
            });
          }
        }
        return existing;
      }
      if (existing.status === 'refunded') {
        throw new BusinessError('This donation was refunded and cannot be verified.', 'VALIDATION_ERROR');
      }
      const refundObserved = (existing.failureReason || '').startsWith('Refund event observed:');
      const receiptNumber =
        (existing.receiptNumber || '').trim() ||
        (await this.repository.allocateReceiptNumber(id, now));
      const verifiedAt = now.toISOString();
      const verificationUpdates = { verifiedAt, receiptNumber, paymentRef };
      const transition = this.repository.verifyOnce
        ? await this.repository.verifyOnce(id, verificationUpdates)
        : {
            donation: await this.repository.updateStatus(id, 'verified', verificationUpdates,
              { idempotencyKey: paymentRef ? `verify:${id}:${paymentRef}` : undefined }),
            transitioned: true,
          };
      const updated = transition.donation;
      if (!updated) throw new BusinessError('Failed to verify donation', 'PERSISTENCE_ERROR');
      if (!isCertificateEligible(updated.status)) {
        throw new BusinessError('This donation can no longer be verified.', 'VALIDATION_ERROR');
      }
      if (refundObserved) {
        const refunded = await this.repository.updateStatus(updated.id, 'refunded', {
          failureReason: existing.failureReason || 'Payment refunded',
        });
        if (!refunded) throw new BusinessError('Captured refund record could not be finalized.', 'PERSISTENCE_ERROR');
        return refunded;
      }
      if (transition.transitioned) await this.afterVerified(updated, now);
      return updated;
    }

    if (!this.paymentAttempts) {
      throw new BusinessError('Donation not found', 'NOT_FOUND');
    }
    const attempt = await this.paymentAttempts.findById(id);
    if (!attempt) throw new BusinessError('Payment attempt not found', 'NOT_FOUND');
    if (attempt.status === 'refunded') {
      throw new BusinessError('A refunded payment attempt cannot be verified.', 'VALIDATION_ERROR');
    }
    if (attempt.status === 'verified' && attempt.paymentRef && attempt.paymentRef !== paymentRef) {
      throw new BusinessError('Payment attempt is already bound to another payment.', 'VALIDATION_ERROR');
    }

    const existingPayment = this.repository.findByPaymentRef
      ? await this.repository.findByPaymentRef(paymentRef)
      : (await this.repository.listAll()).find((row) => row.paymentRef === paymentRef) || null;
    if (existingPayment && existingPayment.id !== attempt.id) {
      throw new BusinessError('This Razorpay payment is already linked to another donation.', 'VALIDATION_ERROR');
    }

    const receiptNumber = (attempt.receiptNumber || '').trim() || await this.repository.nextReceiptNumber(now);
    const verifiedAt = attempt.verifiedAt || now.toISOString();
    const refundObserved = (attempt.failureReason || '').startsWith('Refund event observed:');
    const { failureReason: _priorFailureReason, ...attemptWithoutFailure } = attempt;
    const candidate: StoredDonation = {
      ...attemptWithoutFailure,
      status: 'verified',
      verifiedAt,
      receiptNumber,
      paymentRef,
      ...(refundObserved && attempt.failureReason ? { failureReason: attempt.failureReason } : {}),
    };

    // Insert-only by donation ID, order ID, and payment ID makes delayed or
    // repeated callbacks/webhooks converge on one confirmed donation.
    const saved = await this.repository.upsertVerified(candidate);
    if (saved.id !== attempt.id || saved.paymentRef !== paymentRef ||
        saved.amount !== attempt.amount || !isCertificateEligible(saved.status)) {
      throw new BusinessError('Captured payment conflicts with an existing donation record.', 'VALIDATION_ERROR');
    }

    const resolution = await this.paymentAttempts.markVerified(attempt.id, {
      verifiedAt: saved.verifiedAt || verifiedAt,
      receiptNumber: saved.receiptNumber || receiptNumber,
      paymentRef,
    });
    if (refundObserved) {
      // If a refund webhook arrived before the capture webhook, retain the
      // captured transaction in the donation ledger but do not issue email/CAPI.
      const refunded = await this.repository.updateStatus(saved.id, 'refunded', {
        failureReason: attempt.failureReason,
      });
      if (!refunded) throw new BusinessError('Captured refund record could not be finalized.', 'PERSISTENCE_ERROR');
      return refunded;
    }
    if (resolution.transitioned) await this.afterVerified(saved, now);
    return saved;
  }

  private async afterVerified(updated: StoredDonation, now: Date): Promise<void> {
    if (updated.type === 'monthly' && updated.autoPay) {
      try {
        if (isRecurringDonationId(updated.id) && updated.razorpaySubscriptionId) {
          await this._subscriptions.bumpNextBilling(updated.razorpaySubscriptionId, now);
        } else await this._subscriptions.create({
          donorName: updated.fullName,
          email: updated.email,
          phone: updated.phone,
          amount: updated.amount,
          causeTitle: updated.causeTitle,
          paymentMethod: updated.paymentMethod,
          panNumber: updated.panNumber,
          initialReceiptNumber: updated.receiptNumber,
          razorpaySubscriptionId: updated.razorpaySubscriptionId,
          seedDonationId: updated.id,
          address: updated.address,
          source: updated.source as DonationInput['source'],
          status: 'ACTIVE',
        }, now);
      } catch (err) {
        logger.warn({ err, donationId: updated.id }, 'Failed to create Auto Pay subscription record');
      }
    }

    void this.notifyAfterVerification(updated).catch((err) => {
      logger.warn({ err, donationId: updated.id }, 'Post-verification notification failed');
    });
  }

  async findByRazorpayOrderId(orderId: string): Promise<StoredDonation | null> {
    return (await this.repository.findByRazorpayOrderId(orderId))
      || (await this.paymentAttempts?.findByRazorpayOrderId(orderId))
      || null;
  }

  async findByRazorpayQrId(qrId: string): Promise<StoredDonation | null> {
    return (await this.repository.findByRazorpayQrId(qrId))
      || (await this.paymentAttempts?.findByRazorpayQrId(qrId))
      || null;
  }

  async findByRazorpaySubscriptionId(subscriptionId: string): Promise<StoredDonation | null> {
    return (await this.repository.findByRazorpaySubscriptionId(subscriptionId))
      || (await this.paymentAttempts?.findByRazorpaySubscriptionId(subscriptionId))
      || null;
  }

  async recordPaymentFailureByRazorpayOrder(orderId: string, reason: string, now = new Date()): Promise<StoredDonation | null> {
    const donation = await this.repository.findByRazorpayOrderId(orderId);
    if (donation) {
      if (isCertificateEligible(donation.status) || donation.status === 'refunded') return donation;
      // Razorpay can report a failed payment attempt while its order remains
      // payable; keep the checkout reconcilable so a subsequent retry can succeed.
      // Never overwrite a previously observed refund event before capture reconciliation.
      const failureReason = (donation.failureReason || '').startsWith('Refund event observed:')
        ? donation.failureReason
        : reason;
      return this.repository.updateStatus(donation.id, donation.status, { failureReason });
    }
    return this.paymentAttempts?.recordPaymentFailureByOrder(orderId, reason, now) || null;
  }

  /**
   * Subsequent Auto Pay charges: create a new verified donation from the local subscription record.
   * Idempotent on paymentRef.
   */
  async recordSubscriptionCharge(input: {
    razorpaySubscriptionId: string;
    paymentId: string;
    amountPaise?: number;
  }): Promise<StoredDonation | null> {
    const paymentId = input.paymentId.trim();
    const subscriptionId = input.razorpaySubscriptionId.trim();
    if (!paymentId || !subscriptionId) return null;

    const already = this.repository.findByPaymentRef
      ? await this.repository.findByPaymentRef(paymentId)
      : (await this.repository.listAll()).find((row) => row.paymentRef === paymentId);
    if (already) {
      if (already.razorpaySubscriptionId !== subscriptionId
        || (input.amountPaise !== undefined && input.amountPaise !== already.amount * 100)) {
        throw new BusinessError('Recurring payment does not match this subscription.', 'VALIDATION_ERROR');
      }
      if (['verified', 'completed', 'failed', 'refunded'].includes(already.status)) return already;
      return this.verify(already.id, paymentId);
    }

    const localSub = await this._subscriptions.findByRazorpaySubscriptionId(subscriptionId);
    const seed =
      (localSub?.seedDonationId ? await this.repository.findById(localSub.seedDonationId) : null) ||
      (await this.repository.findByRazorpaySubscriptionId(subscriptionId));

    if (!localSub && !seed) {
      logger.warn({ subscriptionId, paymentId }, 'Subscription charge with no local seed donation');
      return null;
    }

    if (seed?.razorpaySubscriptionId && seed.razorpaySubscriptionId !== subscriptionId) {
      throw new BusinessError('Recurring payment does not match the seed subscription.', 'VALIDATION_ERROR');
    }

    const amountInr = localSub?.amount || seed!.amount;
    if (!Number.isSafeInteger(amountInr) || amountInr <= 0
      || (input.amountPaise !== undefined && (!Number.isSafeInteger(input.amountPaise)
        || input.amountPaise !== amountInr * 100))) {
      throw new BusinessError('Recurring payment amount does not match the subscription.', 'VALIDATION_ERROR');
    }

    const now = new Date();
    const inheritedAttribution: DonationAttribution = {
      campaignId: seed?.campaignId,
      source: localSub?.source || seed?.source || 'chennai_airport',
    };
    const donation: StoredDonation = {
      id: recurringDonationId(paymentId),
      amount: amountInr,
      type: 'monthly',
      autoPay: true,
      causeTitle: localSub?.causeTitle || seed!.causeTitle,
      fullName: localSub?.donorName || seed!.fullName,
      email: localSub?.email || seed!.email,
      phone: localSub?.phone || seed!.phone,
      address: localSub?.address || seed?.address || '',
      panNumber: localSub?.panNumber || seed?.panNumber || '',
      want80G: true,
      paymentMethod: 'razorpay',
      timestamp: now.toISOString(),
      receiptNumber: '',
      transactionId: `TXN${Date.now()}${Math.floor(100 + Math.random() * 900)}`,
      terminal: seed?.terminal || 'Auto Pay Recurring',
      // New recurring rows use canonical attribution even when their seed
      // mandate predates c7. The seed donation itself is never rewritten.
      source: resolvedDonationSource(inheritedAttribution),
      campaignId: attributedCampaignId(inheritedAttribution),
      status: 'initiated',
      razorpaySubscriptionId: subscriptionId,
      paymentRef: paymentId,
      fundRaiser: seed?.fundRaiser,
      metaAttribution: recurringMetaAttribution(seed?.metaAttribution),
      trafficAttribution: inheritedTrafficAttribution(seed?.trafficAttribution),
    };

    const persisted = this.paymentAttempts ? await this.paymentAttempts.create(donation) : await this.repository.initiate(donation);
    if (persisted.razorpaySubscriptionId !== subscriptionId || persisted.paymentRef !== paymentId || persisted.amount !== amountInr) {
      throw new BusinessError('Recurring payment does not match the stored donation.', 'VALIDATION_ERROR');
    }
    if (['failed', 'refunded'].includes(persisted.status)) return persisted;
    return this.verify(persisted.id, paymentId, now);
  }

  async verifyByRazorpayOrder(orderId: string, paymentRef: string): Promise<StoredDonation | null> {
    const donation = await this.findByRazorpayOrderId(orderId);
    if (!donation) return null;
    return this.verify(donation.id, paymentRef);
  }

  async verifyByDonationId(donationId: string, paymentRef: string): Promise<StoredDonation | null> {
    const donation = await this.findById(donationId);
    if (!donation) return null;
    return this.verify(donation.id, paymentRef);
  }

  async verifyByRazorpayQrId(qrId: string, paymentRef: string): Promise<StoredDonation | null> {
    const donation = await this.findByRazorpayQrId(qrId);
    if (!donation) return null;
    return this.verify(donation.id, paymentRef);
  }

  async failByRazorpayOrder(orderId: string, reason: string): Promise<StoredDonation | null> {
    return this.recordPaymentFailureByRazorpayOrder(orderId, reason);
  }

  async refundByRazorpayOrder(orderId: string, reason = 'Payment refunded'): Promise<StoredDonation | null> {
    const donation = await this.repository.findByRazorpayOrderId(orderId);
    if (donation && (isCertificateEligible(donation.status) || donation.status === 'refunded')) {
      return this.markRefunded(donation.id, reason);
    }
    if (donation) {
      // A refund webhook can arrive before payment.captured while a historical
      // pending row is still in donations. Keep it reconcilable until capture
      // is confirmed, then preserve it as a refunded ledger entry.
      return this.repository.updateStatus(donation.id, donation.status, {
        failureReason: `Refund event observed: ${reason.slice(0, 400)}`,
      });
    }
    const attempt = await this.paymentAttempts?.findByRazorpayOrderId(orderId);
    if (!attempt) return null;
    return this.paymentAttempts?.recordRefundByOrder(orderId, reason) || null;
  }

  async refundByPaymentRef(paymentRef: string, reason = 'Payment refunded'): Promise<StoredDonation | null> {
    const donation = this.repository.findByPaymentRef
      ? await this.repository.findByPaymentRef(paymentRef)
      : (await this.repository.listAll()).find((row) => row.paymentRef === paymentRef);
    if (donation && (isCertificateEligible(donation.status) || donation.status === 'refunded')) {
      return this.markRefunded(donation.id, reason);
    }
    if (donation) {
      return this.repository.updateStatus(donation.id, donation.status, {
        failureReason: `Refund event observed: ${reason.slice(0, 400)}`,
      });
    }
    const attempt = await this.paymentAttempts?.findByPaymentRef(paymentRef);
    if (!attempt) return null;
    if (attempt.razorpayOrderId) {
      return this.paymentAttempts?.recordRefundByOrder(attempt.razorpayOrderId, reason) || null;
    }
    return this.paymentAttempts?.updateStatus(attempt.id, attempt.status, {
      failureReason: `Refund event observed: ${reason.slice(0, 400)}`,
    }) || null;
  }

  async getStatus(id: string): Promise<{ status: string }> {
    const donation = await this.findById(id);
    if (!donation) throw new BusinessError('Donation not found', 'NOT_FOUND');
    return { status: donation.status };
  }

  /** Read-only document lookup. References identify a record; callers must authorize it. */
  async findForDocumentReference(query: string, receiptOnly = false): Promise<StoredDonation | null> {
    const reference = query.trim().toLowerCase();
    if (!reference || reference.length > 200) return null;
    const donation = receiptOnly
      ? await this.repository.findByReceipt(query.trim())
      : await this.repository.searchForPublicCertificate(query.trim());
    if (!donation) return null;
    const references = receiptOnly ? [donation.receiptNumber] : [
      donation.id, donation.receiptNumber, donation.transactionId,
      donation.paymentRef, donation.razorpayOrderId, donation.razorpayQrId,
    ];
    // Repository search can be fuzzy: never let a partial reference select a private record.
    return references.some((value) => value?.trim().toLowerCase() === reference) ? donation : null;
  }

  async findForCertificate(query: string): Promise<CertificateResult> {
    if (!isStrongCertificateQuery(query)) {
      throw new BusinessError(
        'Enter a receipt number (PKF-), transaction ID (TXN), donation ID, or Razorpay payment/order ID.',
        'VALIDATION_ERROR',
      );
    }
    const donation =
      (await this.repository.searchForPublicCertificate(query)) ||
      (await this.importFromRazorpay(query));
    if (!donation) {
      throw new BusinessError('No verified donation record found for the supplied lookup value.', 'NOT_FOUND', {
        query,
      });
    }
    return { donation: withoutClientToken(donation), certificate: getCertificateDetails() };
  }

  /** Legacy compatibility shim: receipt numbers alone never authorize document access. */
  async findForReceiptLookup(_receiptNumber: string): Promise<CertificateResult> {
    // Kept as a compatibility shim for older callers. A receipt number is an
    // identifier, not proof of ownership; the HTTP route authorizes first.
    throw new BusinessError(
      'Login or donor-details verification is required to access this donation document.',
      'UNAUTHORIZED',
    );
  }

  /**
   * Public 80G portal: match by WhatsApp receipt / transaction ID, then verify donor form fields.
   * PAN is always required on the form; if the DB record has no PAN, the submitted PAN is saved.
   */
  async findForCertificateForm(payload: unknown): Promise<CertificateResult> {
    const form = validateCertificateForm(payload);
    if (!isStrongCertificateQuery(form.referenceId)) {
      throw new BusinessError(
        'Enter the receipt number (PKF-…) or transaction ID from your WhatsApp thank-you message.',
        'VALIDATION_ERROR',
      );
    }

    let donation =
      (await this.repository.searchForPublicCertificate(form.referenceId)) ||
      (await this.importFromRazorpay(form.referenceId));

    if (!donation) {
      throw new BusinessError(
        'No verified donation found for this receipt / transaction ID. Check the ID from your WhatsApp message.',
        'NOT_FOUND',
      );
    }

    const check = verifyDonorDetailsAgainstDonation(donation, {
      fullName: form.fullName,
      email: form.email,
      phone: form.phone,
      address: form.address,
      panNumber: form.panNumber,
    });
    if (check.ok === false) {
      throw new BusinessError(
        'Details do not match our donation record. Please enter the same name, email, mobile, and address used while donating.',
        'VALIDATION_ERROR',
        { mismatches: check.mismatches.join(',') },
      );
    }

    const storedPan = (donation.panNumber || '').trim().toUpperCase();
    if (!storedPan && form.panNumber) {
      const updated = await this.repository.updateStatus(donation.id, donation.status, {
        panNumber: form.panNumber,
      });
      if (updated) donation = updated;
    }

    return {
      donation: withoutClientToken({ ...donation, panNumber: donation.panNumber || form.panNumber }),
      certificate: getCertificateDetails(),
    };
  }

  async issueCertificate(id: string, now = new Date(), idempotencyKey?: string): Promise<StoredDonation> {
    const existing = await this.repository.findById(id);
    if (!existing) throw new BusinessError('Donation not found', 'NOT_FOUND');
    if (existing.status === 'failed' || existing.status === 'refunded') {
      throw new BusinessError(
        'This payment cannot be issued an 80G. Create a new 80G from the form instead.',
        'VALIDATION_ERROR',
      );
    }
    if (idempotencyKey && existing.idempotencyKey === idempotencyKey) return existing;

    if (!isCertificateEligible(existing.status)) {
      return this.verify(existing.id, existing.paymentRef || 'admin_manual_80g', now);
    }

    if ((existing.receiptNumber || '').trim()) return existing;

    const receiptNumber = await this.repository.allocateReceiptNumber(existing.id, now);
    const updated = await this.repository.updateStatus(existing.id, 'verified', {
      receiptNumber,
      verifiedAt: existing.verifiedAt || now.toISOString(),
    }, { idempotencyKey });
    if (!updated) throw new BusinessError('Failed to issue certificate', 'PERSISTENCE_ERROR');
    return updated;
  }

  async createManualVerified(input: unknown, now = new Date()): Promise<StoredDonation> {
    const raw = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;

    const fullName = String(raw.fullName || '').trim();
    const email = String(raw.email || '').trim().toLowerCase();
    const phone = normalizeIndianPhone(String(raw.phone || ''));
    const address = String(raw.address || '').trim();
    const panNumber = String(raw.panNumber || '').trim().toUpperCase();
    const causeTitle = String(raw.causeTitle || 'General Donation').trim();
    const amount = typeof raw.amount === 'number' ? raw.amount
      : typeof raw.amount === 'string' ? parseDonationAmount(raw.amount, 'manual') : null;
    const paymentMethodRaw = String(raw.paymentMethod || '').trim().toLowerCase().replace(/\s+/g, '_');
    const allowedMethods = new Set(['cash', 'upi', 'bank_transfer', 'cheque', 'card', 'other', 'razorpay']);
    const paymentMethod = (allowedMethods.has(paymentMethodRaw) ? paymentMethodRaw : '') as DonationInput['paymentMethod'];
    const issuedBy = String(raw.issuedBy || '').trim().replace(/\s+/g, ' ');
    const fundRaiser = String(raw.fundRaiser || '').trim().replace(/\s+/g, ' ');
    const customTxn = String(raw.transactionId || '').trim();
    const donationDateRaw = String(raw.donationDate || '').trim();

    if (!fullName || fullName.length < 2) {
      throw new BusinessError('Donor name is required.', 'VALIDATION_ERROR', { fullName: 'Required' });
    }
    if (!phone || !/^[6-9]\d{9}$/.test(phone)) {
      throw new BusinessError('Valid 10-digit mobile number is required.', 'VALIDATION_ERROR', { phone: 'Invalid' });
    }
    if (!email || !email.includes('@')) {
      throw new BusinessError('Valid email is required.', 'VALIDATION_ERROR', { email: 'Invalid' });
    }
    if (!address || address.length < 5) {
      throw new BusinessError('Address is required.', 'VALIDATION_ERROR', { address: 'Required' });
    }
    if (amount === null || !isValidDonationAmount(amount, 'manual')) {
      throw new BusinessError(DONATION_AMOUNT_ERROR, 'VALIDATION_ERROR', { amount: DONATION_AMOUNT_ERROR });
    }
    if (!paymentMethod || paymentMethod === 'razorpay') {
      throw new BusinessError(
        'Select mode of payment (Cash, UPI, Bank transfer, Cheque, Card, or Other).',
        'VALIDATION_ERROR',
        { paymentMethod: 'Required' },
      );
    }
    if (!issuedBy || issuedBy.length < 2) {
      throw new BusinessError('Enter who created this receipt (staff name).', 'VALIDATION_ERROR', {
        issuedBy: 'Required',
      });
    }
    if (panNumber && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(panNumber)) {
      throw new BusinessError('Invalid PAN format.', 'VALIDATION_ERROR', { panNumber: 'Invalid' });
    }

    let stamp = now;
    if (donationDateRaw) {
      const parsed = Date.parse(donationDateRaw);
      if (!Number.isFinite(parsed)) {
        throw new BusinessError('Invalid donation date.', 'VALIDATION_ERROR', { donationDate: 'Invalid' });
      }
      stamp = new Date(parsed);
    }

    const donation: Omit<StoredDonation, 'status'> = {
      id: `DON-${randomUUID()}`,
      amount,
      type: raw.type === 'monthly' ? 'monthly' : 'one-time',
      causeTitle: causeTitle || 'General Donation',
      fullName,
      email,
      phone,
      address,
      panNumber,
      want80G: raw.want80G !== false,
      paymentMethod,
      fundRaiser: fundRaiser || undefined,
      issuedBy,
      timestamp: stamp.toISOString(),
      terminal: `Manual receipt · ${issuedBy}`,
      source: 'manual',
      receiptNumber: '',
      transactionId: customTxn || `TXN${Date.now()}${Math.floor(100 + Math.random() * 900)}`,
      clientToken: randomUUID(),
    };

    await this.repository.initiate(donation);
    const paymentRef = String(raw.paymentRef || customTxn || `manual_${paymentMethod}`).trim();
    return this.verify(donation.id, paymentRef, stamp);
  }

  async summarizeFundRaisers(): Promise<FundRaiserReport> {
    const records = await this.repository.listEligible();
    const grouped = new Map<string, { name: string; donationCount: number; totalAmount: number }>();
    let unassignedCount = 0;
    let unassignedTotal = 0;

    for (const record of records) {
      const name = (record.fundRaiser || '').trim().replace(/\s+/g, ' ');
      if (!name) {
        unassignedCount += 1;
        unassignedTotal += record.amount;
        continue;
      }
      const key = name.toLowerCase();
      const existing = grouped.get(key);
      if (existing) {
        existing.donationCount += 1;
        existing.totalAmount += record.amount;
      } else {
        grouped.set(key, { name, donationCount: 1, totalAmount: record.amount });
      }
    }

    const fundRaisers = [...grouped.values()].sort((a, b) => b.totalAmount - a.totalAmount);
    return {
      fundRaisers,
      unassigned: {
        name: 'Unassigned',
        donationCount: unassignedCount,
        totalAmount: unassignedTotal,
      },
    };
  }

  private async importFromRazorpay(query: string): Promise<StoredDonation | null> {
    if (!this.gatewayLookup) return null;

    const payment = await this.gatewayLookup.findCapturedPayment(query);
    if (!payment) return null;

    const mapped = mapRazorpayPaymentToDonation(payment);
    const existing =
      (await this.repository.findById(mapped.id)) ||
      (mapped.razorpayOrderId ? await this.repository.findByRazorpayOrderId(mapped.razorpayOrderId) : null);

    if (existing) {
      if (isCertificateEligible(existing.status)) {
        if (!existing.paymentRef || !existing.transactionId) {
          return (
            (await this.repository.updateStatus(existing.id, 'verified', {
              paymentRef: payment.id,
              razorpayOrderId: mapped.razorpayOrderId,
            })) || existing
          );
        }
        return existing;
      }
      return this.verify(existing.id, payment.id);
    }

    const saved = await this.repository.upsertVerified(mapped);
    if (!isCertificateEligible(saved.status)) return null;
    logger.info({ donationId: saved.id, paymentId: payment.id }, 'Imported captured Razorpay payment for 80G lookup');
    return saved;
  }
}

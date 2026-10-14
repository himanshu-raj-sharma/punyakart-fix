import { BusinessError } from './errors';
import type { MongoSubscriptionRepository } from './db/MongoSubscriptionRepository';
import { DonationSource, StoredSubscription } from './types';
import { normalizeDonationSource } from './validation';
import { canonicalSourceFilter } from './campaignAttribution.js';
import { getDonationAmountError, isValidDonationAmount } from '../frontend/src/constants/donation';

export interface SubscriptionInput {
  donorName: string;
  email?: string;
  phone: string;
  amount: number;
  causeTitle: string;
  paymentMethod: string;
  panNumber?: string;
  initialReceiptNumber?: string;
  razorpaySubscriptionId?: string;
  seedDonationId?: string;
  address?: string;
  source?: DonationSource;
  status?: StoredSubscription['status'];
}

function canonicalSubscriptionSource(subscription: StoredSubscription): StoredSubscription {
  return {
    ...subscription,
    // Historical mandates retain their stored source/title, but API
    // consumers see the same canonical Navratri identity as donations.
    source: subscription.source ? canonicalSourceFilter(subscription.source) : subscription.source,
  };
}

export class SubscriptionService {
  constructor(
    private readonly repository: MongoSubscriptionRepository,
  ) {}

  async list(): Promise<StoredSubscription[]> {
    return (await this.repository.list()).map(canonicalSubscriptionSource);
  }

  async findByRazorpaySubscriptionId(
    subscriptionId: string,
  ): Promise<StoredSubscription | null> {
    const id = subscriptionId.trim();

    if (!id) {
      return null;
    }

    const subscription = await this.repository.findByRazorpaySubscriptionId(id);
    return subscription ? canonicalSubscriptionSource(subscription) : null;
  }

  async create(
    input: SubscriptionInput,
    now = new Date(),
  ): Promise<StoredSubscription> {
    if (
      !input.donorName.trim() ||
      !input.phone.trim() ||
      !input.causeTitle.trim()
    ) {
      throw new BusinessError(
        'Monthly subscription details are incomplete.',
        'VALIDATION_ERROR',
      );
    }

    if (input.razorpaySubscriptionId) {
      const existing = await this.findByRazorpaySubscriptionId(
        input.razorpaySubscriptionId,
      );

      if (existing) {
        return canonicalSubscriptionSource(
          (await this.update(existing.id, {
            status: input.status || existing.status,
            initialReceiptNumber:
              input.initialReceiptNumber ||
              existing.initialReceiptNumber,
            seedDonationId:
              input.seedDonationId || existing.seedDonationId,
          })) || existing,
        );
      }
    }

    // Existing mandates retain their original amount; minimums apply to new creation only.
    const source = canonicalSourceFilter(normalizeDonationSource(input.source));
    if (!isValidDonationAmount(input.amount, source)) {
      throw new BusinessError(
        getDonationAmountError(source),
        'VALIDATION_ERROR',
        { amount: getDonationAmountError(source) },
      );
    }

    const nextBillingDate = new Date(now);
    nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);

    const subscription: StoredSubscription = {
      id: `SUB-${Date.now()}`,
      donorName: input.donorName.trim(),
      email: input.email?.trim() || '',
      phone: input.phone.trim(),
      amount: input.amount,
      frequency: 'MONTHLY',
      causeTitle: input.causeTitle.trim(),
      startDate: now.toISOString().slice(0, 10),
      nextBillingDate: nextBillingDate.toISOString().slice(0, 10),
      status: input.status || 'ACTIVE',
      paymentMethod: input.paymentMethod,
      panNumber: input.panNumber?.trim().toUpperCase(),
      initialReceiptNumber: input.initialReceiptNumber,
      razorpaySubscriptionId: input.razorpaySubscriptionId,
      seedDonationId: input.seedDonationId,
      address: input.address?.trim(),
      source,
    };

    await this.repository.insert(subscription);

    return subscription;
  }

  async update(
    id: string,
    patch: Partial<StoredSubscription>,
  ): Promise<StoredSubscription | null> {
    return this.repository.update(id, patch);
  }

  async markCancelled(
    razorpaySubscriptionId: string,
  ): Promise<StoredSubscription | null> {
    const existing = await this.findByRazorpaySubscriptionId(
      razorpaySubscriptionId,
    );

    if (!existing) {
      return null;
    }

    return this.update(existing.id, {
      status: 'CANCELLED',
    });
  }

  async bumpNextBilling(
    razorpaySubscriptionId: string,
    now = new Date(),
  ): Promise<StoredSubscription | null> {
    const existing = await this.findByRazorpaySubscriptionId(
      razorpaySubscriptionId,
    );

    if (!existing) {
      return null;
    }

    const next = new Date(now);
    next.setMonth(next.getMonth() + 1);

    return this.update(existing.id, {
      status: 'ACTIVE',
      nextBillingDate: next.toISOString().slice(0, 10),
    });
  }
}

import type { Collection, Filter } from 'mongodb';
import { getMongoDb } from './mongo.js';
import type { PaymentAttemptRepository, PaymentAttemptResolution } from './PaymentAttemptRepository.js';
import type { StoredDonation } from '../types.js';
import logger from '../logger.js';

interface MongoPaymentAttemptDocument extends StoredDonation {
  _id: string;
  attemptUpdatedAt: string;
  lastReconciliationAt?: string;
  lastPaymentFailureAt?: string;
  lastPaymentFailureReason?: string;
}

const COLLECTION = 'payment_attempts';

function toDocument(attempt: StoredDonation): MongoPaymentAttemptDocument {
  return {
    ...attempt,
    _id: attempt.id,
    attemptUpdatedAt: new Date().toISOString(),
  };
}

function fromDocument(document: MongoPaymentAttemptDocument | null): StoredDonation | null {
  if (!document) return null;
  const {
    _id: _ignoredId,
    attemptUpdatedAt: _ignoredUpdatedAt,
    lastReconciliationAt: _ignoredReconciliationAt,
    lastPaymentFailureAt: _ignoredFailureAt,
    lastPaymentFailureReason: _ignoredFailureReason,
    ...attempt
  } = document;
  return attempt;
}

export class MongoPaymentAttemptRepository implements PaymentAttemptRepository {
  private async collection(): Promise<Collection<MongoPaymentAttemptDocument>> {
    return (await getMongoDb()).collection<MongoPaymentAttemptDocument>(COLLECTION);
  }

  async ensureIndexes(): Promise<void> {
    const collection = await this.collection();
    await Promise.all([
      collection.createIndex({ razorpayOrderId: 1 }, { sparse: true }),
      collection.createIndex({ razorpayQrId: 1 }, { sparse: true }),
      collection.createIndex({ razorpaySubscriptionId: 1 }, { sparse: true }),
      collection.createIndex({ paymentRef: 1 }, { sparse: true }),
      collection.createIndex({ status: 1, lastReconciliationAt: 1, timestamp: 1 }),
      collection.createIndex({ timestamp: -1 }),
    ]);
    logger.info('MongoDB payment-attempt indexes ensured');
  }

  async create(attempt: Omit<StoredDonation, 'status'>): Promise<StoredDonation> {
    const collection = await this.collection();
    const document = toDocument({ ...attempt, status: 'initiated' });
    await collection.insertOne(document);
    return fromDocument(document)!;
  }

  private async find(filter: Filter<MongoPaymentAttemptDocument>): Promise<StoredDonation | null> {
    return fromDocument(await (await this.collection()).findOne(filter));
  }

  async findById(id: string): Promise<StoredDonation | null> {
    return this.find({ _id: id });
  }

  async findByRazorpayOrderId(orderId: string): Promise<StoredDonation | null> {
    const value = orderId.trim();
    return value ? this.find({ razorpayOrderId: value }) : null;
  }

  async findByRazorpayQrId(qrId: string): Promise<StoredDonation | null> {
    const value = qrId.trim();
    return value ? this.find({ razorpayQrId: value }) : null;
  }

  async findByRazorpaySubscriptionId(subscriptionId: string): Promise<StoredDonation | null> {
    const value = subscriptionId.trim();
    return value ? this.find({ razorpaySubscriptionId: value }) : null;
  }

  async findByPaymentRef(paymentRef: string): Promise<StoredDonation | null> {
    const value = paymentRef.trim();
    return value ? this.find({ paymentRef: value }) : null;
  }

  async updateStatus(
    id: string,
    status: StoredDonation['status'],
    updates: Partial<StoredDonation> = {},
  ): Promise<StoredDonation | null> {
    const collection = await this.collection();
    for (let retry = 0; retry < 3; retry++) {
      const current = await collection.findOne({ _id: id });
      if (!current) return null;
      if (current.status === 'verified' || current.status === 'refunded') return fromDocument(current);
      const { id: _id, status: _status, ...patch } = updates;
      const updated = await collection.findOneAndUpdate(
        { _id: id, status: current.status },
        { $set: { ...patch, status, attemptUpdatedAt: new Date().toISOString() } },
        { returnDocument: 'after' },
      );
      if (updated) return fromDocument(updated);
    }
    throw new Error('Payment attempt changed concurrently; retry the operation.');
  }

  async markVerified(
    id: string,
    updates: Pick<StoredDonation, 'verifiedAt' | 'receiptNumber' | 'paymentRef'>,
  ): Promise<PaymentAttemptResolution> {
    const collection = await this.collection();
    const updated = await collection.findOneAndUpdate(
      { _id: id, status: { $in: ['initiated', 'pending_verification', 'failed'] } },
      {
        $set: {
          ...updates,
          status: 'verified',
          attemptUpdatedAt: new Date().toISOString(),
        },
      },
      { returnDocument: 'after' },
    );
    if (updated) return { attempt: fromDocument(updated), transitioned: true };
    return { attempt: fromDocument(await collection.findOne({ _id: id })), transitioned: false };
  }

  async recordPaymentFailureByOrder(
    orderId: string,
    reason: string,
    now = new Date(),
  ): Promise<StoredDonation | null> {
    const collection = await this.collection();
    const updated = await collection.findOneAndUpdate(
      {
        razorpayOrderId: orderId,
        status: { $in: ['initiated', 'pending_verification', 'failed'] },
      },
      {
        $set: {
          lastPaymentFailureAt: now.toISOString(),
          lastPaymentFailureReason: reason.slice(0, 500),
          attemptUpdatedAt: now.toISOString(),
        },
      },
      { returnDocument: 'after' },
    );
    return fromDocument(updated);
  }

  async listPendingForReconciliation(limit: number, olderThan: Date): Promise<StoredDonation[]> {
    const safeLimit = Math.max(0, Math.min(100, Math.floor(limit)));
    if (!safeLimit) return [];
    const collection = await this.collection();
    const rows = await collection.find({
      status: { $in: ['initiated', 'pending_verification', 'failed'] },
      razorpayOrderId: { $exists: true, $nin: ['', null] },
      timestamp: { $lte: olderThan.toISOString() },
    }).sort({ lastReconciliationAt: 1, timestamp: 1 }).limit(safeLimit).toArray();
    return rows.map(fromDocument).filter((row): row is StoredDonation => Boolean(row));
  }

  async markReconciliationAttempt(id: string, now: Date): Promise<void> {
    await (await this.collection()).updateOne(
      { _id: id, status: { $in: ['initiated', 'pending_verification', 'failed'] } },
      { $set: { lastReconciliationAt: now.toISOString(), attemptUpdatedAt: now.toISOString() } },
    );
  }

  async upsertFromLegacy(attempt: StoredDonation): Promise<StoredDonation> {
    const collection = await this.collection();
    const document = toDocument(attempt);
    try {
      await collection.updateOne({ _id: attempt.id }, { $setOnInsert: document }, { upsert: true });
    } catch (error) {
      if (!error || typeof error !== 'object' || !('code' in error) || error.code !== 11000) throw error;
    }
    const saved = await collection.findOne({ _id: attempt.id });
    if (!saved || saved.amount !== attempt.amount ||
      (saved.razorpayOrderId || '') !== (attempt.razorpayOrderId || '') ||
      saved.email !== attempt.email) {
      throw new Error('Legacy payment-attempt copy failed identity validation.');
    }
    return fromDocument(saved)!;
  }
}

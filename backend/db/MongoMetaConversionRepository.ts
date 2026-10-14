import type { Collection } from 'mongodb';
import { getMongoDb } from './mongo.js';

/** Only the prepared, allowlisted event is stored; donor contact details never enter this collection. */
export interface MetaPurchaseEvent {
  event_name: 'Purchase';
  event_id: string;
  event_time: number;
  action_source: 'website';
  event_source_url: string;
  custom_data: { value: number; currency: 'INR' };
  user_data: {
    em?: string[];
    ph?: string[];
    fbp?: string;
    fbc?: string;
    client_user_agent?: string;
  };
}

export type MetaDeliveryFailure =
  | 'network_or_timeout'
  | 'meta_transient'
  | 'meta_rejected'
  | 'expired'
  | 'attempts_exhausted';

export interface MetaOutboxInsert {
  /** Permanent deduplication key: pixel:Purchase:gateway payment ID (shared by test and live mode). */
  _id: string;
  pixelId: string;
  event: MetaPurchaseEvent;
  testEventCode?: string;
  createdAt: number;
  expiresAt: number;
}

export interface MetaOutboxRecord extends MetaOutboxInsert {
  state: 'pending' | 'leased' | 'delivered' | 'dead';
  attempts: number;
  nextAttemptAt: number;
  leaseOwner?: string;
  leaseUntil?: number;
  lastFailure?: MetaDeliveryFailure;
  completedAt?: number;
}

export interface MetaLeaseRequest {
  pixelId: string;
  now: number;
  leaseOwner: string;
  leaseMs: number;
  maxAttempts: number;
}

export type MetaSettlement =
  | { state: 'delivered' }
  | { state: 'dead'; reason: MetaDeliveryFailure }
  | { state: 'pending'; reason: MetaDeliveryFailure; nextAttemptAt: number };

/** Implement this interface with in-memory storage in isolated tests. */
export interface MetaConversionOutbox {
  ensureIndexes(): Promise<void>;
  enqueue(entry: MetaOutboxInsert): Promise<void>;
  retireExpired(pixelId: string, now: number, maxAttempts: number): Promise<void>;
  leaseNext(request: MetaLeaseRequest): Promise<MetaOutboxRecord | null>;
  settle(id: string, leaseOwner: string, now: number, outcome: MetaSettlement): Promise<boolean>;
}

export class MongoMetaConversionRepository implements MetaConversionOutbox {
  constructor(
    private readonly getCollection: () => Promise<Collection<MetaOutboxRecord>> = async () => {
      const db = await getMongoDb();
      return db.collection<MetaOutboxRecord>('meta_conversion_outbox');
    },
  ) {}

  // Called lazily by the worker, never by imports or disabled services. A failure is retried next flush.
  async ensureIndexes(): Promise<void> {
    const collection = await this.getCollection();
    await collection.createIndex(
      { pixelId: 1, 'event.event_name': 1, 'event.event_id': 1 },
      { unique: true, name: 'meta_purchase_identity' },
    );
    await collection.createIndex(
      { pixelId: 1, state: 1, nextAttemptAt: 1, leaseUntil: 1 },
      { name: 'meta_delivery_queue' },
    );
    // No TTL: delivered/dead keys must survive to prevent a later test/live mode change replaying them.
  }

  async enqueue(entry: MetaOutboxInsert): Promise<void> {
    const collection = await this.getCollection();
    try {
      await collection.updateOne(
        { _id: entry._id },
        { $setOnInsert: { ...entry, state: 'pending', attempts: 0, nextAttemptAt: entry.createdAt } },
        { upsert: true, writeConcern: { w: 'majority' } },
      );
    } catch (error) {
      // Concurrent upserts may race on the built-in unique _id index even before ensureIndexes.
      if (!error || typeof error !== 'object' || !('code' in error) || error.code !== 11000) throw error;
    }
  }

  async retireExpired(pixelId: string, now: number, maxAttempts: number): Promise<void> {
    const collection = await this.getCollection();
    const available = {
      pixelId,
      $or: [{ state: 'pending' as const }, { state: 'leased' as const, leaseUntil: { $lte: now } }],
    };
    await collection.updateMany(
      { ...available, expiresAt: { $lte: now } },
      { $set: { state: 'dead', lastFailure: 'expired', completedAt: now }, $unset: { leaseOwner: '', leaseUntil: '' } },
      { writeConcern: { w: 'majority' } },
    );
    await collection.updateMany(
      { ...available, attempts: { $gte: maxAttempts } },
      { $set: { state: 'dead', lastFailure: 'attempts_exhausted', completedAt: now }, $unset: { leaseOwner: '', leaseUntil: '' } },
      { writeConcern: { w: 'majority' } },
    );
  }

  async leaseNext(request: MetaLeaseRequest): Promise<MetaOutboxRecord | null> {
    const collection = await this.getCollection();
    return collection.findOneAndUpdate(
      {
        pixelId: request.pixelId,
        expiresAt: { $gt: request.now },
        nextAttemptAt: { $lte: request.now },
        attempts: { $lt: request.maxAttempts },
        $or: [{ state: 'pending' }, { state: 'leased', leaseUntil: { $lte: request.now } }],
      },
      {
        $set: { state: 'leased', leaseOwner: request.leaseOwner, leaseUntil: request.now + request.leaseMs },
        $inc: { attempts: 1 },
      },
      { sort: { nextAttemptAt: 1, _id: 1 }, returnDocument: 'after', includeResultMetadata: false, writeConcern: { w: 'majority' } },
    );
  }

  async settle(id: string, leaseOwner: string, now: number, outcome: MetaSettlement): Promise<boolean> {
    const collection = await this.getCollection();
    const result = await collection.updateOne(
      // An expired/stolen lease can never acknowledge or reschedule another worker's delivery.
      { _id: id, state: 'leased', leaseOwner, leaseUntil: { $gt: now } },
      {
        $set: outcome.state === 'delivered'
          ? { state: outcome.state, completedAt: now }
          : outcome.state === 'dead'
            ? { state: outcome.state, completedAt: now, lastFailure: outcome.reason }
            : { state: outcome.state, nextAttemptAt: outcome.nextAttemptAt, lastFailure: outcome.reason },
        $unset: { leaseOwner: '', leaseUntil: '', ...(outcome.state === 'delivered' ? { lastFailure: '' as const } : {}) },
      },
      { writeConcern: { w: 'majority' } },
    );
    return result.modifiedCount === 1;
  }
}

import { Collection } from 'mongodb';
import { getMongoDb } from './mongo';
import { StoredSubscription } from '../types';

const SUBSCRIPTIONS_COLLECTION = 'subscriptions';

type MongoSubscriptionDocument = StoredSubscription & {
  _id: string;
};

export class MongoSubscriptionRepository {
  private async getCollection(): Promise<
    Collection<MongoSubscriptionDocument>
  > {
    const db = await getMongoDb();

    return db.collection<MongoSubscriptionDocument>(
      SUBSCRIPTIONS_COLLECTION,
    );
  }

  async ensureIndexes(): Promise<void> {
    const collection = await this.getCollection();

    // MongoDB automatically creates and maintains a unique _id index.
    // Do not create a second _id index manually.

    await collection.createIndex(
      { razorpaySubscriptionId: 1 },
      {
        unique: true,
        sparse: true,
      },
    );

    await collection.createIndex({
      status: 1,
    });

    await collection.createIndex({
      phone: 1,
    });

    await collection.createIndex({
      startDate: -1,
    });
  }

  async list(): Promise<StoredSubscription[]> {
    const collection = await this.getCollection();

    const records = await collection
      .find({})
      .sort({
        startDate: -1,
      })
      .toArray();

    return records.map((record) =>
      this.fromDocument(record),
    );
  }

  async findById(
    id: string,
  ): Promise<StoredSubscription | null> {
    const value = id.trim();

    if (!value) {
      return null;
    }

    const collection = await this.getCollection();

    const record = await collection.findOne({
      _id: value,
    });

    return record
      ? this.fromDocument(record)
      : null;
  }

  async findByRazorpaySubscriptionId(
    subscriptionId: string,
  ): Promise<StoredSubscription | null> {
    const value = subscriptionId.trim();

    if (!value) {
      return null;
    }

    const collection = await this.getCollection();

    const record = await collection.findOne({
      razorpaySubscriptionId: value,
    });

    return record
      ? this.fromDocument(record)
      : null;
  }

  async insert(
    subscription: StoredSubscription,
  ): Promise<StoredSubscription> {
    const collection = await this.getCollection();

    const document = this.toDocument(subscription);

    await collection.insertOne(document);

    return subscription;
  }

  async update(
    id: string,
    patch: Partial<StoredSubscription>,
  ): Promise<StoredSubscription | null> {
    const value = id.trim();

    if (!value) {
      return null;
    }

    const collection = await this.getCollection();

    const existing = await collection.findOne({
      _id: value,
    });

    if (!existing) {
      return null;
    }

    const updated: StoredSubscription = {
      ...this.fromDocument(existing),
      ...patch,
    };

    await collection.replaceOne(
      {
        _id: value,
      },
      this.toDocument(updated),
    );

    return updated;
  }

  async replace(
    records: StoredSubscription[],
  ): Promise<void> {
    const collection = await this.getCollection();

    const operations = records.map((record) => ({
      replaceOne: {
        filter: {
          _id: record.id,
        },
        replacement: this.toDocument(record),
        upsert: true,
      },
    }));

    if (operations.length > 0) {
      await collection.bulkWrite(operations);
    }

    const ids = records.map(
      (record) => record.id,
    );

    if (ids.length === 0) {
      await collection.deleteMany({});
      return;
    }

    await collection.deleteMany({
      _id: {
        $nin: ids,
      },
    });
  }

  async clear(): Promise<void> {
    const collection = await this.getCollection();

    await collection.deleteMany({});
  }

  private toDocument(
    subscription: StoredSubscription,
  ): MongoSubscriptionDocument {
    return {
      _id: subscription.id,
      ...subscription,
    };
  }

  private fromDocument(
    document: MongoSubscriptionDocument,
  ): StoredSubscription {
    const {
      _id: _ignoredId,
      ...subscription
    } = document;

    return subscription;
  }
}
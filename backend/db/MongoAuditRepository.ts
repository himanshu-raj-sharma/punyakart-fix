import { Collection } from 'mongodb';
import { getMongoDb } from './mongo';
import type { AuditRecord } from './auditTypes';

const AUDIT_COLLECTION = 'audit_logs';

export class MongoAuditRepository {
  private async getCollection(): Promise<Collection<AuditRecord>> {
    const db = await getMongoDb();

    return db.collection<AuditRecord>(AUDIT_COLLECTION);
  }

  async ensureIndexes(): Promise<void> {
    const collection = await this.getCollection();

    await collection.createIndex(
      { id: 1 },
      { unique: true },
    );

    await collection.createIndex({
      createdAt: -1,
    });

    await collection.createIndex({
      event: 1,
    });

    await collection.createIndex({
      donorId: 1,
      createdAt: -1,
    });
  }

  async list(): Promise<AuditRecord[]> {
    const collection = await this.getCollection();

    return collection
      .find({})
      .sort({ createdAt: -1 })
      .toArray();
  }

  async findById(id: string): Promise<AuditRecord | null> {
    const collection = await this.getCollection();

    return collection.findOne({ id });
  }

  async insert(record: AuditRecord): Promise<AuditRecord> {
    const collection = await this.getCollection();

    await collection.insertOne(record);

    return record;
  }

  async deleteByIds(ids: string[]): Promise<void> {
    if (ids.length === 0) {
      return;
    }

    const collection = await this.getCollection();

    await collection.deleteMany({
      id: {
        $in: ids,
      },
    });
  }

  async replace(records: AuditRecord[]): Promise<void> {
    const collection = await this.getCollection();

    if (records.length === 0) {
      await collection.deleteMany({});
      return;
    }

    const operations = records.map((record) => ({
      replaceOne: {
        filter: { id: record.id },
        replacement: record,
        upsert: true,
      },
    }));

    await collection.bulkWrite(operations);

    const ids = records.map((record) => record.id);

    await collection.deleteMany({
      id: {
        $nin: ids,
      },
    });
  }

  async clear(): Promise<void> {
    const collection = await this.getCollection();

    await collection.deleteMany({});
  }
}
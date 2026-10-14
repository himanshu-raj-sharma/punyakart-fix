import { Collection } from 'mongodb';
import { getMongoDb } from './mongo';
import { CertificateDownloadRecord } from '../types';

export class MongoDownloadRepository {
  constructor(
    private readonly collectionName:
      | 'certificate_downloads'
      | 'receipt_downloads',
  ) {}

  private async getCollection(): Promise<
    Collection<CertificateDownloadRecord>
  > {
    const db = await getMongoDb();

    return db.collection<CertificateDownloadRecord>(this.collectionName);
  }

  async ensureIndexes(): Promise<void> {
    const collection = await this.getCollection();

    await collection.createIndex(
      { id: 1 },
      {
        unique: true,
      },
    );

    await collection.createIndex(
      { donationId: 1 },
      {
        unique: true,
      },
    );

    await collection.createIndex({
      downloadedAt: -1,
    });

    await collection.createIndex({
      source: 1,
    });
  }

  async list(): Promise<CertificateDownloadRecord[]> {
    const collection = await this.getCollection();

    return collection
      .find({})
      .sort({
        downloadedAt: -1,
      })
      .toArray();
  }

  async findById(
    id: string,
  ): Promise<CertificateDownloadRecord | null> {
    const value = id.trim();

    if (!value) {
      return null;
    }

    const collection = await this.getCollection();

    return collection.findOne({
      id: value,
    });
  }

  async findByDonationId(
    donationId: string,
  ): Promise<CertificateDownloadRecord | null> {
    const value = donationId.trim();

    if (!value) {
      return null;
    }

    const collection = await this.getCollection();

    return collection.findOne({
      donationId: value,
    });
  }

  async insert(
    record: CertificateDownloadRecord,
  ): Promise<CertificateDownloadRecord> {
    const collection = await this.getCollection();

    await collection.insertOne(record);

    return record;
  }

  async replace(
    records: CertificateDownloadRecord[],
  ): Promise<void> {
    const collection = await this.getCollection();

    if (records.length === 0) {
      await collection.deleteMany({});
      return;
    }

    const operations = records.map((record) => ({
      replaceOne: {
        filter: {
          id: record.id,
        },
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

  async upsert(
    record: CertificateDownloadRecord,
  ): Promise<CertificateDownloadRecord> {
    const collection = await this.getCollection();

    await collection.replaceOne(
      {
        id: record.id,
      },
      record,
      {
        upsert: true,
      },
    );

    return record;
  }

  async deleteAll(): Promise<void> {
    const collection = await this.getCollection();

    await collection.deleteMany({});
  }
}
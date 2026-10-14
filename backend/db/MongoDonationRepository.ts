import {
  Collection,
  Filter,
  UpdateFilter,
} from 'mongodb';
import { getMongoDb } from './mongo.js';
import { DonationRepository } from './DonationRepository.js';
import { StoredDonation } from '../types.js';
import {
  findBestCertificateMatch,
  findCertificateMatches,
  findPublicCertificateMatch,
  isCertificateEligible,
  idsMatchLoose,
  last10,
} from './certificateLookup.js';
import { indianFinancialYear } from '../receiptNumber.js';
import logger from '../logger.js';
import { donationSourceMatch } from '../campaignAttribution.js';

interface MongoDonationDocument
  extends StoredDonation {
  _id: string;
  phoneLast10?: string;
  receiptNumberCompact?: string;
  idempotencyKey?: string;
}

interface ReceiptCounterDocument {
  _id: string;
  sequence: number;
}

const DONATIONS_COLLECTION =
  'donations';

const COUNTERS_COLLECTION =
  'counters';

function compact(
  value: string | undefined,
): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function normalizePhone(
  value: string | undefined,
): string {
  return last10(value || '');
}

function toDocument(
  donation: StoredDonation,
): MongoDonationDocument {
  return {
    ...donation,
    _id: donation.id,
    phoneLast10:
      normalizePhone(donation.phone),
    receiptNumberCompact:
      compact(donation.receiptNumber),
  };
}

function fromDocument(
  document: MongoDonationDocument | null,
): StoredDonation | null {
  if (!document) {
    return null;
  }

  const {
    _id: _ignoredId,
    phoneLast10: _ignoredPhone,
    receiptNumberCompact: _ignoredReceipt,
    ...donation
  } = document;

  return donation;
}

export class MongoDonationRepository
  implements DonationRepository
{
  private readonly getCollection =
    async (): Promise<
      Collection<MongoDonationDocument>
    > => {
      const db = await getMongoDb();

      return db.collection<MongoDonationDocument>(
        DONATIONS_COLLECTION,
      );
    };

  private readonly getCounters =
    async (): Promise<
      Collection<ReceiptCounterDocument>
    > => {
      const db = await getMongoDb();

      return db.collection<ReceiptCounterDocument>(
        COUNTERS_COLLECTION,
      );
    };

  private async findDocument(
    filter: Filter<MongoDonationDocument>,
  ): Promise<MongoDonationDocument | null> {
    const collection =
      await this.getCollection();

    return collection.findOne(filter);
  }

  async initiate(
    donation: Omit<StoredDonation, 'status'>,
  ): Promise<StoredDonation> {
    const collection =
      await this.getCollection();

    const document = toDocument({
      ...donation,
      status: 'initiated',
    });

    try {
      await collection.insertOne(document);
    } catch (error) {
      // Deterministic recurring IDs converge on Mongo's existing unique _id.
      if (!error || typeof error !== 'object' || !('code' in error) || error.code !== 11000) throw error;
      const existing = await collection.findOne({ _id: document._id });
      if (!existing || !donation.paymentRef || !donation.razorpaySubscriptionId
        || existing.paymentRef !== donation.paymentRef
        || existing.razorpaySubscriptionId !== donation.razorpaySubscriptionId
        || existing.amount !== donation.amount) throw error;
      return fromDocument(existing)!;
    }

    return fromDocument(document)!;
  }

  async updateStatus(
    id: string,
    status: StoredDonation['status'],
    updates?: Partial<StoredDonation> & { idempotencyKey?: string },
    options?: { idempotencyKey?: string },
  ): Promise<StoredDonation | null> {
    const collection = await this.getCollection();
    const idempotencyKey = options?.idempotencyKey || updates?.idempotencyKey;
    // Never replace a whole stale document: payment, receipt and attribution
    // fields may have been written by a concurrent webhook/status request.
    for (let attempt = 0; attempt < 3; attempt++) {
      const current = await collection.findOne({ _id: id });
      if (!current) return null;
      if (idempotencyKey && current.idempotencyKey === idempotencyKey) return fromDocument(current);
      const terminal = ['verified', 'completed', 'refunded'].includes(current.status);
      if (current.status === 'refunded' && status !== 'refunded') return fromDocument(current);
      if (terminal && (status === 'failed' || status === 'pending_verification')) return fromDocument(current);
      if (['verified', 'completed'].includes(current.status) && status === 'verified' && current.paymentRef && updates?.paymentRef) {
        return fromDocument(current);
      }

      const { id: _id, campaignId: _campaignId, source: _source, status: _status, ...patch } = updates || {};
      const set: Partial<MongoDonationDocument> = {
        ...patch,
        // Gateway IDs may arrive after a capture; attaching them must not undo it.
        status: terminal && status === 'initiated' ? current.status : status,
        ...(idempotencyKey ? { idempotencyKey } : {}),
      };
      if (patch.phone !== undefined) set.phoneLast10 = normalizePhone(patch.phone);
      if (patch.receiptNumber !== undefined) set.receiptNumberCompact = compact(patch.receiptNumber);
      const updated = await collection.findOneAndUpdate(
        { _id: id, status: current.status },
        { $set: set },
        { returnDocument: 'after' },
      );
      if (updated) return fromDocument(updated);
    }
    throw new Error('Donation status changed concurrently; retry the operation.');
  }

  async verifyOnce(
    id: string,
    updates: Pick<StoredDonation, 'verifiedAt' | 'receiptNumber' | 'paymentRef'>,
  ): Promise<{ donation: StoredDonation | null; transitioned: boolean }> {
    const collection = await this.getCollection();
    const updated = await collection.findOneAndUpdate(
      { _id: id, status: { $in: ['initiated', 'pending_verification', 'failed'] } },
      { $set: {
        ...updates,
        status: 'verified',
        receiptNumberCompact: compact(updates.receiptNumber),
        idempotencyKey: `verify:${id}:${updates.paymentRef || ''}`,
      } },
      { returnDocument: 'after' },
    );
    return updated
      ? { donation: fromDocument(updated), transitioned: true }
      : { donation: fromDocument(await collection.findOne({ _id: id })), transitioned: false };
  }

  async findById(
    id: string,
  ): Promise<StoredDonation | null> {
    return fromDocument(
      await this.findDocument({
        _id: id,
      }),
    );
  }

  async findByReceipt(
    receipt: string,
  ): Promise<StoredDonation | null> {
    const normalized =
      receipt.trim();

    if (!normalized) {
      return null;
    }

    const collection =
      await this.getCollection();

    const exact =
      await collection.findOne({
        receiptNumberCompact:
          compact(normalized),
        status: {
          $in: [
            'verified',
            'completed',
          ] as never[],
        },
      });

    if (exact) {
      return fromDocument(exact);
    }

    const records =
      await collection
        .find({
          status: {
            $in: [
              'verified',
              'completed',
            ] as never[],
          },
        })
        .toArray();

    const matched =
      records
        .map((record) =>
          fromDocument(record),
        )
        .filter(
          (
            record,
          ): record is StoredDonation =>
            Boolean(record),
        )
        .find((record) =>
          idsMatchLoose(
            record.receiptNumber,
            normalized,
          ),
        );

    return matched || null;
  }

  async findByRazorpayOrderId(
    orderId: string,
  ): Promise<StoredDonation | null> {
    const value =
      orderId.trim();

    if (!value) {
      return null;
    }

    return fromDocument(
      await this.findDocument({
        razorpayOrderId: value,
      }),
    );
  }

  async findByRazorpayQrId(
    qrId: string,
  ): Promise<StoredDonation | null> {
    const value =
      qrId.trim();

    if (!value) {
      return null;
    }

    return fromDocument(
      await this.findDocument({
        razorpayQrId: value,
      }),
    );
  }

  async findByRazorpaySubscriptionId(
    subscriptionId: string,
  ): Promise<StoredDonation | null> {
    const value =
      subscriptionId.trim();

    if (!value) {
      return null;
    }

    return fromDocument(
      await this.findDocument({
        razorpaySubscriptionId:
          value,
      }),
    );
  }

  async findByPaymentRef(paymentRef: string): Promise<StoredDonation | null> {
    const value = paymentRef.trim();
    if (!value) return null;
    return fromDocument(await this.findDocument({ paymentRef: value }));
  }

  async listRecent(
    limit: number,
    source?: string,
  ): Promise<StoredDonation[]> {
    const collection =
      await this.getCollection();

    const safeLimit =
      Math.max(
        0,
        Math.floor(limit),
      );

    if (safeLimit === 0) {
      return [];
    }

    const records =
      await collection
        .aggregate<MongoDonationDocument>([
          { $match: { status: { $in: ['verified', 'completed'] }, ...donationSourceMatch(source) } },
          { $addFields: { _recentAt: { $cond: [
            { $in: [{ $ifNull: ['$verifiedAt', ''] }, ['']] }, '$timestamp', '$verifiedAt',
          ] } } },
          { $sort: { _recentAt: -1, _id: -1 } },
          { $limit: safeLimit },
          { $project: { _recentAt: 0 } },
        ])
        .toArray();

    return records
      .map((record) =>
        fromDocument(record),
      )
      .filter(
        (
          record,
        ): record is StoredDonation =>
          Boolean(record),
      );
  }

  async listEligible(): Promise<
    StoredDonation[]
  > {
    const collection =
      await this.getCollection();

    const records =
      await collection
        .find({
          status: {
            $in: [
              'verified',
              'completed',
            ] as never[],
          },
        })
        .sort({
          timestamp: -1,
        })
        .toArray();

    return records
      .map((record) =>
        fromDocument(record),
      )
      .filter(
        (
          record,
        ): record is StoredDonation =>
          Boolean(record),
      );
  }

  async listAll(): Promise<
    StoredDonation[]
  > {
    const collection =
      await this.getCollection();

    const records =
      await collection
        .find({})
        .sort({
          timestamp: -1,
        })
        .toArray();

    return records
      .map((record) =>
        fromDocument(record),
      )
      .filter(
        (
          record,
        ): record is StoredDonation =>
          Boolean(record),
      );
  }

  async searchForCertificate(
    query: string,
  ): Promise<StoredDonation | null> {
    const records =
      await this.listEligible();

    return findBestCertificateMatch(
      records,
      query,
    );
  }

  async searchForPublicCertificate(
    query: string,
  ): Promise<StoredDonation | null> {
    const records =
      await this.listEligible();

    return findPublicCertificateMatch(
      records,
      query,
    );
  }

  async searchMatches(
    query: string,
    eligibleOnly: boolean,
  ): Promise<StoredDonation[]> {
    const records =
      eligibleOnly
        ? await this.listEligible()
        : await this.listAll();

    return findCertificateMatches(
      records,
      query,
      {
        eligibleOnly,
        limit: 50,
      },
    );
  }

  /**
   * Ensures the MongoDB receipt counter is at least as high as the
   * largest receipt already stored for the current financial year.
   *
   * This keeps the receipt counter synchronized with
   * historically imported donation records.
   */
  private async synchronizeReceiptCounter(
    now: Date,
  ): Promise<void> {
    const fy =
      indianFinancialYear(now);

    const prefix =
      `PKF-${fy}-`;

    const collection =
      await this.getCollection();

    const counters =
      await this.getCounters();

    const existing =
      await collection
        .find({
          receiptNumber: {
            $regex:
              `^${prefix.replace(
                /[.*+?^${}()|[\]\\]/g,
                '\\$&',
              )}`,
          },
        })
        .project({
          receiptNumber: 1,
        })
        .toArray();

    let maximum = 0;

    for (const record of existing) {
      const value =
        String(
          record.receiptNumber || '',
        );

      if (!value.startsWith(prefix)) {
        continue;
      }

      const parsed =
        Number(
          value.slice(prefix.length),
        );

      if (
        Number.isInteger(parsed) &&
        parsed > maximum
      ) {
        maximum = parsed;
      }
    }

    await counters.updateOne(
      {
        _id: `receipt:${fy}`,
      },
      {
        $max: {
          sequence: maximum,
        },
      },
      {
        upsert: true,
      },
    );
  }

  /**
   * Atomically reserves the next receipt number for the financial year.
   */
  private async reserveNextReceiptNumber(
    now: Date,
  ): Promise<string> {
    const fy =
      indianFinancialYear(now);

    await this.synchronizeReceiptCounter(
      now,
    );

    const counters =
      await this.getCounters();

    const result =
      await counters.findOneAndUpdate(
        {
          _id: `receipt:${fy}`,
        },
        {
          $inc: {
            sequence: 1,
          },
        },
        {
          upsert: true,
          returnDocument: 'after',
        },
      );

    if (!result) {
      throw new Error(
        'Unable to allocate receipt counter',
      );
    }

    return `PKF-${fy}-${String(
      result.sequence,
    ).padStart(6, '0')}`;
  }

  async nextReceiptNumber(
    now = new Date(),
  ): Promise<string> {
    return this.reserveNextReceiptNumber(
      now,
    );
  }

  /**
   * Atomically reserves a unique receipt for one donation.
   *
   * If another request has already allocated a receipt to the donation,
   * that existing receipt is returned instead of allocating another one.
   *
   * MongoDB may leave a counter gap if two concurrent requests race.
   * This is intentional: uniqueness and correctness are more important
   * than guaranteeing gap-free numbering.
   */
  async allocateReceiptNumber(
    donationId: string,
    now = new Date(),
  ): Promise<string> {
    const collection =
      await this.getCollection();

    const current =
      await collection.findOne({
        _id: donationId,
      });

    if (!current) {
      throw new Error(
        `Donation not found: ${donationId}`,
      );
    }

    if (
      current.receiptNumber?.trim()
    ) {
      return current.receiptNumber;
    }

    const receiptNumber =
      await this.reserveNextReceiptNumber(
        now,
      );

    const updated =
      await collection.findOneAndUpdate(
        {
          _id: donationId,
          $or: [
            {
              receiptNumber: {
                $exists: false,
              },
            },
            {
              receiptNumber: '',
            },
            {
              receiptNumber:
                null as never,
            },
          ],
        },
        {
          $set: {
            receiptNumber,
            receiptNumberCompact:
              compact(receiptNumber),
          },
        } as UpdateFilter<MongoDonationDocument>,
        {
          returnDocument: 'after',
        },
      );

    if (updated?.receiptNumber) {
      return updated.receiptNumber;
    }

    const raced =
      await collection.findOne({
        _id: donationId,
      });

    if (!raced?.receiptNumber) {
      throw new Error(
        `Unable to allocate receipt number for donation: ${donationId}`,
      );
    }

    return raced.receiptNumber;
  }

  async upsertVerified(
    donation: StoredDonation,
  ): Promise<StoredDonation> {
    const collection =
      await this.getCollection();

    const identifiers:
      Filter<MongoDonationDocument>[] =
      [
        {
          _id: donation.id,
        },
      ];

    if (donation.paymentRef) {
      identifiers.push({
        paymentRef:
          donation.paymentRef,
      });
    }

    if (donation.razorpayOrderId) {
      identifiers.push({
        razorpayOrderId:
          donation.razorpayOrderId,
      });
    }

    // Gateway reconstruction is insert-only. Never replace a real checkout's
    // identity, attribution, receipt, or terminal state with a stale snapshot.
    const filter = { $or: identifiers };
    try {
      const saved = await collection.findOneAndUpdate(
        filter,
        { $setOnInsert: toDocument({ ...donation, status: 'verified' }) },
        { upsert: true, returnDocument: 'after' },
      );
      if (!saved) throw new Error('Unable to persist imported donation');
      return fromDocument(saved)!;
    } catch (error) {
      if (!error || typeof error !== 'object' || !('code' in error) || error.code !== 11000) throw error;
      const existing = await collection.findOne(filter);
      if (!existing) throw error;
      return fromDocument(existing)!;
    }
  }

  async findByPhone(
    phone: string,
  ): Promise<StoredDonation[]> {
    const normalized =
      normalizePhone(phone);

    if (!normalized) {
      return [];
    }

    const collection =
      await this.getCollection();

    const records =
      await collection
        .find({
          phoneLast10: normalized,
          status: {
            $in: [
              'verified',
              'completed',
            ] as never[],
          },
        })
        .sort({
          timestamp: -1,
        })
        .toArray();

    return records
      .map((record) =>
        fromDocument(record),
      )
      .filter(
        (
          record,
        ): record is StoredDonation =>
          Boolean(record),
      );
  }

  async verifyDonorSecret(
    phone: string,
    secretId: string,
  ): Promise<boolean> {
    const normalizedPhone =
      normalizePhone(phone);

    const normalizedSecret =
      compact(secretId);

    if (
      !normalizedPhone ||
      !normalizedSecret
    ) {
      return false;
    }

    const donations =
      await this.findByPhone(phone);

    return donations.some(
      (donation) => {
        const candidates = [
          donation.receiptNumber,
          donation.transactionId,
          donation.panNumber,
        ]
          .filter(Boolean)
          .map((value) =>
            compact(String(value)),
          );

        return candidates.includes(
          normalizedSecret,
        );
      },
    );
  }

  async ensureIndexes(): Promise<void> {
    const collection =
      await this.getCollection();

    const counters =
      await this.getCounters();

    await Promise.all([
      collection.createIndex(
        {
          receiptNumberCompact: 1,
        },
        {
          sparse: true,
        },
      ),

      collection.createIndex(
        {
          razorpayOrderId: 1,
        },
        {
          sparse: true,
        },
      ),

      collection.createIndex(
        {
          razorpayQrId: 1,
        },
        {
          sparse: true,
        },
      ),

      collection.createIndex(
        {
          razorpaySubscriptionId: 1,
        },
        {
          sparse: true,
        },
      ),

      collection.createIndex({
        transactionId: 1,
      }),

      collection.createIndex({
        paymentRef: 1,
      }),

      collection.createIndex({
        phoneLast10: 1,
        status: 1,
      }),

      collection.createIndex({
        status: 1,
        timestamp: -1,
      }),

      collection.createIndex({
        causeTitle: 1,
        status: 1,
      }),

      collection.createIndex({
        fundRaiser: 1,
      }),

      collection.createIndex({
        source: 1,
      }),

      counters.createIndex({
        _id: 1,
      }),
    ]);

    logger.info(
      'MongoDB donation indexes ensured',
    );
  }
}

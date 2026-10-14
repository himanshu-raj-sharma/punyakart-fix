import { randomUUID } from 'node:crypto';
import { MongoDownloadRepository } from './db/MongoDownloadRepository';
import {
  CertificateDownloadRecord,
  CertificateDownloadSource,
  StoredDonation,
} from './types';
import logger from './logger';

export class CertificateDownloadService {
  constructor(
    private readonly repository: MongoDownloadRepository,
  ) {}

  async list(): Promise<CertificateDownloadRecord[]> {
    const records = await this.repository.list();

    return [...records].sort((a, b) =>
      b.downloadedAt.localeCompare(a.downloadedAt),
    );
  }

  async latestByDonationId(): Promise<
    Map<string, CertificateDownloadRecord>
  > {
    const map = new Map<string, CertificateDownloadRecord>();
    const records = await this.list();

    for (const row of records) {
      if (!map.has(row.donationId)) {
        map.set(row.donationId, row);
      }
    }

    return map;
  }

  async record(
    donation: StoredDonation,
    source: CertificateDownloadSource,
    now = new Date(),
  ): Promise<CertificateDownloadRecord> {
    const existing = await this.repository.findByDonationId(donation.id);
    const downloadedAt = now.toISOString();

    if (existing) {
      const updated: CertificateDownloadRecord = {
        ...existing,
        fullName: donation.fullName,
        email: donation.email,
        phone: donation.phone,
        amount: donation.amount,
        receiptNumber:
          donation.receiptNumber || existing.receiptNumber,
        transactionId:
          donation.transactionId ||
          donation.paymentRef ||
          existing.transactionId,
        panNumber: donation.panNumber || existing.panNumber,
        downloadedAt,
        source,
        downloadCount: (existing.downloadCount || 1) + 1,
      };

      await this.repository.upsert(updated);

      return updated;
    }

    const entry: CertificateDownloadRecord = {
      id: `CERT-${randomUUID()}`,
      donationId: donation.id,
      fullName: donation.fullName,
      email: donation.email,
      phone: donation.phone,
      amount: donation.amount,
      receiptNumber: donation.receiptNumber || '',
      transactionId:
        donation.transactionId || donation.paymentRef,
      panNumber: donation.panNumber,
      downloadedAt,
      source,
      downloadCount: 1,
    };

    await this.repository.insert(entry);

    return entry;
  }

  /**
   * Best-effort write — never throws to the caller.
   */
  async recordSafe(
    donation: StoredDonation,
    source: CertificateDownloadSource,
  ): Promise<CertificateDownloadRecord | null> {
    try {
      return await this.record(donation, source);
    } catch (err) {
      logger.error(
        {
          err,
          donationId: donation.id,
          source,
        },
        'Failed to record 80G certificate download',
      );

      return null;
    }
  }
}

/**
 * Standalone helper for email / notification paths that do not
 * receive the dependency-injected download service.
 *
 * MongoDB-backed and best-effort, matching the old helper behavior.
 */
export async function recordCertificateDownloadSafe(
  donation: StoredDonation,
  source: CertificateDownloadSource,
): Promise<void> {
  try {
    const repository = new MongoDownloadRepository(
      'certificate_downloads',
    );

    const service = new CertificateDownloadService(repository);

    await service.recordSafe(donation, source);
  } catch (err) {
    logger.error(
      {
        err,
        donationId: donation.id,
        source,
      },
      'Failed to open certificate download store',
    );
  }
}
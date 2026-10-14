import { initialSubscriptions } from './seedData';
import { DonationService } from './donationService';
import { MongoDonationRepository } from './db/MongoDonationRepository';
import { MongoSubscriptionRepository } from './db/MongoSubscriptionRepository';
import { SubscriptionService } from './subscriptionService';
import { GatewayPaymentFinder } from './razorpayCertificateLookup';
import { CertificateDownloadService } from './certificateDownloadService';
import { MongoDownloadRepository } from './db/MongoDownloadRepository';
import { AuditRecord, AuditService } from './auditService';
import { MongoAuditRepository } from './db/MongoAuditRepository';
import logger from './logger';

export function shouldSeedInitialSubscriptions(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return env.NODE_ENV === 'development' && env.SEED_INITIAL_SUBSCRIPTIONS === 'true';
}

export async function createBackendServices(
  options?: { gatewayLookup?: GatewayPaymentFinder },
) {
  const dbUrl = process.env.DATABASE_URL?.trim();

  if (!dbUrl) {
    throw new Error(
      'DATABASE_URL is not configured. Set it to the MongoDB connection string for this environment.',
    );
  }

  if (
    !dbUrl.startsWith('mongodb://') &&
    !dbUrl.startsWith('mongodb+srv://')
  ) {
    throw new Error(
      'DATABASE_URL must be a MongoDB connection string (mongodb:// or mongodb+srv://).',
    );
  }

  const donationRepo = new MongoDonationRepository();

  const subscriptionRepo = new MongoSubscriptionRepository();

  const subscriptions = new SubscriptionService(
    subscriptionRepo,
  );

  const certificateDownloadRepo = new MongoDownloadRepository(
    'certificate_downloads',
  );

  const receiptDownloadRepo = new MongoDownloadRepository(
    'receipt_downloads',
  );

  const certificateDownloads = new CertificateDownloadService(
    certificateDownloadRepo,
  );

  const receiptDownloads = new CertificateDownloadService(
    receiptDownloadRepo,
  );

  const auditRepository = new MongoAuditRepository();

  const audit = new AuditService(
    auditRepository,
  );

  /*
   * Ensure all MongoDB indexes exist before the services begin
   * handling application requests.
   */
  await Promise.all([
    donationRepo.ensureIndexes(),
    subscriptionRepo.ensureIndexes(),
    certificateDownloadRepo.ensureIndexes(),
    receiptDownloadRepo.ensureIndexes(),
    auditRepository.ensureIndexes(),
  ]);

  /*
   * Demo subscriptions are opt-in and development-only. Production must
   * never manufacture subscription records just because the collection is
   * empty.
   */
  if (shouldSeedInitialSubscriptions()) {
    const existingSubscriptions = await subscriptionRepo.list();

    if (
      existingSubscriptions.length === 0 &&
      initialSubscriptions.length > 0
    ) {
      await subscriptionRepo.replace(initialSubscriptions);

      logger.info(
        {
          count: initialSubscriptions.length,
        },
        'Seeded initial subscriptions into MongoDB',
      );
    }
  }

  const donations = new DonationService(
    donationRepo,
    subscriptions,
    options?.gatewayLookup,
  );

  logger.info(
    process.env.NODE_ENV === 'production'
      ? 'Using MongoDB Atlas for backend persistence'
      : 'Using local MongoDB for development persistence',
  );

  return {
    donations,
    subscriptions,
    certificateDownloads,
    receiptDownloads,
    audit,
  };
}

export type BackendServices = Awaited<
  ReturnType<typeof createBackendServices>
>;

export type BackendAuditRecord = AuditRecord;

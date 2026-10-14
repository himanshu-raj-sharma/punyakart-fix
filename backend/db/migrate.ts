import 'dotenv/config';

import { getMongoDb, closeMongo, getMongoDatabaseName } from './mongo';
import { MongoDonationRepository } from './MongoDonationRepository';
import { MongoSubscriptionRepository } from './MongoSubscriptionRepository';
import { MongoDownloadRepository } from './MongoDownloadRepository';
import { MongoAuditRepository } from './MongoAuditRepository';

const CAMPAIGNS_COLLECTION = 'campaigns';
const DONATIONS_COLLECTION = 'donations';
const COUNTERS_COLLECTION = 'counters';

function log(
  message: string,
  details?: Record<string, unknown>,
): void {
  if (details) {
    console.log(
      `[migration] ${message}`,
      JSON.stringify(details),
    );

    return;
  }

  console.log(`[migration] ${message}`);
}

function error(
  message: string,
  details?: Record<string, unknown>,
): void {
  if (details) {
    console.error(
      `[migration] ERROR: ${message}`,
      JSON.stringify(details),
    );

    return;
  }

  console.error(`[migration] ERROR: ${message}`);
}

/**
 * Ensures the infrastructure-level indexes used by the
 * campaigns collection and campaign statistics queries.
 *
 * Historical data is NOT imported here.
 */
async function ensureCampaignIndexes(): Promise<void> {
  const db = await getMongoDb();

  const campaigns =
    db.collection(CAMPAIGNS_COLLECTION);

  const donations =
    db.collection(DONATIONS_COLLECTION);

  await Promise.all([
    campaigns.createIndex(
      { id: 1 },
      {
        unique: true,
      },
    ),

    campaigns.createIndex({
      is_active: 1,
      sort_order: 1,
      created_at: -1,
    }),

    campaigns.createIndex({
      title: 1,
    }),

    donations.createIndex({
      id: 1,
    }),

    donations.createIndex({
      status: 1,
    }),

    donations.createIndex({
      causeTitle: 1,
    }),

    donations.createIndex({
      campaignId: 1,
    }),
  ]);
}

/**
 * Ensures the receipt counter collection has its
 * infrastructure index.
 *
 * Receipt allocation itself is handled by
 * MongoDonationRepository.
 */
async function ensureCounterIndexes(): Promise<void> {
  const db = await getMongoDb();

  const counters =
    db.collection(COUNTERS_COLLECTION);

  await counters.createIndex(
    {
      _id: 1,
    },
    {
      unique: true,
    },
  );
}

/**
 * Initializes MongoDB infrastructure only.
 *
 * IMPORTANT:
 *
 * This function deliberately does NOT import:
 * - Excel data
 * - CSV data
 * - historical legacy data
 * - historical JSON donation data
 *
 * Historical data import will be handled separately
 * during the final deployment phase.
 */
async function runMigration(): Promise<void> {
  log('Starting MongoDB database initialization');

  await getMongoDb();

  log(
    'Connected to MongoDB',
    {
      database: getMongoDatabaseName(),
    },
  );

  /*
   * These repositories use the shared MongoDB connection
   * from ./mongo.ts and therefore do not receive a Db
   * instance through their constructors.
   */
  const donationRepository =
    new MongoDonationRepository();

  const subscriptionRepository =
    new MongoSubscriptionRepository();

  const certificateDownloadRepository =
    new MongoDownloadRepository(
      'certificate_downloads',
    );

  const receiptDownloadRepository =
    new MongoDownloadRepository(
      'receipt_downloads',
    );

  const auditRepository =
    new MongoAuditRepository();

  /*
   * Initialize the indexes owned by the live repositories.
   */
  log('Ensuring donation indexes');

  await donationRepository.ensureIndexes();

  log('Ensuring subscription indexes');

  await subscriptionRepository.ensureIndexes();

  log('Ensuring certificate download indexes');

  await certificateDownloadRepository.ensureIndexes();

  log('Ensuring receipt download indexes');

  await receiptDownloadRepository.ensureIndexes();

  log('Ensuring audit log indexes');

  await auditRepository.ensureIndexes();

  /*
   * CampaignRepository keeps its index initializer private,
   * so the database infrastructure script maintains the
   * campaign indexes directly.
   */
  log('Ensuring campaign indexes');

  await ensureCampaignIndexes();

  /*
   * Receipt numbers use an atomic MongoDB counter document.
   */
  log('Ensuring counter indexes');

  await ensureCounterIndexes();

  log(
    'MongoDB database initialization completed successfully',
    {
      database: getMongoDatabaseName(),
      historicalDataImported: false,
    },
  );
}

const isMain =
  process.argv[1]?.includes('migrate');

if (isMain) {
  runMigration()
    .then(async () => {
      await closeMongo();
      process.exit(0);
    })
    .catch(async (err) => {
      error(
        'MongoDB database initialization failed',
        {
          message:
            err instanceof Error
              ? err.message
              : String(err),
        },
      );

      await closeMongo();
      process.exit(1);
    });
}

export { runMigration };
import { closeMongo, getMongoDb } from '../backend/db/mongo.js';
import { MongoPaymentAttemptRepository } from '../backend/db/MongoPaymentAttemptRepository.js';
import type { StoredDonation } from '../backend/types.js';

const APPLY = process.argv.includes('--apply');
const BACKUP_CONFIRMED = process.argv.includes('--backup-confirmed');
const PENDING_STATUSES = ['initiated', 'pending_verification', 'failed'] as const;

if (APPLY && !BACKUP_CONFIRMED) {
  throw new Error('Refusing to move production records without --backup-confirmed. Take and verify an Atlas backup first.');
}

function fromLegacyDocument(document: Record<string, unknown>): StoredDonation {
  const {
    _id: _idIgnored,
    phoneLast10: _phoneIgnored,
    receiptNumberCompact: _receiptIgnored,
    lastReconciliationAt: _reconciliationIgnored,
    ...stored
  } = document;
  if (typeof stored.id !== 'string' || typeof stored.amount !== 'number' ||
      typeof stored.email !== 'string' || typeof stored.timestamp !== 'string' ||
      !PENDING_STATUSES.includes(stored.status as typeof PENDING_STATUSES[number])) {
    throw new Error('Found a legacy pending row with an invalid identity or status; no row was deleted.');
  }
  return stored as unknown as StoredDonation;
}

/**
 * One-time migration, deliberately dry-run by default.
 * Run only against the intended production DATABASE_URL after a verified Atlas backup.
 * It copies first, verifies core identity fields, and only then deletes the old pending row.
 * Confirmed donations are never touched.
 */
async function main(): Promise<void> {
  const db = await getMongoDb();
  const donations = db.collection<Record<string, unknown>>('donations');
  const attempts = new MongoPaymentAttemptRepository();
  await attempts.ensureIndexes();

  const pending = await donations.find({
    status: { $in: [...PENDING_STATUSES] },
  }).sort({ timestamp: 1, _id: 1 }).toArray();

  const counts = pending.reduce<Record<string, number>>((acc, row) => {
    const key = String(row.status || 'unknown');
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  console.log(JSON.stringify({
    mode: APPLY ? 'APPLY' : 'DRY_RUN',
    database: db.databaseName,
    collection: 'donations',
    pendingRows: pending.length,
    byStatus: counts,
    confirmedRecordsChanged: 0,
  }, null, 2));

  if (!APPLY) {
    console.log('Dry run only: no documents were inserted, updated, or deleted.');
    return;
  }

  let moved = 0;
  for (const document of pending) {
    const attempt = fromLegacyDocument(document);
    const saved = await attempts.upsertFromLegacy(attempt);
    if (saved.id !== attempt.id || saved.amount !== attempt.amount ||
        saved.email !== attempt.email || saved.timestamp !== attempt.timestamp ||
        saved.status !== attempt.status ||
        (saved.razorpayOrderId || '') !== (attempt.razorpayOrderId || '')) {
      throw new Error('Attempt copy validation failed; the source row was left in donations.');
    }

    const result = await donations.deleteOne({
      _id: document._id,
      status: attempt.status,
      timestamp: attempt.timestamp,
    });
    if (result.deletedCount !== 1) {
      throw new Error('A source row changed during migration. The copied attempt was retained; rerun a dry-run before continuing.');
    }
    moved++;
  }

  console.log(JSON.stringify({
    mode: 'APPLY',
    moved,
    remainingLegacyPendingRows: pending.length - moved,
    note: 'Only initiated/pending_verification/failed rows that passed copy validation were removed from donations.',
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Payment-attempt migration failed.');
  process.exitCode = 1;
}).finally(async () => {
  await closeMongo().catch(() => undefined);
});

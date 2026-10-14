import { StoredDonation } from '../types';

const CERTIFICATE_STATUSES = new Set(['verified', 'completed']);

export function isCertificateEligible(status?: string): boolean {
  return CERTIFICATE_STATUSES.has(String(status || '').toLowerCase());
}

function digits(value: string | undefined): string {
  return (value || '').replace(/\D/g, '');
}

export function last10(value: string | undefined): string {
  const d = digits(value);
  return d.length >= 10 ? d.slice(-10) : d;
}

export function normalizeLookup(value: string): string {
  return value
    .replace(/[\u2010-\u2015\u2212]/g, '-')
    .replace(/^e\.g\.?\s*/i, '')
    .trim()
    .toLowerCase();
}

function compact(value: string | undefined): string {
  return normalizeLookup(value || '').replace(/[^a-z0-9]/g, '');
}

function extractKnownIds(query: string): string[] {
  const matches = [
    // Current FY receipts: PKF-2025-26-000001
    ...(query.match(/pkf[\s\-]*\d{4}[\s\-]*\d{2}[\s\-]*\d{4,}/gi) || []),
    // Legacy / short receipts: PKF-2026-893241
    ...(query.match(/pkf[\s\-]*\d{4}[\s\-]*\d{5,}/gi) || []),
    ...(query.match(/txn[\s\-]*\d{8,}/gi) || []),
    ...(query.match(/don-[\w-]+/gi) || []),
    ...(query.match(/pay_[a-zA-Z0-9]+/g) || []),
    ...(query.match(/order_[a-zA-Z0-9]+/g) || []),
    ...(query.match(/\b[A-Z]{5}\d{4}[A-Z]\b/gi) || []),
    ...(query.match(/\b\d{10}\b/g) || []),
  ];
  return matches.map((value) => normalizeLookup(value));
}

export function lookupTokens(query: string): string[] {
  const normalized = normalizeLookup(query);
  if (!normalized) return [];

  const punctParts = normalized
    .split(/[,;/|]+/)
    .map((part) => part.replace(/^e\.g\.?\s*/i, '').replace(/[()]/g, '').trim())
    .filter((part) => part.length >= 2);

  const wordParts = normalized
    .split(/\s+/)
    .map((part) => part.replace(/[()]/g, '').trim())
    .filter((part) => part.length >= 2);

  const allDigits = digits(query);
  const phoneToken = allDigits.length >= 10 ? last10(allDigits) : '';

  const tokens = [normalized, ...punctParts, ...wordParts, ...extractKnownIds(query), phoneToken].filter(Boolean);
  return [...new Set(tokens)];
}

function recordFields(record: StoredDonation): string[] {
  return [
    record.id,
    record.transactionId,
    record.receiptNumber,
    record.panNumber,
    record.email,
    record.paymentRef,
    record.razorpayOrderId,
    record.razorpayQrId,
  ]
    .filter(Boolean)
    .map((value) => String(value));
}

function tokenScore(record: StoredDonation, token: string, fullQuery: string): number {
  const fields = recordFields(record);
  const normalizedFields = fields.map((value) => normalizeLookup(value));
  const compactFields = fields.map((value) => compact(value));
  const compactToken = compact(token);
  const compactFull = compact(fullQuery);
  const name = normalizeLookup(record.fullName || '');
  const nameWords = name.split(/\s+/).filter(Boolean);

  if (normalizedFields.includes(fullQuery) || compactFields.includes(compactFull)) return 100;
  if (name && name === fullQuery) return 100;

  // Receipt / txn compact equality (PKF-2025-26-000001 ↔ pkf202526000001)
  if (compactFull.length >= 10 && compactFields.includes(compactFull)) return 100;
  if (compactToken.length >= 10 && compactFields.includes(compactToken)) return 98;

  if (normalizedFields.includes(token)) return 95;
  if (compactToken.length >= 8 && compactFields.includes(compactToken)) return 95;

  const tokenDigits = digits(token);
  if (tokenDigits.length >= 10 && last10(record.phone) === last10(tokenDigits)) {
    // Avoid treating receipt digit runs as phone matches
    if (!/^pkf/i.test(fullQuery) && !compactFull.startsWith('pkf')) {
      return 80;
    }
  }

  if (compactToken.length >= 8) {
    if (compactFields.some((field) => field.includes(compactToken) || compactToken.includes(field))) {
      return 85;
    }
  }

  if (token.length >= 4 && name) {
    if (name === token) return 90;
    if (name.includes(token) && token.includes(' ')) return 88;
    if (nameWords.includes(token)) return 40;
    if (name.includes(token)) return 50;
  }

  return 0;
}

export function recordMatchScore(record: StoredDonation, query: string): number {
  const fullQuery = normalizeLookup(query);
  if (!fullQuery) return 0;
  return lookupTokens(query).reduce(
    (best, token) => Math.max(best, tokenScore(record, token, fullQuery)),
    0,
  );
}

export function certificateMatchScore(record: StoredDonation, query: string): number {
  if (!isCertificateEligible(record.status)) return 0;
  return recordMatchScore(record, query);
}

export function matchesCertificateQuery(record: StoredDonation, query: string): boolean {
  return certificateMatchScore(record, query) > 0;
}

export function findCertificateMatches(
  records: StoredDonation[],
  query: string,
  options?: { eligibleOnly?: boolean; limit?: number },
): StoredDonation[] {
  const eligibleOnly = options?.eligibleOnly !== false;
  const limit = options?.limit ?? 50;
  const scored = records
    .map((record) => ({
      record,
      score: eligibleOnly ? certificateMatchScore(record, query) : recordMatchScore(record, query),
    }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
  return scored.map((row) => row.record);
}

export function findBestCertificateMatch(
  records: StoredDonation[],
  query: string,
): StoredDonation | null {
  return findCertificateMatches(records, query, { eligibleOnly: true, limit: 1 })[0] || null;
}

export function isStrongCertificateQuery(query: string): boolean {
  const value = normalizeLookup(query);
  if (!value) return false;
  return (
    /pay_[a-z0-9]+/i.test(value) ||
    /order_[a-z0-9]+/i.test(value) ||
    /don-[\w-]+/i.test(value) ||
    /pkf[\s\-]*\d{4}/i.test(value) ||
    /pkf\d{10,}/i.test(value) ||
    /txn[\s\-]*\d{8,}/i.test(value)
  );
}

/** Compare receipt / txn ids ignoring spaces and punctuation. */
export function idsMatchLoose(left?: string, right?: string): boolean {
  const a = compact(left);
  const b = compact(right);
  return Boolean(a && b && a === b);
}

function publicRecordFields(record: StoredDonation): string[] {
  return [
    record.id,
    record.transactionId,
    record.receiptNumber,
    record.paymentRef,
    record.razorpayOrderId,
    record.razorpayQrId,
  ]
    .filter(Boolean)
    .map((value) => String(value));
}

export function publicCertificateMatchScore(record: StoredDonation, query: string): number {
  if (!isCertificateEligible(record.status)) return 0;
  if (!isStrongCertificateQuery(query)) return 0;
  const fullQuery = normalizeLookup(query);
  const fields = publicRecordFields(record).map((value) => normalizeLookup(value));
  const compactFields = publicRecordFields(record).map((value) => compact(value));
  const compactQuery = compact(fullQuery);
  if (fields.includes(fullQuery) || compactFields.includes(compactQuery)) return 100;
  return lookupTokens(query).reduce((best, token) => {
    const compactToken = compact(token);
    if (fields.includes(token) || compactFields.includes(compactToken)) return Math.max(best, 95);
    if (compactToken.length >= 8 && compactFields.some((field) => field.includes(compactToken))) {
      return Math.max(best, 90);
    }
    return best;
  }, 0);
}

export function findPublicCertificateMatch(
  records: StoredDonation[],
  query: string,
): StoredDonation | null {
  let best: StoredDonation | null = null;
  let bestScore = 0;
  for (const record of records) {
    const score = publicCertificateMatchScore(record, query);
    if (score > bestScore) {
      bestScore = score;
      best = record;
    }
  }
  return bestScore >= 90 ? best : null;
}

function normalizePersonName(value: string): string {
  return normalizeLookup(value).replace(/\s+/g, ' ').trim();
}

function addressTokens(value: string): string[] {
  return normalizeLookup(value)
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length >= 3);
}

export type DonorDetailMismatch = 'fullName' | 'email' | 'phone' | 'address' | 'panNumber';

/**
 * Verifies form donor details against a matched donation.
 * PAN may be absent on the stored record — form PAN is still required by the caller.
 */
export function verifyDonorDetailsAgainstDonation(
  record: StoredDonation,
  details: {
    fullName: string;
    email: string;
    phone: string;
    address: string;
    panNumber: string;
  },
): { ok: true } | { ok: false; mismatches: DonorDetailMismatch[] } {
  const mismatches: DonorDetailMismatch[] = [];

  const formName = normalizePersonName(details.fullName);
  const recordName = normalizePersonName(record.fullName || '');
  if (
    !formName ||
    !recordName ||
    !(
      formName === recordName ||
      formName.includes(recordName) ||
      recordName.includes(formName)
    )
  ) {
    mismatches.push('fullName');
  }

  if (normalizeLookup(details.email) !== normalizeLookup(record.email || '')) {
    mismatches.push('email');
  }

  if (last10(details.phone) !== last10(record.phone)) {
    mismatches.push('phone');
  }

  const formAddrTokens = addressTokens(details.address);
  const recordAddrTokens = addressTokens(record.address || '');
  const formCompact = compact(details.address);
  const recordCompact = compact(record.address || '');
  const shared = formAddrTokens.filter((token) => recordAddrTokens.includes(token)).length;
  const needed = Math.max(1, Math.ceil(Math.min(formAddrTokens.length, recordAddrTokens.length) * 0.5));
  const addressOk =
    (formCompact &&
      recordCompact &&
      (formCompact.includes(recordCompact) || recordCompact.includes(formCompact))) ||
    (formAddrTokens.length > 0 && recordAddrTokens.length > 0 && shared >= needed);
  if (!addressOk) {
    mismatches.push('address');
  }

  const storedPan = (record.panNumber || '').trim().toUpperCase();
  const formPan = details.panNumber.trim().toUpperCase();
  if (storedPan && storedPan !== formPan) {
    mismatches.push('panNumber');
  }

  return mismatches.length ? { ok: false, mismatches } : { ok: true };
}

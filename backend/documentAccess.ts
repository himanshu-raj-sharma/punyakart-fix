import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';
import { verifyDonorToken } from './donorAuth.js';
import { BusinessError } from './errors.js';
import type { StoredDonation } from './types.js';

const GRANT_DOMAIN = 'punyakart:donor-document-grant:v1:';
const GRANT_PURPOSE = 'donation-documents';
export const DOCUMENT_GRANT_SECONDS = 15 * 60;
export const DOCUMENT_ACCESS_ERROR = 'Login or donor-details verification is required to access this donation document.';

export interface DocumentCredentials {
  sessionToken?: string;
  clientToken?: string;
  documentGrant?: string;
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

/** Document secrets are accepted only in headers/body, never query strings. */
export function documentCredentials(req: Pick<Request, 'headers' | 'body' | 'method'>): DocumentCredentials {
  const authorization = text(req.headers.authorization);
  const body = req.method === 'GET' ? undefined : req.body;
  return {
    sessionToken: authorization?.startsWith('Bearer ') ? authorization.slice(7) : undefined,
    clientToken: text(body?.clientToken) || text(req.headers['x-donation-client-token']),
    documentGrant: text(body?.documentGrant) || text(req.headers['x-document-grant']),
  };
}

/** Match the supported Indian mobile formats, never empty/short/suffix-only values. */
export function documentOwnerPhone(value: unknown): string | null {
  if (typeof value !== 'string' || !/^[+\d\s()-]+$/.test(value)) return null;
  let digits = value.replace(/\D/g, '');
  if (digits.length === 14 && digits.startsWith('0091')) digits = digits.slice(4);
  else if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  return /^[6-9]\d{9}$/.test(digits) ? digits : null;
}

function grantSignature(payload: string): Buffer | null {
  const secret = process.env.DONOR_JWT_SECRET?.trim();
  return secret ? createHmac('sha256', secret).update(GRANT_DOMAIN + payload).digest() : null;
}

/** Call only after successful donor-details verification; grants cannot authenticate donor accounts. */
export function signDocumentGrant(donationId: string, now = Date.now()): string {
  const iat = Math.floor(now / 1000);
  if (!donationId) throw new Error('Cannot issue a document grant without a donation');
  const payload = Buffer.from(JSON.stringify({ purpose: GRANT_PURPOSE, donationId, iat, exp: iat + DOCUMENT_GRANT_SECONDS })).toString('base64url');
  const signature = grantSignature(payload);
  if (!signature) throw new Error('Document verification is temporarily unavailable');
  return `doc1.${payload}.${signature.toString('base64url')}`;
}

export function verifyDocumentGrant(token: string, donationId: string, now = Date.now()): boolean {
  try {
    const parts = token.split('.');
    if (parts.length !== 3 || parts[0] !== 'doc1' || !/^[A-Za-z0-9_-]+$/.test(parts[1]) || !/^[A-Za-z0-9_-]+$/.test(parts[2])) return false;
    const expected = grantSignature(parts[1]);
    const supplied = Buffer.from(parts[2], 'base64url');
    if (!expected || supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return false;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    const seconds = Math.floor(now / 1000);
    return Boolean(donationId && payload.donationId === donationId && payload.purpose === GRANT_PURPOSE
      && Number.isSafeInteger(payload.iat) && Number.isSafeInteger(payload.exp)
      && payload.iat <= seconds && payload.exp > seconds && payload.exp > payload.iat
      && payload.exp - payload.iat <= DOCUMENT_GRANT_SECONDS);
  } catch {
    return false;
  }
}

export function requireDocumentCredentials(credentials: DocumentCredentials): void {
  if (!credentials.sessionToken && !credentials.clientToken && !credentials.documentGrant) {
    throw new BusinessError(DOCUMENT_ACCESS_ERROR, 'UNAUTHORIZED');
  }
}

export function assertDocumentAccess(
  donation: StoredDonation | null,
  credentials: DocumentCredentials,
  assertClientToken: (donation: StoredDonation, token?: string) => void,
): asserts donation is StoredDonation {
  if (donation) {
    if (credentials.clientToken) {
      try {
        assertClientToken(donation, credentials.clientToken);
        return;
      } catch (err) {
        if (!(err instanceof BusinessError) || err.code !== 'UNAUTHORIZED') throw err;
      }
    }
    if (credentials.sessionToken) {
      // Reuses the existing login scheme. Phone + receipt/transaction/PAN login remains
      // weak, knowledge-based authentication; this boundary does not add possession proof.
      const session = verifyDonorToken(credentials.sessionToken);
      const owner = documentOwnerPhone(donation.phone);
      const phone = documentOwnerPhone(session?.phone);
      if (owner && phone && owner === phone) return;
    }
    if (credentials.documentGrant && verifyDocumentGrant(credentials.documentGrant, donation.id)) return;
  }
  // Same response for unknown donation, wrong owner, absent or invalid credential: no PII.
  throw new BusinessError(DOCUMENT_ACCESS_ERROR, 'UNAUTHORIZED');
}

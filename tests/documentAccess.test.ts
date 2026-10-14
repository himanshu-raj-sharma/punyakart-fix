import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { createHmac } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { assertDocumentAccess, DOCUMENT_GRANT_SECONDS, documentOwnerPhone, signDocumentGrant, verifyDocumentGrant } from '../backend/documentAccess.js';
import { signDonorToken } from '../backend/donorAuth.js';
import { BusinessError } from '../backend/errors.js';
import type { StoredDonation } from '../backend/types.js';

const previousSecret = process.env.DONOR_JWT_SECRET;
process.env.DONOR_JWT_SECRET = 'isolated-document-access-secret';
const donation = { id: 'DON-owner', phone: '9876543210', status: 'verified' } as StoredDonation;

after(() => {
  if (previousSecret === undefined) delete process.env.DONOR_JWT_SECRET;
  else process.env.DONOR_JWT_SECRET = previousSecret;
});

function denied(run: () => void): void {
  assert.throws(run, (error: unknown) => error instanceof BusinessError && error.code === 'UNAUTHORIZED');
}

test('document access denies anonymous, malformed, wrong-owner, and wrong checkout credentials', () => {
  assert.equal(documentOwnerPhone(''), null);
  assert.equal(documentOwnerPhone('12345'), null);
  denied(() => assertDocumentAccess(donation, {}, () => { throw new BusinessError('bad', 'UNAUTHORIZED'); }));
  denied(() => assertDocumentAccess(donation, { sessionToken: 'not-a-token' }, () => { throw new BusinessError('bad', 'UNAUTHORIZED'); }));
  denied(() => assertDocumentAccess(donation, { sessionToken: signDonorToken('9876543211') }, () => { throw new BusinessError('bad', 'UNAUTHORIZED'); }));
  denied(() => assertDocumentAccess(donation, { clientToken: 'wrong' }, (_row, token) => {
    if (token !== 'checkout-good') throw new BusinessError('bad', 'UNAUTHORIZED');
  }));
  denied(() => assertDocumentAccess({ ...donation, phone: '' }, { sessionToken: signDonorToken('9876543210') }, () => {
    throw new BusinessError('unused', 'UNAUTHORIZED');
  }));
});

test('document access permits exact owner session and matching checkout token', () => {
  assert.doesNotThrow(() => assertDocumentAccess(
    donation,
    { sessionToken: signDonorToken('+91 98765 43210') },
    () => { throw new BusinessError('unused', 'UNAUTHORIZED'); },
  ));
  assert.doesNotThrow(() => assertDocumentAccess(
    donation,
    { clientToken: 'checkout-good' },
    (_row, token) => { if (token !== 'checkout-good') throw new BusinessError('bad', 'UNAUTHORIZED'); },
  ));
});

test('document grants are short-lived, signed, purpose-bound, and donation-bound', () => {
  const now = Date.now();
  const grant = signDocumentGrant(donation.id, now);
  assert.equal(verifyDocumentGrant(grant, donation.id, now), true);
  assert.equal(verifyDocumentGrant(grant, 'DON-other', now), false);
  const grantParts = grant.split('.');
  const alteredSignature = `${grantParts[2][0] === 'A' ? 'B' : 'A'}${grantParts[2].slice(1)}`;
  assert.equal(verifyDocumentGrant(`${grantParts[0]}.${grantParts[1]}.${alteredSignature}`, donation.id, now), false);
  assert.equal(verifyDocumentGrant(grant, donation.id, now + (DOCUMENT_GRANT_SECONDS + 1) * 1000), false);

  const payload = Buffer.from(JSON.stringify({ purpose: 'other-purpose', donationId: donation.id, iat: Math.floor(now / 1000), exp: Math.floor(now / 1000) + 60 })).toString('base64url');
  const signature = createHmac('sha256', process.env.DONOR_JWT_SECRET!).update(`punyakart:donor-document-grant:v1:${payload}`).digest('base64url');
  assert.equal(verifyDocumentGrant(`doc1.${payload}.${signature}`, donation.id, now), false);
});

test('all public document identifier routes delegate through the authorization handlers', async () => {
  const source = await readFile(new URL('../server.ts', import.meta.url), 'utf8');
  assert.match(source, /app\.get\('\/api\/donations\/certificate', certificateLimiter, documentHandlers\.certificate\)/);
  assert.match(source, /app\.post\('\/api\/donations\/receipt\/lookup', certificateLimiter, documentHandlers\.receiptLookup\)/);
  assert.match(source, /app\.post\('\/api\/donations\/certificate-download', certificateLimiter, documentHandlers\.certificateDownload\)/);
  assert.match(source, /app\.post\('\/api\/donations\/certificate\.pdf', certificateLimiter, documentHandlers\.certificatePdf\)/);
  assert.match(source, /app\.post\('\/api\/donations\/receipt\.pdf', certificateLimiter, documentHandlers\.receiptPdf\)/);
  assert.match(source, /app\.get\('\/api\/admin\/donations\/:id\/certificate\.pdf', adminAuth/);
  assert.doesNotMatch(source, /findForReceiptLookup\(/);
});

import crypto from 'node:crypto';

/**
 * Constant-time comparison of two hex strings.
 *
 * When the lengths differ we still perform a full-length comparison
 * against a zero buffer so that the time taken depends only on the
 * expected value's length (which is not treated as secret for these
 * use cases) and never on the expected value's contents. This closes
 * the timing side-channel that a naive early-return would open.
 */
export function timingSafeEqualHex(expectedHex: string, providedHex: string): boolean {
  const expected = Buffer.from(expectedHex, 'utf8');
  const provided = Buffer.from(providedHex, 'utf8');
  if (expected.length !== provided.length) {
    crypto.timingSafeEqual(expected, Buffer.alloc(expected.length));
    return false;
  }
  return crypto.timingSafeEqual(expected, provided);
}

/**
 * Constant-time comparison of two arbitrary strings.
 *
 * Same defence as timingSafeEqualHex: a length mismatch still triggers a
 * full-length dummy comparison so the caller cannot infer the expected
 * value's length or contents from timing.
 */
export function timingSafeEqualText(expected: string, provided: string): boolean {
  const a = Buffer.from(String(expected || ''), 'utf8');
  const b = Buffer.from(String(provided || ''), 'utf8');
  if (a.length !== b.length) {
    crypto.timingSafeEqual(a, Buffer.alloc(a.length));
    return false;
  }
  return crypto.timingSafeEqual(a, b);
}
import crypto from 'node:crypto';
import logger from './logger.js';
import type { Request, Response, NextFunction } from 'express';

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '').slice(-10);
}

// ─── JWT-like Token (HMAC-SHA256, zero dependencies) ─────────────────

function getSecret(): string {
  const secret = process.env.DONOR_JWT_SECRET?.trim();
  if (!secret) throw new Error('DONOR_JWT_SECRET environment variable is required');
  return secret;
}

function base64url(input: string | Buffer): string {
  const buf = typeof input === 'string' ? Buffer.from(input, 'utf8') : input;
  return buf.toString('base64url');
}

function fromBase64url(input: string): string {
  return Buffer.from(input, 'base64url').toString('utf8');
}

const TOKEN_EXPIRY_SECONDS = 7 * 24 * 60 * 60; // 7 days

export function signDonorToken(phone: string): string {
  const payload = {
    phone: normalizePhone(phone),
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + TOKEN_EXPIRY_SECONDS,
  };
  const payloadB64 = base64url(JSON.stringify(payload));
  const sig = crypto.createHmac('sha256', getSecret()).update(payloadB64).digest();
  return `${payloadB64}.${base64url(sig)}`;
}

export function verifyDonorToken(token: string): { phone: string } | null {
  try {
    const [payloadB64, sigB64] = token.split('.');
    if (!payloadB64 || !sigB64) return null;

    const expectedSig = crypto.createHmac('sha256', getSecret()).update(payloadB64).digest();
    const providedSig = Buffer.from(sigB64, 'base64url');

    if (expectedSig.length !== providedSig.length) return null;
    if (!crypto.timingSafeEqual(expectedSig, providedSig)) return null;

    const payload = JSON.parse(fromBase64url(payloadB64));
    if (!payload.phone || !payload.exp) return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;

    return { phone: normalizePhone(payload.phone) };
  } catch {
    return null;
  }
}

// ─── Express Middleware ──────────────────────────────────────────────

export interface DonorRequest extends Request {
  donorPhone?: string;
}

export function donorAuthMiddleware(req: DonorRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : '';

  if (!token) {
    res.status(401).json({ error: 'Login required', code: 'UNAUTHORIZED' });
    return;
  }

  const donor = verifyDonorToken(token);
  if (!donor) {
    res.status(401).json({ error: 'Session expired. Please login again.', code: 'TOKEN_EXPIRED' });
    return;
  }

  req.donorPhone = donor.phone;
  next();
}

const WEAK_PRODUCTION_SECRET = /change-me|dummy|password|punyakart-admin-change-me|^admin$/i;

export function assertProductionConfig(env: NodeJS.ProcessEnv = process.env): void {
  if (env.NODE_ENV !== 'production') return;

  const adminKey = env.ADMIN_API_KEY?.trim() || '';
  if (adminKey.length < 32 || WEAK_PRODUCTION_SECRET.test(adminKey)) {
    throw new Error(
      'ADMIN_API_KEY must be a random secret of at least 32 characters in production. Generate one with: openssl rand -hex 32',
    );
  }

  const donorJwtSecret = env.DONOR_JWT_SECRET?.trim() || '';
  if (donorJwtSecret.length < 32 || WEAK_PRODUCTION_SECRET.test(donorJwtSecret)) {
    throw new Error(
      'DONOR_JWT_SECRET must be a random secret of at least 32 characters in production. Generate one with: openssl rand -hex 32',
    );
  }

  const keyId = env.RAZORPAY_KEY_ID?.trim() || '';
  const keySecret = env.RAZORPAY_KEY_SECRET?.trim() || '';
  if (
    !keyId ||
    !keySecret ||
    keyId.includes('your_') ||
    keySecret.includes('your_') ||
    keyId.includes('dummy') ||
    keySecret.includes('dummy')
  ) {
    throw new Error('RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are required in production.');
  }
}

export function productionWarnings(env: NodeJS.ProcessEnv = process.env): string[] {
  const warnings: string[] = [];
  if (!env.RAZORPAY_WEBHOOK_SECRET?.trim()) {
    warnings.push('RAZORPAY_WEBHOOK_SECRET is unset — refunds and UPI QR captures may not sync until webhooks are configured.');
  }
  if (!env.NGO_80G_NUMBER?.trim() || /AAATD1234/i.test(env.NGO_80G_NUMBER)) {
    warnings.push('NGO_80G_NUMBER is unset — 80G PDFs will say they are not valid for ITR.');
  }
  if (!env.SMTP_PASS?.trim()) {
    warnings.push('SMTP is not fully configured — 80G email delivery is skipped.');
  }
  return warnings;
}

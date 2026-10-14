import type { MetaAttribution, MetaCapturedPayment, MetaConversionsService } from './metaConversions.js';
import type { StoredDonation } from './types.js';
import type { DonationService } from './donationService.js';
import { BusinessError } from './errors.js';

function object(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

/** Server-owned consent timestamp/UA. Never trust posted consent dates, IPs or arbitrary user_data. */
export function captureMetaAttribution(
  input: unknown, publicSiteUrl: string | undefined, userAgent: unknown, now = new Date(), clientIpAddress?: unknown,
): MetaAttribution | undefined {
  const data = object(input);
  if (data?.consent !== true || !Number.isFinite(now.getTime())) return undefined;
  try {
    if (!publicSiteUrl) return undefined;
    const site = new URL(publicSiteUrl);
    if (site.protocol !== 'https:' || site.username || site.password || site.search || site.hash) return undefined;
    const rawUrl = data.sourceUrl === undefined ? site.href : data.sourceUrl;
    if (typeof rawUrl !== 'string' || rawUrl.length > 2048 || /[\s\\\x00-\x1f\x7f]/.test(rawUrl)) return undefined;
    const source = new URL(rawUrl);
    if (source.protocol !== 'https:' || source.origin !== site.origin || source.username || source.password) return undefined;
    const attribution: MetaAttribution = {
      consent: true,
      consentedAt: now.toISOString(),
      sourceUrl: `${source.origin}${source.pathname}`,
    };
    for (const key of ['fbp', 'fbc'] as const) {
      const value = data[key];
      if (typeof value !== 'string' || value.length > 255) continue;
      const pattern = key === 'fbp'
        ? /^fb\.[0-9]\.([0-9]{13})\.[0-9]{1,100}$/
        : /^fb\.[0-9]\.([0-9]{13})\.[A-Za-z0-9_-]{1,220}$/;
      const match = pattern.exec(value);
      if (match && Number(match[1]) > 0 && Number(match[1]) <= now.getTime()) attribution[key] = value;
    }
    if (typeof userAgent === 'string' && userAgent.trim() && userAgent.length <= 512 && !/[\x00-\x1f\x7f]/.test(userAgent)) {
      attribution.clientUserAgent = userAgent;
    }
    // Only accept the server-resolved request IP, never an IP supplied in the JSON body.
    if (typeof clientIpAddress === 'string' && clientIpAddress.length <= 45 &&
        /^(?:\d{1,3}(?:\.\d{1,3}){3}|[0-9a-fA-F:]{2,45})$/.test(clientIpAddress) &&
        !/[\x00-\x20\x7f]/.test(clientIpAddress)) {
      attribution.clientIpAddress = clientIpAddress;
    }
    return attribution;
  } catch {
    // Missing/malformed optional tracking must never prevent a donation.
    return undefined;
  }
}

export function capturedPaymentSnapshot(input: unknown): MetaCapturedPayment | undefined {
  const payment = object(input);
  if (!payment || typeof payment.id !== 'string' || !/^pay_[A-Za-z0-9]{1,64}$/.test(payment.id)) return undefined;
  if (payment.status !== 'captured' || (payment.captured !== undefined && payment.captured !== true)) return undefined;
  if (payment.currency !== 'INR' || typeof payment.amount !== 'number' || !Number.isSafeInteger(payment.amount) || payment.amount <= 0) return undefined;
  return { id: payment.id, amount: payment.amount, currency: 'INR', status: 'captured', captured: true };
}

/** Route callers must authenticate the gateway callback/webhook before calling this helper. */
export async function reportCapturedConversion(
  service: MetaConversionsService, donation: StoredDonation | null, payment: unknown,
): Promise<void> {
  if (!service.enabled || !donation) return;
  const captured = capturedPaymentSnapshot(payment);
  if (!captured || donation.status !== 'verified' || donation.paymentRef !== captured.id || donation.amount * 100 !== captured.amount) return;
  try {
    // Only queues locally; Meta's network call runs in the independent outbox worker.
    await service.enqueuePurchase(donation, captured);
  } catch {
    // Defense against an unexpected implementation/adapter error; do not echo donor data.
    console.warn('[meta-capi] enqueue_failed');
  }
}

/** Shared finalization for authenticated checkout callbacks, gateway polling and signed webhooks. */
export async function verifyCapturedDonation(
  donations: Pick<DonationService, 'verify'>, service: MetaConversionsService,
  donation: StoredDonation, payment: unknown,
): Promise<StoredDonation> {
  const captured = capturedPaymentSnapshot(payment);
  if (!captured || captured.amount !== donation.amount * 100) {
    throw new BusinessError('A matching captured INR payment is required.', 'VALIDATION_ERROR');
  }
  if (donation.razorpayOrderId && object(payment)?.order_id !== donation.razorpayOrderId) {
    throw new BusinessError('Payment order does not match this donation.', 'VALIDATION_ERROR');
  }
  const verified = await donations.verify(donation.id, captured.id);
  await reportCapturedConversion(service, verified, captured);
  return verified;
}

/** Recurring consent is retained, but an old browser's cookies/UA are not reused for a new charge. */
export function recurringMetaAttribution(seed?: MetaAttribution): MetaAttribution | undefined {
  return seed?.consent === true ? { consent: true, consentedAt: seed.consentedAt, sourceUrl: seed.sourceUrl } : undefined;
}

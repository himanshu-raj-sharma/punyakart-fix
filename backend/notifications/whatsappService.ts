import logger from '../logger';
import { StoredDonation } from '../types';

function digitsOnly(phone: string): string {
  return phone.replace(/\D/g, '');
}

function toE164India(phone: string): string {
  const digits = digitsOnly(phone);
  if (digits.length === 10) return `91${digits}`;
  if (digits.startsWith('91') && digits.length === 12) return digits;
  return digits;
}

function siteBaseUrl(): string {
  const raw = (process.env.PUBLIC_SITE_URL || 'https://punyakart.com').trim().replace(/\/+$/, '');
  return raw || 'https://punyakart.com';
}

/** Deep link that opens the navbar 80G form, optionally prefilling the receipt from WhatsApp. */
export function build80GPortalLink(donation: StoredDonation): string {
  const q = encodeURIComponent(donation.receiptNumber || donation.transactionId || donation.id);
  return `${siteBaseUrl()}/?80g=1&q=${q}`;
}

export function getWhatsAppStatus(): { configured: boolean; reason?: string } {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const template = process.env.WHATSAPP_TEMPLATE_NAME;
  if (!token || !phoneNumberId || !template) {
    return {
      configured: false,
      reason: 'WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID, and WHATSAPP_TEMPLATE_NAME are required',
    };
  }
  return { configured: true };
}

function resolveTemplateText(
  key: string,
  donation: StoredDonation,
  eightyGLink: string,
): string {
  switch (key) {
    case 'name':
      return donation.fullName;
    case 'amount':
      // Template already includes ₹ before {{n}} — send digits only
      return donation.amount.toLocaleString('en-IN');
    case 'receipt':
      return donation.receiptNumber || donation.id;
    case '80gLink':
    case 'link':
      return eightyGLink;
    default:
      return '';
  }
}

/**
 * Sends a thank-you via Meta WhatsApp Cloud API using an approved template.
 *
 * Default body variables (override with WHATSAPP_TEMPLATE_VARS):
 *   {{1}} name, {{2}} amount, {{3}} receipt, {{4}} 80G download link
 *
 * Update the Meta template body to include thank-you copy + Download 80G link as {{4}}.
 * Set WHATSAPP_TEMPLATE_VARS=name,amount,receipt if the live template still has only 3 params.
 */
export async function sendWhatsAppThankYou(
  donation: StoredDonation,
): Promise<{ sent: boolean; skipped?: boolean; error?: string }> {
  const status = getWhatsAppStatus();
  if (!status.configured) {
    logger.warn({ reason: status.reason }, 'WhatsApp not configured; skipping thank-you');
    return { sent: false, skipped: true, error: status.reason };
  }

  const token = process.env.WHATSAPP_ACCESS_TOKEN as string;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID as string;
  const templateName = process.env.WHATSAPP_TEMPLATE_NAME as string;
  const languageCode = process.env.WHATSAPP_TEMPLATE_LANGUAGE || 'en';
  const to = toE164India(donation.phone);
  const eightyGLink = build80GPortalLink(donation);

  const varKeys = (process.env.WHATSAPP_TEMPLATE_VARS || 'name,amount,receipt,80gLink')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

  const bodyParams = varKeys.map((key) => ({
    type: 'text',
    text: resolveTemplateText(key, donation, eightyGLink),
  }));

  const payload = {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: templateName,
      language: { code: languageCode },
      components: [
        {
          type: 'body',
          parameters: bodyParams,
        },
      ],
    },
  };

  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const error = (data as { error?: { message?: string } })?.error?.message || `WhatsApp API ${res.status}`;
      logger.error({ data, donationId: donation.id }, 'WhatsApp thank-you failed');
      return { sent: false, error };
    }

    logger.info({ donationId: donation.id, to, eightyGLink }, 'WhatsApp thank-you sent');
    return { sent: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'WhatsApp send failed';
    logger.error({ err, donationId: donation.id }, 'WhatsApp thank-you exception');
    return { sent: false, error: message };
  }
}

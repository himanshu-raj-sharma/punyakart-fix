import { z } from 'zod';
import { BusinessError } from '../errors';
import { normalizeDonationSource } from '../validation';
import { donationAmountSchema } from './donationAmountSchema';
import { campaignIdFromSource, canonicalCampaignId } from '../campaignAttribution.js';

export const donationSchema = z.object({
  amount: donationAmountSchema,
  type: z.enum(['one-time', 'monthly']),
  causeTitle: z.string().trim().min(1, 'Cause title is required').max(240, 'Cause title is too long'),
  campaignId: z.string().trim().min(1).max(100).optional(),
  fullName: z.string().trim().min(2, 'Name must be at least 2 characters').max(100, 'Name must be at most 100 characters'),
  email: z.string().trim().email('Valid email address is required'),
  phone: z
    .string()
    .trim()
    .transform((value) => {
      const digits = value.replace(/\D/g, '');
      if (digits.startsWith('0091') && digits.length === 14) return digits.slice(4);
      if (digits.startsWith('91') && digits.length === 12) return digits.slice(2);
      return digits;
    })
    .refine((value) => /^[6-9]\d{9}$/.test(value), 'Valid WhatsApp number required (e.g. +91 9876543210)'),
  address: z.string().trim().min(5, 'Address must be at least 5 characters').max(300, 'Address is too long'),
  panNumber: z
    .string()
    .trim()
    .transform((value) => value.toUpperCase())
    .refine(
      (value) => value === '' || /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(value),
      'Invalid PAN format',
    )
    .optional()
    .default(''),
  want80G: z.boolean().default(true),
  /** Opt-in for monthly auto-debit / subscription record (only meaningful when type=monthly). */
  autoPay: z.boolean().optional().default(false),
  paymentMethod: z.literal('razorpay'),
  source: z.string().trim().max(120, 'Donation source is too long').optional(),
  fundRaiser: z
    .string()
    .trim()
    .max(80, 'Fund raiser name must be at most 80 characters')
    .optional()
    .default(''),
  dedication: z.object({
    dedicatedTo: z.string().max(160, 'Dedication name is too long').optional(),
    prayerMessage: z.string().max(1_000, 'Prayer message is too long').optional(),
    isAnonymous: z.boolean().optional(),
  }).optional(),
}).transform((data, context) => {
  const source = normalizeDonationSource(data.source);
  const fromSource = campaignIdFromSource(source);
  const campaignId = data.campaignId ? canonicalCampaignId(data.campaignId) : fromSource;
  if (campaignId && campaignId.length > 100) {
    context.addIssue({ code: 'custom', path: ['campaignId'], message: 'Campaign ID must be at most 100 characters.' });
    return z.NEVER;
  }
  if (source === 'campaign_' || (campaignId && data.source?.trim() && fromSource !== campaignId)) {
    context.addIssue({ code: 'custom', path: ['campaignId'], message: 'Campaign and donation source must agree.' });
    return z.NEVER;
  }
  return { ...data, campaignId, source: campaignId ? `campaign_${campaignId}` : source };
});

export function validateDonationPayload(payload: unknown) {
  const result = donationSchema.safeParse(payload);
  if (!result.success) {
    const errorDetails = result.error.issues.reduce((acc, err) => {
      acc[err.path.join('.')] = err.message;
      return acc;
    }, {} as Record<string, string>);
    throw new BusinessError('Validation failed', 'VALIDATION_ERROR', errorDetails);
  }
  return result.data;
}

import { canonicalCampaignId } from '../utils/campaignRoutes';

export const MIN_DONATION_AMOUNT = 200;
export const CHENNAI_MIN_DONATION_AMOUNT = MIN_DONATION_AMOUNT;
export const MAX_DONATION_AMOUNT = 10_000_000;
export const DONATION_AMOUNT_ERROR = 'Every Contribution Counts ❤️ Donate a Minimum of ₹200 to Bring Hope & Relief.';
export const AUTO_PAY_AMOUNTS = [500, 1000, 2000, 3500, 5000, 8500, 12000, 18000, 22000] as const;

export function normalizeDonationSource(source?: string): string {
  const trimmed = source?.trim();
  if (!trimmed || trimmed.toLowerCase() === 'chennai_airport') return 'chennai_airport';
  if (trimmed.toLowerCase().startsWith('campaign_')) {
    return `campaign_${canonicalCampaignId(trimmed.slice('campaign_'.length))}`;
  }
  return trimmed;
}

export function getMinimumDonationAmount(_source?: string): number {
  return MIN_DONATION_AMOUNT;
}

export function getDonationAmountError(_source?: string): string {
  return DONATION_AMOUNT_ERROR;
}

export function isValidDonationAmount(value: number, source: string = 'crowd_funding'): boolean {
  return Number.isFinite(value) && Number.isInteger(value) && value >= getMinimumDonationAmount(source) && value <= MAX_DONATION_AMOUNT;
}

/** Validate the original input without stripping signs, decimal points, or other characters. */
export function parseDonationAmount(value: string, source: string = 'crowd_funding'): number | null {
  if (!/^\d+$/.test(value.trim())) return null;
  const amount = Number(value.trim());
  return isValidDonationAmount(amount, source) ? amount : null;
}

export function isAutoPayAmount(value: number): boolean {
  return (AUTO_PAY_AMOUNTS as readonly number[]).includes(value);
}

export function normalizeDonationPhone(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.startsWith('0091') && digits.length === 14) return digits.slice(4);
  if (digits.startsWith('91') && digits.length === 12) return digits.slice(2);
  return digits;
}

export function isValidDonationPhone(value: string): boolean {
  return /^[6-9]\d{9}$/.test(normalizeDonationPhone(value));
}

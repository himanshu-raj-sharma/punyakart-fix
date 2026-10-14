import type { Language } from './data/languages';

export type { Language } from './data/languages';

/** Per-field copy: English required; other languages optional (fallback via pickLocale). */
export type LocalizedString = Partial<Record<Language, string>> & { en: string };

export function pickLocale(
  map: LocalizedString | undefined,
  language: Language,
): string {
  if (!map) return '';
  return map[language] || map.hi || map.en || '';
}

export type DonationType = 'one-time' | 'monthly';

/** Where the donation originated (landing / crowd / manual / future pages). */
export type DonationSource =
  | 'chennai_airport'
  | 'crowd_funding'
  | 'manual'
  | (string & {});

export const PUBLIC_DONATION_SOURCES = [
  'chennai_airport',
  'crowd_funding',
] as const;

export type PaymentMethod =
  | 'razorpay'
  | 'cash'
  | 'upi'
  | 'bank_transfer'
  | 'cheque'
  | 'card'
  | 'other';

export interface ImpactItem {
  id: string;
  amount: number;
  monthlyAmount?: number;
  title: LocalizedString;
  description: LocalizedString;
  impactPill: LocalizedString;
  badge?: string;
  popular?: boolean;
  image: string;
  iconName: string;
}

export interface DonorDedication {
  dedicatedTo?: string;
  prayerMessage?: string;
  isAnonymous?: boolean;
}

export interface DonationSubmission {
  verifiedAt?: string;
  paymentRef?: string;
  id: string;
  amount: number;
  type: DonationType;
  causeTitle: string;
  campaignId?: string;
  fullName: string;
  email: string;
  phone: string;
  address?: string;
  panNumber?: string;
  want80G: boolean;
  /** Monthly: donor opted to activate Auto Pay / recurring debit. */
  autoPay?: boolean;
  paymentMethod: PaymentMethod;
  timestamp: string;
  receiptNumber: string;
  transactionId?: string;
  terminal?: string;
  /** Landing (Chennai airport), crowd funding, manual receipt, etc. */
  source?: DonationSource;
  dedication?: DonorDedication;
  /** Employee / volunteer who raised this donation */
  fundRaiser?: string;
  /** Staff member who created / issued this receipt (manual receipts) */
  issuedBy?: string;
  /** Short-lived checkout credential retained only in memory for this donor's documents. */
  clientToken?: string;
}

export interface RecentDonor {
  id: string;
  name: string;
  amount: number;
  location: string;
  timeAgo: string;
  cause: string;
}

export interface SubscriptionRecord {
  id: string;
  donorName: string;
  email: string;
  phone: string;
  amount: number;
  frequency: string;
  causeTitle: string;
  startDate: string;
  nextBillingDate: string;
  status: 'ACTIVE' | 'PAUSED' | 'CANCELLED' | 'PENDING';
  paymentMethod: string;
  panNumber?: string;
}

export interface RescueStory {
  id: string;
  name: string;
  daysInShelter: string;
  beforeImage: string;
  afterImage: string;
  story: string;
}

/** Mirrors backend/types.ts CertificateDetails — keep in sync */
export interface CertificateDetails {
  ngoName: string;
  address: string;
  phone: string;
  email: string;
  panNumber80G: string;
  taxBenefit: string;
}

/** Shape returned by GET /api/donations/certificate */
export interface CertificateResult {
  donation: DonationSubmission;
  certificate: CertificateDetails;
  /** Issued only after the existing donor-details verification succeeds. */
  documentGrant?: string;
}

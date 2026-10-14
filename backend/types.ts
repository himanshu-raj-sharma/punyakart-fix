import { DonationSubmission, DonorDedication, DonationSource, DonationType, PaymentMethod, SubscriptionRecord } from '../frontend/src/types';
import type { MetaAttribution } from './metaConversions.js';
import type { TrafficAttribution } from '../frontend/src/utils/trafficAttribution.js';

export type { DonationSource };

export interface StoredDonation extends DonationSubmission {
  status: 'initiated' | 'pending_verification' | 'verified' | 'failed' | 'refunded';
  verifiedAt?: string;
  paymentRef?: string;
  razorpayOrderId?: string;
  razorpayQrId?: string;
  /** Razorpay Subscriptions id when monthly Auto Pay is activated. */
  razorpaySubscriptionId?: string;
  failureReason?: string;
  clientToken?: string;
  idempotencyKey?: string;
  /** Private checkout attribution, never returned to a browser or admin export. */
  metaAttribution?: MetaAttribution;
  /** Computed response flag; never accepted from a donation request. */
  metaTrackingAllowed?: boolean;
  /** First-party arrival summary: admin reporting only, independent of CAPI consent. */
  trafficAttribution?: TrafficAttribution;
}

export interface PublicDonorRecord {
  id: string;
  name: string;
  amount: number;
  date: string;
  location: string;
  cause: string;
}

export interface DonationInput {
  amount: number;
  type: DonationType;
  causeTitle: string;
  campaignId?: string;
  fullName: string;
  email: string;
  phone: string;
  address: string;
  panNumber: string;
  want80G: boolean;
  autoPay?: boolean;
  paymentMethod: PaymentMethod;
  dedication?: DonorDedication;
  fundRaiser?: string;
  issuedBy?: string;
  source?: DonationSource;
}

export interface CertificateDetails {
  ngoName: string;
  address: string;
  phone: string;
  email: string;
  panNumber80G: string;
  taxBenefit: string;
}

export interface CertificateResult {
  donation: StoredDonation;
  certificate: CertificateDetails;
}

export interface FundRaiserSummary {
  name: string;
  donationCount: number;
  totalAmount: number;
}

export interface FundRaiserReport {
  fundRaisers: FundRaiserSummary[];
  unassigned: FundRaiserSummary;
}

export type StoredSubscription = SubscriptionRecord & {
  initialReceiptNumber?: string;
  razorpaySubscriptionId?: string;
  /** First donation that authorized the mandate. */
  seedDonationId?: string;
  address?: string;
  source?: DonationSource;
};

export type CertificateDownloadSource =
  | 'public'
  | 'email'
  | 'admin-download'
  | 'admin-create'
  | 'admin-issue'
  | 'issued'
  | 'receipt-public'
  | 'receipt-admin-download'
  | 'receipt-admin-create';

export interface CertificateDownloadRecord {
  id: string;
  donationId: string;
  fullName: string;
  email: string;
  phone: string;
  amount: number;
  receiptNumber: string;
  transactionId?: string;
  panNumber?: string;
  downloadedAt: string;
  source: CertificateDownloadSource;
  downloadCount?: number;
}

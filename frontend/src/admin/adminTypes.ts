import type { TrafficAttribution } from '../utils/trafficAttribution';
import { resolveRecordedDonationSource } from '../utils/donationSource';

export type AdminTrafficAttribution = TrafficAttribution;

export interface AdminDonation {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  address: string;
  panNumber: string;
  amount: number;
  type: string;
  causeTitle: string;
  fundRaiser: string;
  autoPay?: boolean;
  razorpaySubscriptionId?: string;
  timestamp: string;
  verifiedAt: string;
  receiptNumber: string;
  transactionId: string;
  paymentRef: string;
  razorpayOrderId: string;
  status: string;
  want80G: boolean;
  paymentMethod: string;
  terminal: string;
  issuedBy: string;
  source: string;
  campaignId?: string;
  trafficAttribution?: AdminTrafficAttribution;
  certificateDownloaded: boolean;
  certificateDownloadedAt: string;
  certificateDownloadSource: string;
  receiptDownloaded: boolean;
  receiptDownloadedAt: string;
  receiptDownloadSource: string;
}

export interface FundRaiserRow {
  name: string;
  donationCount: number;
  totalAmount: number;
}

export interface CertificateLogRow {
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
  source:
    | 'public'
    | 'email'
    | 'admin-download'
    | 'admin-create'
    | 'admin-issue'
    | 'issued'
    | 'receipt-public'
    | 'receipt-admin-download'
    | 'receipt-admin-create';
  downloadCount?: number;
}

export type CertificateDownloadStatus = 'downloaded' | 'not-downloaded' | 'not-eligible';

export type AdminTab =
  | 'statistics'
  | 'staff'
  | 'donors'
  | 'payment-attempts'
  | 'certificates'
  | 'manual'
  | 'receipt'
  | 'autopay'
  | 'campaigns'
  | 'blogs';

export interface AdminCampaign {
  id: string;
  title: string;
  category: string;
  organizer: string;
  target: number;
  image: string;
  description: string;
  content?: CampaignContent;
  donation_presets?: number[];
  faqs?: Array<{ question: string; answer: string }>;
  sort_order: number;
  has_tax_benefit: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  raised: number;
  donors: number;
}

export interface AdminBlog {
  id: string;
  title: string;
  slug: string;
  subtitle: string;
  excerpt: string;
  content: string;
  author: string;
  tags: string[];
  sections: Array<{ heading: string; body: string; image: string }>;
  cover_image: string;
  youtube_url: string;
  seo_title: string;
  seo_description: string;
  is_active: boolean;
  published_at: string;
  created_at: string;
  updated_at: string;
}

export interface AdminPaymentAttempt {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  amount: number;
  causeTitle: string;
  source: string;
  campaignId: string;
  status: string;
  timestamp: string;
  razorpayOrderId: string;
  razorpaySubscriptionId: string;
  failureReason: string;
}

export interface AdminPaymentSyncDiagnostics {
  checkedAt: string;
  databaseName: string;
  databaseHost: string;
  donations: {
    total: number;
    byStatus: Array<{ status: string; count: number; newestTimestamp: string; oldestTimestamp: string }>;
  };
  paymentAttempts: {
    collectionExists: boolean;
    total: number;
    byStatus: Array<{ status: string; count: number; newestTimestamp: string; oldestTimestamp: string }>;
  };
}

export interface AdminSubscription {
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
  initialReceiptNumber?: string;
  razorpaySubscriptionId?: string;
  seedDonationId?: string;
  source?: string;
}

export type DonationSourceFilter = 'all' | 'chennai_airport' | 'crowd_funding' | 'manual';

export const DONATION_SOURCE_FILTERS: { id: DonationSourceFilter; label: string }[] = [
  { id: 'all', label: 'All campaigns / portals' },
  { id: 'chennai_airport', label: 'Chennai Airport' },
  { id: 'crowd_funding', label: 'Crowd Funding' },
  { id: 'manual', label: 'Manual' },
];

export function resolveAdminDonationSource(row: { source?: string; campaignId?: string }): string {
  return resolveRecordedDonationSource(row);
}

export function sourceFilterLabel(source: string): string {
  if (source === 'unknown') return 'Unknown';
  if (source.startsWith('campaign_')) {
    return 'Campaign: ' + source.slice(9);
  }
  return DONATION_SOURCE_FILTERS.find((item) => item.id === source)?.label || source;
}

export const ADMIN_KEY_STORAGE = 'punyakart_admin_key';
export const ADMIN_IDLE_MS = 5 * 60 * 1000;
export const ADMIN_FETCH_MS = 12_000;
export const ADMIN_LIVE_REFRESH_MS = 30_000;
import type { CampaignContent } from '../types/campaignCms';

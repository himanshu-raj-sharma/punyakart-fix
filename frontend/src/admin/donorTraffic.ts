import { resolveAdminDonationSource, sourceFilterLabel } from './adminTypes';
import type { AdminDonation } from './adminTypes';

export const TRAFFIC_SOURCE_OPTIONS = [
  { id: 'facebook', label: 'Facebook' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'google', label: 'Google' },
  { id: 'bing', label: 'Bing' },
  { id: 'youtube', label: 'YouTube' },
  { id: 'linkedin', label: 'LinkedIn' },
  { id: 'telegram', label: 'Telegram' },
  { id: 'x', label: 'X' },
  { id: 'meta', label: 'Meta (platform unknown)' },
  { id: 'referral', label: 'Other referral' },
  { id: 'other', label: 'Other tagged source' },
  { id: 'direct_unknown', label: 'Direct / unknown' },
  { id: 'unknown', label: 'Unknown — not recorded' },
] as const;

export type AdminTrafficSource = (typeof TRAFFIC_SOURCE_OPTIONS)[number]['id'];
export type TrafficSourceFilter = 'all' | AdminTrafficSource;
export type EightyGFilter = 'all' | 'downloaded' | 'not-downloaded';

const EVIDENCE_LABELS = {
  utm: 'UTM',
  referrer: 'Referrer',
  click_id: 'Click hint',
  none: 'No referrer',
} as const;

export function donorTrafficSource(row: Pick<AdminDonation, 'trafficAttribution'>): AdminTrafficSource {
  const snapshot = row.trafficAttribution;
  if (!snapshot || snapshot.version !== 1) return 'unknown';
  return TRAFFIC_SOURCE_OPTIONS.find((option) => option.id === snapshot.source)?.id || 'unknown';
}

export function trafficSourceLabel(source: string): string {
  return TRAFFIC_SOURCE_OPTIONS.find((option) => option.id === source)?.label || 'Unknown — not recorded';
}

export function donorTrafficEvidence(row: Pick<AdminDonation, 'trafficAttribution'>): string {
  const snapshot = row.trafficAttribution;
  if (!snapshot || snapshot.version !== 1) return 'Not recorded';
  return Object.hasOwn(EVIDENCE_LABELS, snapshot.evidence) ? EVIDENCE_LABELS[snapshot.evidence] : 'Not recorded';
}

export function isEligibleDonorStatus(status: string): boolean {
  const value = status.toLowerCase();
  return value === 'verified' || value === 'completed';
}

export function donorSearchText(row: AdminDonation): string {
  const snapshot = row.trafficAttribution;
  const campaign = resolveAdminDonationSource(row);
  const traffic = donorTrafficSource(row);
  return [
    row.fullName, row.email, row.phone, row.address, row.panNumber,
    row.receiptNumber, row.transactionId, row.paymentRef, row.causeTitle,
    row.fundRaiser, row.status, row.id,
    row.certificateDownloaded ? 'downloaded' : 'not downloaded',
    campaign, sourceFilterLabel(campaign), traffic, trafficSourceLabel(traffic),
    donorTrafficEvidence(row), snapshot?.utmSource, snapshot?.utmMedium,
    snapshot?.utmCampaign, snapshot?.utmContent, snapshot?.referrerHost,
    snapshot?.inherited ? 'Original signup (not a new visit)' : '',
  ].join(' ').toLowerCase();
}

export function filterDonorRows(
  donations: AdminDonation[],
  { query = '', eightyGFilter = 'all', trafficSource = 'all' }: {
    query?: string;
    eightyGFilter?: EightyGFilter;
    trafficSource?: TrafficSourceFilter;
  } = {},
): AdminDonation[] {
  const needle = query.trim().toLowerCase();
  return donations.filter((row) => {
    if (eightyGFilter === 'downloaded' && !row.certificateDownloaded) return false;
    if (eightyGFilter === 'not-downloaded' && (row.certificateDownloaded || !isEligibleDonorStatus(row.status))) return false;
    if (trafficSource !== 'all' && donorTrafficSource(row) !== trafficSource) return false;
    return !needle || donorSearchText(row).includes(needle);
  });
}

export const DONOR_CSV_HEADERS = [
  'Name', 'Phone', 'Email', 'Amount', 'Status', 'Campaign / portal',
  'Traffic source', 'Attribution evidence', 'UTM source', 'UTM medium',
  'UTM campaign', 'UTM content', 'Referrer host', 'Landing path',
  'Attribution captured at', 'Inherited attribution',
  '80G', '80G Downloaded at', 'Receipt PDF', 'Receipt Downloaded at',
  'Receipt No', 'Transaction ID', 'PAN', 'Address', 'Cause', 'Fund raiser', 'Date',
] as const;

export function donorCsvRow(row: AdminDonation): Array<string | number> {
  const snapshot = row.trafficAttribution;
  return [
    row.fullName, row.phone, row.email, row.amount, row.status,
    sourceFilterLabel(resolveAdminDonationSource(row)),
    trafficSourceLabel(donorTrafficSource(row)), donorTrafficEvidence(row),
    snapshot?.utmSource || '', snapshot?.utmMedium || '', snapshot?.utmCampaign || '',
    snapshot?.utmContent || '', snapshot?.referrerHost || '', snapshot?.landingPath || '',
    snapshot?.capturedAt || '',
    snapshot?.inherited ? 'Yes — original signup (not a new visit)' : snapshot ? 'No' : '',
    row.certificateDownloaded ? 'Downloaded' : isEligibleDonorStatus(row.status) ? 'Not downloaded' : 'Not eligible',
    row.certificateDownloadedAt || '',
    row.receiptDownloaded ? 'Downloaded' : isEligibleDonorStatus(row.status) ? 'Not downloaded' : 'Not eligible',
    row.receiptDownloadedAt || '', row.receiptNumber, row.transactionId || row.paymentRef,
    row.panNumber, row.address, row.causeTitle, row.fundRaiser, row.verifiedAt || row.timestamp,
  ];
}

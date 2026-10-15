import type { StoredDonation } from './types.js';
import { storedTrafficAttribution } from './trafficAttribution.js';
import { attributedCampaignId } from './campaignAttribution.js';
import { resolveRecordedDonationSource } from '../frontend/src/utils/donationSource.js';

/** Explicit admin response allowlist: attribution never implies a payment/campaign status. */
export function toAdminDonation(
  d: StoredDonation,
  downloads = new Map<string, { downloadedAt: string; source: string }>(),
  receiptDownloads = new Map<string, { downloadedAt: string; source: string }>(),
) {
  const downloadRecord = downloads.get(d.id);
  // Historical records wrote a certificate row when the 80G email was sent.
  // Email delivery is not proof that the recipient downloaded the PDF.
  const download = downloadRecord?.source === 'email' ? undefined : downloadRecord;
  const receiptDownload = receiptDownloads.get(d.id);
  return {
    id: d.id,
    fullName: d.fullName,
    email: d.email,
    phone: d.phone,
    address: d.address || '',
    panNumber: d.panNumber || '',
    amount: d.amount,
    type: d.type,
    causeTitle: d.causeTitle,
    fundRaiser: d.fundRaiser || '',
    autoPay: Boolean(d.autoPay),
    razorpaySubscriptionId: d.razorpaySubscriptionId || '',
    timestamp: d.timestamp,
    verifiedAt: d.verifiedAt || '',
    receiptNumber: d.receiptNumber || '',
    transactionId: d.transactionId || '',
    paymentRef: d.paymentRef || '',
    razorpayOrderId: d.razorpayOrderId || '',
    status: d.status,
    want80G: d.want80G,
    paymentMethod: d.paymentMethod,
    terminal: d.terminal || '',
    issuedBy: d.issuedBy || '',
    // Previously omitted: its absence made the frontend label every row Chennai Airport.
    // Admin history must not invent Chennai attribution for old rows that
    // have neither a source nor a campaign ID. The frontend helper also
    // canonicalizes the historical Navratri alias to campaign_c7.
    source: resolveRecordedDonationSource(d),
    campaignId: attributedCampaignId(d) || '',
    trafficAttribution: storedTrafficAttribution(d.trafficAttribution),
    certificateDownloaded: Boolean(download),
    certificateDownloadedAt: download?.downloadedAt || '',
    certificateDownloadSource: download?.source || '',
    receiptDownloaded: Boolean(receiptDownload),
    receiptDownloadedAt: receiptDownload?.downloadedAt || '',
    receiptDownloadSource: receiptDownload?.source || '',
  };
}

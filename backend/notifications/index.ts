import logger from '../logger';
import { CertificateDetails, StoredDonation } from '../types';
import { send80GCertificateEmail, getEmailStatus } from './emailService';
import { sendWhatsAppThankYou, getWhatsAppStatus } from './whatsappService';
import { recordCertificateDownloadSafe } from '../certificateDownloadService';

const PENDING_ITR = 'Pending registration — not valid for ITR';

function officialNumber(value: string | undefined, fallback?: string): string {
  const trimmed = (value || '').trim();
  if (!trimmed || /AAATD1234/i.test(trimmed) || trimmed.includes('your_')) {
    const alt = (fallback || '').trim();
    if (alt && !/AAATD1234/i.test(alt) && !alt.includes('your_')) return alt;
    return PENDING_ITR;
  }
  return trimmed;
}

export function getCertificateDetails(): CertificateDetails {
  return {
    ngoName: 'Punyakart Foundation',
    address: '59/22, Near SBI Bank, Moti Bazar, Dehradun - 248001',
    phone: '+91 9105155556',
    email: process.env.NGO_CONTACT_EMAIL || 'info@punyakart.com',
    panNumber80G: officialNumber(process.env.NGO_80G_NUMBER),
    taxBenefit: process.env.NGO_TAX_BENEFIT || '50% Deduction under Section 80G of Income Tax Act 1961',
  };
}


export function getNotificationReadiness() {
  return {
    email: getEmailStatus(),
    whatsapp: getWhatsAppStatus(),
  };
}

/** Fire-and-forget post-payment notifications after verified donation. */
export async function notifyDonorAfterVerification(donation: StoredDonation): Promise<void> {
  const cert = getCertificateDetails();
  const [whatsapp, email] = await Promise.all([
    sendWhatsAppThankYou(donation),
    send80GCertificateEmail(donation, cert),
  ]);

  if (email.sent) {
    recordCertificateDownloadSafe(donation, 'email');
  }

  logger.info(
    {
      donationId: donation.id,
      whatsapp,
      email,
    },
    'Post-verification notifications completed',
  );
}

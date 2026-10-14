import nodemailer from 'nodemailer';
import logger from '../logger';
import { StoredDonation, CertificateDetails } from '../types';
import { build80GCertificatePdf } from './certificatePdf';
import { buildDonationReceiptPdf } from './donationReceiptPdf';

function isEmailConfigured(): boolean {
  return Boolean(
    process.env.SMTP_HOST &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS &&
    process.env.EMAIL_FROM,
  );
}

export function getEmailStatus(): { configured: boolean; reason?: string } {
  if (isEmailConfigured()) return { configured: true };
  return { configured: false, reason: 'SMTP_HOST, SMTP_USER, SMTP_PASS, and EMAIL_FROM are required' };
}

export async function send80GCertificateEmail(
  donation: StoredDonation,
  certificate: CertificateDetails,
): Promise<{ sent: boolean; skipped?: boolean; error?: string }> {
  const status = getEmailStatus();
  if (!status.configured) {
    logger.warn({ reason: status.reason }, 'Email not configured; skipping 80G email');
    return { sent: false, skipped: true, error: status.reason };
  }

  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const [certificatePdf, receiptPdf] = await Promise.all([
      build80GCertificatePdf(donation, certificate),
      buildDonationReceiptPdf(donation, certificate),
    ]);
    const from = process.env.EMAIL_FROM as string;
    const replyTo = process.env.EMAIL_REPLY_TO || from;

    await transporter.sendMail({
      from: process.env.EMAIL_FROM_NAME
        ? `"${process.env.EMAIL_FROM_NAME}" <${process.env.EMAIL_FROM}>`
        : from,
      to: donation.email,
      replyTo,
      subject: `Your 80G Certificate & Donation Receipt — ${certificate.ngoName} | ${donation.receiptNumber}`,
      text: [
        `Dear ${donation.fullName},`,
        '',
        `Thank you for your donation of ₹${donation.amount.toLocaleString('en-IN')} to ${certificate.ngoName}.`,
        `Receipt Number: ${donation.receiptNumber}`,
        `Purpose: ${donation.causeTitle}`,
        '',
        'Attached PDFs:',
        '1. Your 80G tax exemption certificate',
        '2. Your branded donation receipt',
        '',
        `With gratitude,`,
        certificate.ngoName,
        certificate.phone,
      ].join('\n'),
      attachments: [
        {
          filename: `${donation.receiptNumber || '80G'}-certificate.pdf`,
          content: certificatePdf,
          contentType: 'application/pdf',
        },
        {
          filename: `${donation.receiptNumber || 'receipt'}-receipt.pdf`,
          content: receiptPdf,
          contentType: 'application/pdf',
        },
      ],
    });

    logger.info({ donationId: donation.id, email: donation.email }, '80G certificate email sent');
    return { sent: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Email send failed';
    logger.error({ err, donationId: donation.id }, 'Failed to send 80G email');
    return { sent: false, error: message };
  }
}

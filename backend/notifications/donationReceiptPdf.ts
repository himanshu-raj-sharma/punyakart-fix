import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { StoredDonation, CertificateDetails } from '../types';
import { amountInWordsInr } from './amountInWords';

export { amountInWordsInr };

function resolveLogoPath(): string | null {
  const candidates = [
    path.join(process.cwd(), 'public', 'punyakart-logo-icon.png'),
    path.join(process.cwd(), 'dist', 'punyakart-logo-icon.png'),
    path.join(process.cwd(), 'punyakart-logo-icon.png'),
  ];
  return candidates.find((p) => fs.existsSync(p)) || null;
}

function formatReceiptDate(iso?: string): string {
  const d = new Date(iso || Date.now());
  if (Number.isNaN(d.getTime())) return iso || '—';
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  if (digits.length === 12 && digits.startsWith('91')) {
    return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  }
  return phone || '—';
}

type ReceiptTheme = 'airport' | 'crowd';

/** Historical rows without source are treated as Chennai airport (landing). */
function themeForDonation(donation: StoredDonation): ReceiptTheme {
  const source = (donation.source || '').trim() || 'chennai_airport';
  return source === 'campaign' ? 'crowd' : 'airport';
}

/** Absolute text that never advances flow / never triggers auto page breaks. */
function putText(
  doc: PDFKit.PDFDocument,
  text: string,
  x: number,
  y: number,
  opts: {
    width?: number;
    align?: 'left' | 'center' | 'right' | 'justify';
    height?: number;
  } = {},
): void {
  const { height, ...rest } = opts;
  doc.text(text, x, y, {
    ...rest,
    lineBreak: false,
    ...(height != null ? { height, ellipsis: true } : {}),
  });
}

/**
 * Elegant branded donation receipt (not an 80G tax certificate).
 * Forced single A4 page: margin 0 + absolute layout (PDFKit default margins
 * were pushing the footer onto extra pages).
 */
export async function buildDonationReceiptPdf(
  donation: StoredDonation,
  certificate: CertificateDetails,
): Promise<Buffer> {
  const theme = themeForDonation(donation);
  const isAirport = theme === 'airport';
  const website = 'https://www.punyakartfoundation.org';

  return new Promise((resolve, reject) => {
    // margin: 0 is required — default 40pt bottom margin caused footer draws to spawn pages
    const doc = new PDFDocument({ size: 'A4', margin: 0, bufferPages: true, autoFirstPage: true });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const navy = '#002D62';
    const orange = '#FF6B00';
    const soft = '#F7F9FC';
    const pageW = doc.page.width;
    const pageH = doc.page.height;
    const left = 44;
    const right = pageW - 44;
    const contentW = right - left;
    const logoPath = resolveLogoPath();
    const footerH = 50;
    const footerTop = pageH - footerH - 8;

    // Soft page wash
    doc.rect(0, 0, pageW, pageH).fill(soft);

    // Corner accent bars
    doc.rect(0, 0, 8, pageH).fill(navy);
    doc.rect(pageW - 8, 0, 8, pageH).fill(orange);

    // Large centered logo watermark (kept well inside page bounds)
    if (logoPath) {
      try {
        const wm = 220;
        doc.save();
        doc.opacity(0.05);
        doc.image(logoPath, (pageW - wm) / 2, (pageH - wm) / 2 - 10, { width: wm, height: wm });
        doc.restore();
      } catch {
        // skip watermark
      }
    }

    // Slim elegant top ribbon (no photo)
    doc.rect(8, 0, pageW - 16, 6).fill(navy);
    doc.rect(8, 6, pageW - 16, 3).fill(orange);

    let y = 32;

    // Brand row
    if (logoPath) {
      try {
        doc.image(logoPath, left, y, { width: 44, height: 44 });
      } catch {
        // text-only
      }
    }

    doc.fillColor(navy).font('Helvetica-Bold').fontSize(16);
    putText(doc, certificate.ngoName, left + 56, y + 2, { width: contentW - 66, height: 18 });
    doc.fillColor('#64748b').font('Helvetica').fontSize(8);
    putText(doc, 'Turning Compassion into Action', left + 56, y + 22, { width: contentW - 66, height: 12 });
    doc.fillColor(orange).font('Helvetica-Oblique').fontSize(9);
    putText(
      doc,
      isAirport ? 'Kindness Travels Farther Than We Do' : 'Together We Make A Difference',
      left + 56,
      y + 34,
      { width: contentW - 66, height: 12 },
    );

    y = 88;

    // Decorative rule under brand
    doc.strokeColor('#e2e8f0').lineWidth(1).moveTo(left, y).lineTo(right, y).stroke();
    doc.circle(pageW / 2, y, 2.5).fill(orange);
    y += 14;

    // Title block
    doc.roundedRect(left, y, contentW, 44, 8).fill(navy);
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(16);
    putText(doc, 'DONATION RECEIPT', left, y + 8, { width: contentW, align: 'center', height: 18 });
    doc.fillColor('#fdba74').font('Helvetica').fontSize(9);
    putText(doc, 'Thank You for Your Support', left, y + 26, {
      width: contentW,
      align: 'center',
      height: 12,
    });
    y += 54;

    // Venue acknowledgement card
    doc.roundedRect(left, y, contentW, 40, 8).fill('#ffffff');
    doc.strokeColor('#e2e8f0').lineWidth(0.8).roundedRect(left, y, contentW, 40, 8).stroke();
    doc.fillColor(navy).font('Helvetica-Bold').fontSize(8.5);
    const venueLine = isAirport
      ? 'This is to acknowledge your generous contribution to Punyakart Foundation at Chennai International Airport.'
      : 'This is to acknowledge your generous contribution to Punyakart Foundation Campaign.';
    putText(doc, venueLine, left + 12, y + 6, { width: contentW - 24, height: 14 });
    doc.fillColor('#64748b').font('Helvetica').fontSize(7.5);
    putText(
      doc,
      'Your support helps us create a kinder, safer and healthier world for animals, communities and those in need.',
      left + 12,
      y + 22,
      { width: contentW - 24, height: 14 },
    );
    y += 48;

    // Donor details panel
    doc.roundedRect(left, y, contentW, 22, 6).fill(navy);
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(9);
    putText(doc, 'DONOR DETAILS', left + 14, y + 6, { width: 200, height: 12 });
    y += 26;

    const txnId = donation.paymentRef || donation.transactionId || '—';
    const rows: [string, string][] = [
      ['Receipt No.', donation.receiptNumber || donation.id],
      ['Transaction ID', txnId],
      ['Date', formatReceiptDate(donation.verifiedAt || donation.timestamp)],
      ['Donor Name', donation.fullName],
      ['Mobile Number', formatPhone(donation.phone)],
      ['Email', donation.email],
      ['Address', donation.address || '—'],
      ['PAN Number', donation.panNumber || '—'],
      ['Supported Cause', donation.causeTitle || '—'],
    ];

    const rowH = 18;
    rows.forEach(([label, value], idx) => {
      const bg = idx % 2 === 0 ? '#ffffff' : '#f1f5f9';
      doc.rect(left, y, contentW, rowH).fill(bg);
      doc.fillColor(orange).font('Helvetica-Bold').fontSize(7.5);
      putText(doc, label, left + 14, y + 4.5, { width: 108, height: 12 });
      doc.fillColor(navy).font('Helvetica').fontSize(8.5);
      putText(doc, value, left + 126, y + 4, { width: contentW - 140, height: 12 });
      y += rowH;
    });

    // Amount highlight strip
    doc.roundedRect(left, y + 4, contentW, 32, 8).fill('#fff7ed');
    doc.strokeColor(orange).lineWidth(1.2).roundedRect(left, y + 4, contentW, 32, 8).stroke();
    doc.fillColor(orange).font('Helvetica-Bold').fontSize(7.5);
    putText(doc, 'DONATION AMOUNT', left + 14, y + 8, { width: 160, height: 10 });
    doc.fillColor(navy).font('Helvetica-Bold').fontSize(11);
    putText(
      doc,
      `₹ ${donation.amount.toLocaleString('en-IN')}/-  ·  ${amountInWordsInr(donation.amount)}`,
      left + 14,
      y + 18,
      { width: contentW - 28, height: 14 },
    );
    y += 46;

    // Thank you + signature (absolute only — keep clear of footer)
    doc.fillColor(orange).font('Helvetica-Oblique').fontSize(16);
    putText(doc, 'Thank You', left, y, { width: contentW * 0.55, height: 18 });
    y += 20;
    doc.fillColor(navy).font('Helvetica').fontSize(10);
    putText(doc, 'for being a part of the Punyakart family!', left, y, {
      width: contentW * 0.55,
      height: 14,
    });
    y += 18;

    const thankBody = isAirport
      ? 'Your contribution at Chennai International Airport supports rescued animals, communities, and a kinder tomorrow.'
      : 'Your contribution supports rescued animals, communities, and a kinder tomorrow — with care and transparency.';
    doc.fillColor('#64748b').font('Helvetica').fontSize(8);
    putText(doc, thankBody, left, y, { width: contentW * 0.55, height: 28 });

    const sigX = left + contentW * 0.6;
    const sigY = y - 8;
    doc.strokeColor('#cbd5e1').lineWidth(0.7).moveTo(sigX + 16, sigY + 24).lineTo(sigX + contentW * 0.4 - 8, sigY + 24).stroke();
    doc.fillColor(navy).font('Helvetica-Oblique').fontSize(11);
    putText(doc, 'Ashu Arora', sigX, sigY + 28, { width: contentW * 0.4, align: 'center', height: 14 });
    doc.font('Helvetica').fontSize(7.5).fillColor('#64748b');
    putText(doc, 'Team Punyakart Foundation', sigX, sigY + 42, {
      width: contentW * 0.4,
      align: 'center',
      height: 12,
    });

    y += 36;
    doc.fillColor('#94a3b8').font('Helvetica-Oblique').fontSize(7.5);
    putText(doc, '"The smallest act of kindness can make the biggest difference."', left, y, {
      width: contentW * 0.75,
      height: 12,
    });

    y += 16;
    const chips = ['For Animals', 'For Communities', 'For a Kinder Tomorrow'];
    const chipW = (contentW - 16) / 3;
    // Keep chips above footer
    if (y + 28 > footerTop - 6) y = footerTop - 34;
    chips.forEach((chip, i) => {
      const x = left + i * (chipW + 8);
      doc.roundedRect(x, y, chipW, 22, 11).fill('#ffffff');
      doc.strokeColor('#fed7aa').lineWidth(1).roundedRect(x, y, chipW, 22, 11).stroke();
      doc.fillColor(orange).font('Helvetica-Bold').fontSize(7.5);
      putText(doc, chip, x, y + 6, { width: chipW, align: 'center', height: 12 });
    });

    // Elegant footer — drawn within page bounds (margin 0)
    doc.rect(8, footerTop, pageW - 16, footerH).fill(navy);
    doc.rect(8, footerTop, pageW - 16, 3).fill(orange);

    if (logoPath) {
      try {
        doc.image(logoPath, left, footerTop + 12, { width: 22, height: 22 });
      } catch {
        // skip
      }
    }

    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(8);
    putText(doc, certificate.ngoName, left + 30, footerTop + 10, {
      width: contentW * 0.4,
      height: 12,
    });
    doc.font('Helvetica').fontSize(6.5).fillColor('#bfdbfe');
    putText(
      doc,
      `${website}  ·  ${certificate.email}  ·  ${certificate.phone}`,
      left + 30,
      footerTop + 22,
      { width: contentW - 130, height: 10 },
    );
    doc.fillColor('#93c5fd').fontSize(6);
    putText(
      doc,
      'Registered Non-Profit  ·  Compassion | Service | Change',
      left + 30,
      footerTop + 34,
      { width: contentW * 0.55, height: 10 },
    );

    doc.roundedRect(right - 88, footerTop + 15, 80, 20, 10).fill(orange);
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(8);
    putText(doc, 'Be the Change', right - 88, footerTop + 20, {
      width: 80,
      align: 'center',
      height: 12,
    });

    // Flush only the first page if anything still overflowed
    const range = doc.bufferedPageRange();
    if (range.count > 1) {
      doc.switchToPage(range.start);
    }
    doc.end();
  });
}

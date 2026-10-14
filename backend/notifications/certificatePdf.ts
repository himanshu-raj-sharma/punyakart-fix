import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { StoredDonation, CertificateDetails } from '../types';
import { indianFinancialYear } from '../receiptNumber';
import { amountInWordsInr } from './amountInWords';

function resolveLogoPath(): string | null {
  const candidates = [
    path.join(process.cwd(), 'public', 'punyakart-logo-icon.png'),
    path.join(process.cwd(), 'dist', 'punyakart-logo-icon.png'),
    path.join(process.cwd(), 'punyakart-logo-icon.png'),
  ];
  return candidates.find((p) => fs.existsSync(p)) || null;
}

function formatCertDate(iso?: string): string {
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

const PAYMENT_LABEL: Record<string, string> = {
  razorpay: 'Online (Razorpay)',
  cash: 'Cash',
  upi: 'UPI',
  bank_transfer: 'Bank Transfer',
  cheque: 'Cheque',
  card: 'Card',
  other: 'Other',
};

/**
 * Official 80G tax exemption certificate (PDFKit).
 * Formal bordered certificate layout — intentionally distinct from the branded donation receipt.
 */
export async function build80GCertificatePdf(
  donation: StoredDonation,
  certificate: CertificateDetails,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 48, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const navy = '#002D62';
    const ink = '#0f172a';
    const muted = '#475569';
    const pageW = doc.page.width;
    const pageH = doc.page.height;
    const margin = 28;

    // Outer certificate frame (formal look — not receipt marketing strip)
    doc.strokeColor(navy).lineWidth(2.2).rect(margin, margin, pageW - margin * 2, pageH - margin * 2).stroke();
    doc.strokeColor('#94a3b8').lineWidth(0.6).rect(margin + 6, margin + 6, pageW - margin * 2 - 12, pageH - margin * 2 - 12).stroke();

    const contentLeft = 56;
    const contentWidth = pageW - contentLeft * 2;
    let y = 52;

    const logoPath = resolveLogoPath();
    if (logoPath) {
      try {
        const logoW = 54;
        doc.image(logoPath, (pageW - logoW) / 2, y, { width: logoW });
        y += 62;
      } catch {
        // text-only header
      }
    }

    doc.fillColor(navy).font('Helvetica-Bold').fontSize(18);
    doc.text(certificate.ngoName, contentLeft, y, { width: contentWidth, align: 'center' });
    y = doc.y + 4;

    doc.fillColor(muted).font('Helvetica').fontSize(9);
    doc.text(certificate.address, contentLeft, y, { width: contentWidth, align: 'center' });
    y = doc.y + 2;
    doc.text(`Phone: ${certificate.phone}  |  Email: ${certificate.email}`, contentLeft, y, {
      width: contentWidth,
      align: 'center',
    });
    y = doc.y + 14;

    // Formal title rule
    doc.strokeColor(navy).lineWidth(1).moveTo(contentLeft + 40, y).lineTo(pageW - contentLeft - 40, y).stroke();
    y += 12;

    doc.fillColor(navy).font('Helvetica-Bold').fontSize(15);
    doc.text('80G Tax Exemption Certificate', contentLeft, y, { width: contentWidth, align: 'center' });
    y = doc.y + 4;
    doc.fillColor(muted).font('Helvetica').fontSize(9);
    doc.text(certificate.taxBenefit, contentLeft, y, { width: contentWidth, align: 'center' });
    y = doc.y + 12;

    doc.strokeColor('#cbd5e1').lineWidth(0.8).moveTo(contentLeft + 40, y).lineTo(pageW - contentLeft - 40, y).stroke();
    y += 14;

    doc.fillColor(ink).font('Helvetica').fontSize(9.5);
    doc.text(
      'This certificate confirms that the donation detailed below qualifies for deduction under Section 80G of the Income Tax Act, 1961. Please retain this document for your income-tax records / ITR filing.',
      contentLeft,
      y,
      { width: contentWidth, align: 'justify' },
    );
    y = doc.y + 14;

    // 80G URN highlight box (legal anchor)
    doc.roundedRect(contentLeft, y, contentWidth, 44, 4).fill('#eff6ff');
    doc.strokeColor(navy).lineWidth(1).roundedRect(contentLeft, y, contentWidth, 44, 4).stroke();
    doc.fillColor(navy).font('Helvetica-Bold').fontSize(9);
    doc.text('80G APPROVAL / URN', contentLeft + 12, y + 8);
    doc.fillColor(ink).font('Helvetica-Bold').fontSize(11);
    doc.text(certificate.panNumber80G || 'Pending registration', contentLeft + 12, y + 22, {
      width: contentWidth - 24,
    });
    y += 56;

    // Formal two-column details (not orange receipt table)
    const fy = indianFinancialYear(new Date(donation.verifiedAt || donation.timestamp || Date.now()));
    const txnId = donation.paymentRef || donation.transactionId || '—';
    const leftCol: [string, string][] = [
      ['Donor Name', donation.fullName],
      ['PAN', donation.panNumber || '—'],
      ['Email', donation.email],
      ['Mobile', donation.phone || '—'],
      ['Address', donation.address || '—'],
    ];
    const rightCol: [string, string][] = [
      ['Receipt Number', donation.receiptNumber || '—'],
      ['Financial Year', fy],
      ['Date', formatCertDate(donation.verifiedAt || donation.timestamp)],
      ['Purpose', donation.causeTitle || '—'],
      [
        'Mode of Payment',
        PAYMENT_LABEL[donation.paymentMethod] || donation.paymentMethod || '—',
      ],
      ['Transaction Ref', txnId],
      ['Donation Type', donation.type || '—'],
    ];

    const boxTop = y;
    const colGap = 16;
    const colW = (contentWidth - colGap) / 2;
    const rowH = 18;
    const leftRows = leftCol.length;
    const rightRows = rightCol.length;
    const boxH = Math.max(leftRows, rightRows) * rowH + 36;

    doc.strokeColor('#cbd5e1').lineWidth(0.8).rect(contentLeft, boxTop, contentWidth, boxH).stroke();
    doc.fillColor(navy).font('Helvetica-Bold').fontSize(10);
    doc.text('Donor & Donation Particulars', contentLeft + 10, boxTop + 8);

    let ly = boxTop + 28;
    leftCol.forEach(([label, value]) => {
      doc.fillColor(muted).font('Helvetica-Bold').fontSize(7.5);
      doc.text(label, contentLeft + 10, ly, { width: 78 });
      doc.fillColor(ink).font('Helvetica').fontSize(8.5);
      doc.text(value, contentLeft + 90, ly, { width: colW - 100 });
      ly += rowH;
    });

    let ry = boxTop + 28;
    rightCol.forEach(([label, value]) => {
      const x = contentLeft + colW + colGap;
      doc.fillColor(muted).font('Helvetica-Bold').fontSize(7.5);
      doc.text(label, x + 6, ry, { width: 88 });
      doc.fillColor(ink).font('Helvetica').fontSize(8.5);
      doc.text(value, x + 96, ry, { width: colW - 106 });
      ry += rowH;
    });

    y = boxTop + boxH + 14;

    // Amount emphasis
    doc.fillColor(navy).font('Helvetica-Bold').fontSize(11);
    doc.text(
      `Donation Amount: ₹ ${donation.amount.toLocaleString('en-IN')}/-`,
      contentLeft,
      y,
      { width: contentWidth },
    );
    y = doc.y + 2;
    doc.fillColor(muted).font('Helvetica-Oblique').fontSize(9);
    doc.text(`(${amountInWordsInr(donation.amount)})`, contentLeft, y, { width: contentWidth });
    y = doc.y + 16;

    if (donation.fundRaiser || donation.issuedBy || donation.terminal) {
      doc.fillColor(muted).font('Helvetica').fontSize(8);
      if (donation.fundRaiser) {
        doc.text(`Collected / Raised by: ${donation.fundRaiser}`, contentLeft, y);
        y = doc.y + 2;
      }
      if (donation.issuedBy || donation.terminal) {
        doc.text(`Issued by: ${donation.issuedBy || donation.terminal}`, contentLeft, y);
        y = doc.y + 2;
      }
      y += 10;
    }

    // Signatory
    doc.fillColor(navy).font('Helvetica-Bold').fontSize(10);
    doc.text('Authorized Signatory', contentLeft, y);
    y = doc.y + 4;
    doc.fillColor(ink).font('Helvetica').fontSize(9);
    doc.text(`For ${certificate.ngoName}`, contentLeft, y);
    y = doc.y + 2;
    doc.fillColor(muted).font('Helvetica').fontSize(8);
    doc.text('Authorized Signatory', contentLeft, y);
    y = doc.y + 2;
    doc.fontSize(7.5);
    doc.text('(Computer-generated certificate; no physical stamp required.)', contentLeft, y);

    // Legal disclaimer near bottom of frame
    const disclaimerY = pageH - 88;
    doc.fillColor(muted).font('Helvetica').fontSize(7.5);
    doc.text(
      'This is a computer-generated 80G donation certificate issued after successful payment verification. Please retain for income-tax purposes. If the 80G number shows as pending, this document is not valid for ITR filing until the official 80G URN is printed on the certificate.',
      contentLeft,
      disclaimerY,
      { width: contentWidth, align: 'left' },
    );

    doc.fillColor('#94a3b8').font('Helvetica').fontSize(7);
    doc.text(
      `${certificate.phone}  ·  ${certificate.email}  ·  https://punyakart.com`,
      contentLeft,
      pageH - 58,
      { width: contentWidth, align: 'center' },
    );

    doc.end();
  });
}

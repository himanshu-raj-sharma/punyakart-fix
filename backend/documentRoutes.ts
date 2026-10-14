import type { Request, Response, RequestHandler } from 'express';
import type { DonationService } from './donationService.js';
import { withoutClientToken } from './donationService.js';
import type { CertificateDownloadService } from './certificateDownloadService.js';
import type { CertificateDetails, StoredDonation } from './types.js';
import { BusinessError } from './errors.js';
import { isCertificateEligible } from './db/certificateLookup.js';
import { timingSafeEqualText } from './security.js';
import { assertDocumentAccess, documentCredentials, requireDocumentCredentials, signDocumentGrant } from './documentAccess.js';

interface DocumentRouteDependencies {
  donations: Pick<DonationService, 'findById' | 'findForDocumentReference' | 'findForCertificateForm' | 'assertClientToken'>;
  certificateDownloads: Pick<CertificateDownloadService, 'recordSafe'>;
  receiptDownloads: Pick<CertificateDownloadService, 'recordSafe'>;
  getCertificateDetails: () => CertificateDetails;
  buildCertificatePdf: (donation: StoredDonation, details: CertificateDetails) => Promise<Buffer>;
  buildReceiptPdf: (donation: StoredDonation, details: CertificateDetails) => Promise<Buffer>;
  sendPdf: (res: Response, pdf: Buffer, filename: string) => void;
}

/** Injected boundaries allow exercising the real public handlers without DB/gateway/PDF setup. */
export function createDocumentHandlers(deps: DocumentRouteDependencies) {
  const { donations, certificateDownloads, receiptDownloads, getCertificateDetails } = deps;
  const handler = (run: (req: Request, res: Response) => Promise<void>): RequestHandler => async (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    try { await run(req, res); } catch (err) { next(err); }
  };
  const authorize = (req: Request, donation: StoredDonation | null): StoredDonation => {
    assertDocumentAccess(donation, documentCredentials(req), donations.assertClientToken.bind(donations));
    if (!isCertificateEligible(donation.status)) throw new BusinessError('Donation not found', 'NOT_FOUND');
    return donation;
  };
  const byId = async (req: Request) => {
    requireDocumentCredentials(documentCredentials(req));
    const id = typeof req.body?.donationId === 'string' ? req.body.donationId.trim() : '';
    const donation = authorize(req, id ? await donations.findById(id) : null);
    const receipt = typeof req.body?.receiptNumber === 'string' ? req.body.receiptNumber.trim() : '';
    if (receipt && !timingSafeEqualText(donation.receiptNumber || '', receipt)) {
      throw new BusinessError('Donation not found', 'NOT_FOUND');
    }
    return donation;
  };
  const result = (res: Response, donation: StoredDonation) => {
    res.json({ success: true, donation: withoutClientToken(donation), certificate: getCertificateDetails() });
  };

  return {
    certificate: handler(async (req, res) => {
      requireDocumentCredentials(documentCredentials(req));
      const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
      // Local exact lookup only: never invoke the gateway-import lookup on this route.
      const donation = authorize(req, await donations.findForDocumentReference(query));
      await certificateDownloads.recordSafe(donation, 'public');
      result(res, donation);
    }),
    verify: handler(async (req, res) => {
      // Preserve every existing donor-form check; never substitute an ID or account token.
      const verified = await donations.findForCertificateForm(req.body);
      const documentGrant = signDocumentGrant(verified.donation.id);
      await certificateDownloads.recordSafe(verified.donation, 'public');
      res.json({ success: true, donation: verified.donation, certificate: verified.certificate, documentGrant });
    }),
    receiptLookup: handler(async (req, res) => {
      requireDocumentCredentials(documentCredentials(req));
      const reference = req.body?.receiptNumber || req.body?.referenceId;
      const query = typeof reference === 'string' ? reference.trim() : '';
      const donation = authorize(req, await donations.findForDocumentReference(query, true));
      result(res, donation);
    }),
    certificateDownload: handler(async (req, res) => {
      const donation = await byId(req);
      await certificateDownloads.recordSafe(donation, 'public');
      res.json({ success: true });
    }),
    certificatePdf: handler(async (req, res) => {
      const donation = await byId(req);
      const pdf = await deps.buildCertificatePdf(donation, getCertificateDetails());
      if (req.body?.trackDownload !== false) await certificateDownloads.recordSafe(donation, 'public');
      deps.sendPdf(res, pdf, `${donation.receiptNumber || donation.id}-80G.pdf`);
    }),
    receiptPdf: handler(async (req, res) => {
      const donation = await byId(req);
      const pdf = await deps.buildReceiptPdf(donation, getCertificateDetails());
      if (req.body?.trackDownload !== false) await receiptDownloads.recordSafe(donation, 'receipt-public');
      deps.sendPdf(res, pdf, `${donation.receiptNumber || donation.id}-receipt.pdf`);
    }),
  };
}

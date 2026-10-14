/** Marks an authorized 80G view/print/download so admin can show Downloaded. */
export function trackCertificateDownload(donationId?: string, receiptNumber?: string): void {
  const id = donationId?.trim();
  if (!id) return;
  const receipt = receiptNumber?.trim();
  void fetch('/api/donations/certificate-download', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...documentCredentialHeaders() },
    body: JSON.stringify({
      donationId: id,
      ...(receipt ? { receiptNumber: receipt } : {}),
      ...documentCredentialBody(),
    }),
  }).catch(() => undefined);
}

export interface DocumentCredentialOptions {
  trackDownload?: boolean;
  clientToken?: string;
  documentGrant?: string;
  sessionToken?: string;
}

function documentCredentialBody(options: DocumentCredentialOptions = {}): Record<string, string> {
  return {
    ...(options.clientToken ? { clientToken: options.clientToken } : {}),
    ...(options.documentGrant ? { documentGrant: options.documentGrant } : {}),
  };
}

function documentCredentialHeaders(options: DocumentCredentialOptions = {}): Record<string, string> {
  const sessionToken = options.sessionToken || (typeof localStorage !== 'undefined' ? localStorage.getItem('punyakart_donor_token') || '' : '');
  return sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {};
}

async function fetchPdfBlob(
  url: string,
  donationId: string,
  receiptNumber: string | undefined,
  trackDownload: boolean,
  errorFallback: string,
  credentials: DocumentCredentialOptions = {},
): Promise<{ blob: Blob; filename?: string }> {
  const id = donationId.trim();
  if (!id) throw new Error('Missing donation id');

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...documentCredentialHeaders(credentials) },
    body: JSON.stringify({
      donationId: id,
      ...(receiptNumber?.trim() ? { receiptNumber: receiptNumber.trim() } : {}),
      trackDownload,
      ...documentCredentialBody(credentials),
    }),
  });

  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error || errorFallback);
  }

  const blob = await res.blob();
  const disposition = res.headers.get('Content-Disposition') || '';
  const match = disposition.match(/filename="([^"]+)"/);
  return { blob, filename: match?.[1] };
}

function triggerBlobDownload(blob: Blob, filename: string): void {
  const href = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = href;
  link.download = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(href);
}

/** Fetches the same official 80G PDF that is emailed (PDFKit). */
export async function fetchCertificatePdfBlob(
  donationId: string,
  receiptNumber?: string,
  options?: DocumentCredentialOptions,
): Promise<Blob> {
  const { blob } = await fetchPdfBlob(
    '/api/donations/certificate.pdf',
    donationId,
    receiptNumber,
    options?.trackDownload !== false,
    'Could not download the 80G PDF.',
    options,
  );
  return blob;
}

/** Downloads the official PDF and marks the certificate as downloaded. */
export async function downloadCertificatePdf(
  donationId: string,
  receiptNumber: string | undefined,
  fallbackName: string,
  options: DocumentCredentialOptions = {},
): Promise<void> {
  const { blob, filename } = await fetchPdfBlob(
    '/api/donations/certificate.pdf',
    donationId,
    receiptNumber,
    true,
    'Could not download the 80G PDF.',
    options,
  );
  triggerBlobDownload(blob, filename || fallbackName);
}

/** Fetches the branded donation receipt PDF (airport / crowd themed). */
export async function fetchDonationReceiptPdfBlob(
  donationId: string,
  receiptNumber?: string,
  options?: DocumentCredentialOptions,
): Promise<Blob> {
  const { blob } = await fetchPdfBlob(
    '/api/donations/receipt.pdf',
    donationId,
    receiptNumber,
    options?.trackDownload !== false,
    'Could not download the donation receipt PDF.',
    options,
  );
  return blob;
}

/** Downloads the branded donation receipt PDF. */
export async function downloadDonationReceiptPdf(
  donationId: string,
  receiptNumber: string | undefined,
  fallbackName: string,
  options: DocumentCredentialOptions = {},
): Promise<void> {
  const { blob, filename } = await fetchPdfBlob(
    '/api/donations/receipt.pdf',
    donationId,
    receiptNumber,
    true,
    'Could not download the donation receipt PDF.',
    options,
  );
  const resolved = filename || fallbackName;
  if (!/receipt/i.test(resolved)) {
    throw new Error('Server returned the wrong document. Please retry in 2-3 seconds.');
  }
  triggerBlobDownload(blob, resolved);
}

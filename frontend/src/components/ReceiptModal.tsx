import React, { useEffect, useState } from 'react';
import { X, CheckCircle2, Download, AlertCircle, Receipt } from 'lucide-react';
import { DonationSubmission, Language } from '../types';
import { translations } from '../data/content';
import {
  downloadCertificatePdf,
  downloadDonationReceiptPdf,
  fetchDonationReceiptPdfBlob,
} from '../certificateTrack';

interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: Language;
  submission: DonationSubmission | null;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  isOpen,
  onClose,
  language,
  submission,
}) => {
  const t = translations[language];
  const [pdfBusy, setPdfBusy] = useState<'80g' | 'receipt' | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfPreviewError, setPdfPreviewError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !submission?.id) {
      setPdfUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      setPdfPreviewError(null);
      setDownloadError(null);
      return;
    }

    let cancelled = false;
    setPdfPreviewError(null);
    void fetchDonationReceiptPdfBlob(submission.id, submission.receiptNumber, { trackDownload: false, clientToken: submission.clientToken })
      .then((blob) => {
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        setPdfUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return url;
        });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setPdfPreviewError(err instanceof Error ? err.message : 'Could not load PDF preview.');
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, submission?.id, submission?.receiptNumber]);

  if (!isOpen || !submission) return null;

  const handleDownload80G = async () => {
    if (!submission.id) {
      setDownloadError('Donation id missing. Please use the 80G portal with your receipt number.');
      return;
    }
    setPdfBusy('80g');
    setDownloadError(null);
    try {
      await downloadCertificatePdf(
        submission.id,
        submission.receiptNumber,
        `${submission.receiptNumber || submission.id}-80G.pdf`,
        { clientToken: submission.clientToken },
      );
    } catch (err: unknown) {
      setDownloadError(err instanceof Error ? err.message : 'Could not download the 80G PDF.');
    } finally {
      setPdfBusy(null);
    }
  };

  const handleDownloadReceipt = async () => {
    if (!submission.id) {
      setDownloadError('Donation id missing. Please use the portal with your receipt number.');
      return;
    }
    setPdfBusy('receipt');
    setDownloadError(null);
    try {
      await downloadDonationReceiptPdf(
        submission.id,
        submission.receiptNumber,
        `${submission.receiptNumber || submission.id}-receipt.pdf`,
        { clientToken: submission.clientToken },
      );
    } catch (err: unknown) {
      setDownloadError(err instanceof Error ? err.message : 'Could not download the donation receipt.');
    } finally {
      setPdfBusy(null);
    }
  };

  return (
    <div className="print-sheet fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-xl rounded-3xl bg-white dark:bg-slate-900 border border-neutral-200 dark:border-slate-800 shadow-2xl overflow-hidden my-auto">
        <div className="print-hide bg-[#002D62] text-white p-4 sm:p-5 flex items-center justify-between border-b border-blue-900">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-emerald-500 text-white shadow-md shadow-emerald-500/25">
              <CheckCircle2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase bg-emerald-500/30 text-emerald-300 border border-emerald-400/40 px-2.5 py-0.5 rounded-full">
                {t.receiptVerifiedBadge}
              </span>
              <h3 className="font-display font-black text-lg sm:text-xl tracking-tight mt-0.5">
                {t.receiptThankYou}
              </h3>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-4 max-h-[80vh] overflow-y-auto no-scrollbar">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 px-3.5 py-3">
            <p className="text-[10px] font-black uppercase tracking-wide text-neutral-500">
              {t.downloadDonationReceipt || 'Donation Receipt'}
            </p>
            <p className="text-sm font-black text-neutral-900 dark:text-white">
              {submission.fullName} · ₹{submission.amount.toLocaleString('en-IN')}
            </p>
            <p className="text-[11px] font-mono font-bold text-[#FF6B00]">{submission.receiptNumber}</p>
            <p className="text-[11px] text-neutral-500 mt-1">
              {t.receiptSameEmail}
            </p>
          </div>

          {pdfUrl ? (
            <iframe
              title="Donation Receipt"
              src={pdfUrl}
              className="w-full h-[min(60vh,560px)] rounded-2xl border border-slate-200 dark:border-slate-700 bg-white"
            />
          ) : (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 px-4 py-10 text-center text-xs text-neutral-600 dark:text-neutral-300">
              {pdfPreviewError || t.fetch80GPreviewLoading}
            </div>
          )}

          {downloadError && (
            <div className="print-hide p-3 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{downloadError}</span>
            </div>
          )}

          <div className="print-hide grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => void handleDownload80G()}
              disabled={pdfBusy !== null}
              className="w-full py-3 px-4 rounded-2xl bg-[#002D62] hover:bg-blue-900 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-blue-950/20 active:scale-98 cursor-pointer disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>{pdfBusy === '80g' ? t.receiptDownloading : (t.download80GShort || t.downloadReceipt)}</span>
            </button>
            <button
              type="button"
              onClick={() => void handleDownloadReceipt()}
              disabled={pdfBusy !== null}
              className="w-full py-3 px-4 rounded-2xl bg-[#FF6B00] hover:bg-[#E05300] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-orange-500/20 active:scale-98 cursor-pointer disabled:opacity-50"
            >
              <Receipt className="w-4 h-4" />
              <span>{pdfBusy === 'receipt' ? t.receiptDownloading : t.downloadDonationReceipt}</span>
            </button>
          </div>

          <p className="print-hide text-center text-[11px] text-neutral-500 dark:text-neutral-400">
            {t.receiptFooterNote}
          </p>
        </div>
      </div>
    </div>
  );
};

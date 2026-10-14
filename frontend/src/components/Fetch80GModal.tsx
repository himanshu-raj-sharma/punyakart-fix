import React, { useState, useEffect, useCallback } from 'react';
import { X, FileText, Share2, AlertCircle, Printer, Receipt, Download } from 'lucide-react';
import { Language, CertificateResult } from '../types';
import { NGO_DETAILS as NGO } from '../constants/ngo';
import {
  downloadCertificatePdf,
  downloadDonationReceiptPdf,
  fetchCertificatePdfBlob,
  fetchDonationReceiptPdfBlob,
} from '../certificateTrack';
import { translations } from '../data/content';

interface Fetch80GModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: Language;
  /** Prefill receipt / transaction ID from WhatsApp deep link (?q=…). */
  initialReferenceId?: string;
  /** Initial tab — WhatsApp opens 80G; user can switch to Receipt with same prefill. */
  mode?: '80g' | 'receipt';
}

const emptyForm = {
  fullName: '',
  email: '',
  phone: '',
  address: '',
  panNumber: '',
  referenceId: '',
  receiptNumber: '',
  transactionId: '',
};

const PAN_PATTERN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

export const Fetch80GModal: React.FC<Fetch80GModalProps> = ({
  isOpen,
  onClose,
  language,
  initialReferenceId = '',
  mode = '80g',
}) => {
  const t = translations[language];
  const [activeMode, setActiveMode] = useState<'80g' | 'receipt'>(mode);
  const [form, setForm] = useState({ ...emptyForm });
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [certificateData, setCertificateData] = useState<CertificateResult | null>(null);
  const [pdfBusy, setPdfBusy] = useState<'80g' | 'receipt' | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfPreviewError, setPdfPreviewError] = useState<string | null>(null);

  const focusReceipt = activeMode === 'receipt';
  const portalTitle = focusReceipt
    ? t.fetchReceiptTitle || t.fetch80GTitle
    : t.fetch80GTitle;
  const portalIntro = focusReceipt
    ? 'For your privacy, receipt lookup requires your donor login. If you are not logged in, use the 80G verification form with the same donor details first.'
    : t.fetch80GIntro;
  const submitLabel = focusReceipt
    ? 'Show My Donation'
    : t.fetch80GVerifyBtn;
  const previewLabel = focusReceipt ? 'Donation found' : 'Official 80G PDF';
  const previewNote = focusReceipt
    ? 'Download your donation receipt below.'
    : 'Same certificate that is emailed after payment — preview below.';

  const lookupReceiptByNumber = useCallback(async (receiptNumber: string) => {
    const q = receiptNumber.trim();
    if (q.length < 6) {
      setErrorMsg('Receipt number dalna required hai (e.g. PKF-2025-26-000123).');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setCertificateData(null);

    try {
      const res = await fetch('/api/donations/receipt/lookup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(typeof localStorage !== 'undefined' && localStorage.getItem('punyakart_donor_token')
            ? { Authorization: `Bearer ${localStorage.getItem('punyakart_donor_token')}` }
            : {}),
        },
        body: JSON.stringify({ receiptNumber: q }),
      });
      const text = await res.text();
      let data: CertificateResult & { error?: string };
      try {
        data = JSON.parse(text) as CertificateResult & { error?: string };
      } catch {
        throw new Error('Could not reach the receipt service. Please refresh and try again.');
      }
      if (!res.ok || !data.donation) {
        throw new Error(data.error || 'No donation found for this receipt number.');
      }
      setForm((prev) => ({
        ...prev,
        receiptNumber: data.donation.receiptNumber || q,
        referenceId: data.donation.receiptNumber || q,
      }));
       setCertificateData({ donation: data.donation, certificate: data.certificate, documentGrant: data.documentGrant });
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setForm({ ...emptyForm });
      setErrorMsg(null);
      setCertificateData(null);
      setLoading(false);
      setActiveMode(mode);
      setPdfPreviewError(null);
      setPdfUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      return;
    }

    setActiveMode(mode);
    const prefill = initialReferenceId.trim();
    if (prefill) {
      setForm((prev) => ({ ...prev, referenceId: prefill, receiptNumber: prefill }));
    }

    // Direct receipt deep-link (?receipt=1&q=…) → auto-show donation
    if (mode === 'receipt' && prefill.length >= 6) {
      void lookupReceiptByNumber(prefill);
    }
  }, [isOpen, initialReferenceId, mode, lookupReceiptByNumber]);

  useEffect(() => {
    if (!certificateData?.donation.id) {
      setPdfUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      setPdfPreviewError(null);
      return;
    }

    let cancelled = false;
    setPdfPreviewError(null);
    const previewFetcher = focusReceipt
      ? fetchDonationReceiptPdfBlob
      : fetchCertificatePdfBlob;
    void previewFetcher(certificateData.donation.id, certificateData.donation.receiptNumber, {
      trackDownload: false,
      clientToken: certificateData.donation.clientToken,
      documentGrant: certificateData.documentGrant,
    })
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
    }, [certificateData?.donation.id, certificateData?.donation.receiptNumber, certificateData?.documentGrant, focusReceipt]);

  if (!isOpen) return null;

  const setField = (key: keyof typeof emptyForm, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const resolvePrefillReceipt = () =>
    (
      form.receiptNumber ||
      form.referenceId ||
      initialReferenceId ||
      certificateData?.donation.receiptNumber ||
      ''
    ).trim();

  /** From 80G (WhatsApp) form → receipt view with same receipt no + auto data load. */
  const openReceiptFromPrefill = () => {
    const receipt = resolvePrefillReceipt();
    setActiveMode('receipt');
    setCertificateData(null);
    setErrorMsg(null);
    if (receipt) {
      setForm((prev) => ({ ...prev, receiptNumber: receipt, referenceId: receipt }));
      void lookupReceiptByNumber(receipt);
    }
  };

  const open80GForm = () => {
    const receipt = resolvePrefillReceipt();
    setActiveMode('80g');
    setCertificateData(null);
    setErrorMsg(null);
    if (receipt) {
      setForm((prev) => ({ ...prev, receiptNumber: receipt, referenceId: receipt }));
    }
  };

  const validateClient = (): string | null => {
    if (focusReceipt) {
      if (form.receiptNumber.trim().length < 6) {
        return 'Receipt number dalna required hai (e.g. PKF-2025-26-000123).';
      }
      return null;
    }
    if (form.fullName.trim().length < 2) return t.fetch80GNameError;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return t.fetch80GEmailError;
    const phone = form.phone.replace(/\D/g, '').slice(-10);
    if (!/^[6-9]\d{9}$/.test(phone)) return t.fetch80GPhoneError;
    if (form.address.trim().length < 5) return t.fetch80GAddressError;
    const pan = form.panNumber.trim().toUpperCase();
    if (!PAN_PATTERN.test(pan)) return t.fetch80GPanError;
    if (form.referenceId.trim().length < 6) {
      return t.fetch80GRefError;
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clientError = validateClient();
    if (clientError) {
      setErrorMsg(clientError);
      return;
    }

    if (focusReceipt) {
      await lookupReceiptByNumber(form.receiptNumber.trim());
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setCertificateData(null);

    try {
      const res = await fetch('/api/donations/certificate/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: form.fullName.trim(),
          email: form.email.trim(),
          phone: form.phone.replace(/\D/g, '').slice(-10),
          address: form.address.trim(),
          panNumber: form.panNumber.trim().toUpperCase(),
          referenceId: form.referenceId.trim(),
        }),
      });
      const text = await res.text();
      let data: CertificateResult & { error?: string; success?: boolean };
      try {
        data = JSON.parse(text) as CertificateResult & { error?: string; success?: boolean };
      } catch {
        throw new Error('Could not reach the 80G certificate service. Please refresh and try again.');
      }

      if (!res.ok || !data.donation) {
        throw new Error(data.error || 'Details did not match any verified donation.');
      }

       setCertificateData({ donation: data.donation, certificate: data.certificate, documentGrant: data.documentGrant });
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    if (pdfUrl) {
      const win = window.open(pdfUrl, '_blank', 'noopener,noreferrer');
      if (win) {
        win.addEventListener('load', () => {
          try {
            win.print();
          } catch {
            // browser may block auto-print
          }
        });
      }
      return;
    }
    window.print();
  };

  const handleDownloadPdf = async () => {
    if (!certificateData?.donation.id) return;
    setPdfBusy('80g');
    setErrorMsg(null);
    try {
      await downloadCertificatePdf(
        certificateData.donation.id,
        certificateData.donation.receiptNumber,
        `${certificateData.donation.receiptNumber || certificateData.donation.id}-80G.pdf`,
        { clientToken: certificateData.donation.clientToken, documentGrant: certificateData.documentGrant },
      );
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not download the 80G PDF.');
    } finally {
      setPdfBusy(null);
    }
  };

  const handleDownloadReceipt = async () => {
    if (!certificateData?.donation.id) return;
    setPdfBusy('receipt');
    setErrorMsg(null);
    try {
      await downloadDonationReceiptPdf(
        certificateData.donation.id,
        certificateData.donation.receiptNumber,
        `${certificateData.donation.receiptNumber || certificateData.donation.id}-receipt.pdf`,
        { clientToken: certificateData.donation.clientToken, documentGrant: certificateData.documentGrant },
      );
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not download the donation receipt.');
    } finally {
      setPdfBusy(null);
    }
  };

  const handleShareWhatsApp = () => {
    if (!certificateData) return;
    const d = certificateData.donation;
    const text = encodeURIComponent(
      `🐾 Official 80G Tax Exemption Certificate - ${NGO.name}\n\n` +
        `Donor: ${d.fullName}\n` +
        `Amount: ₹${d.amount}\n` +
        `Receipt No: ${d.receiptNumber}\n` +
        `Transaction ID: ${d.transactionId || 'N/A'}\n` +
        `80G Approval: ${NGO.panNumber80G} (50% Tax Deduction)\n` +
        `Thank you for protecting injured and sheltered animals!`,
    );
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank', 'noopener,noreferrer');
  };

  const inputClass =
    'w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-neutral-900 dark:text-white text-xs sm:text-sm font-semibold focus:border-[#FF6B00] outline-none';

  return (
    <div
      className="print-sheet fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-xs overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl rounded-3xl bg-white dark:bg-slate-900 border border-neutral-200 dark:border-slate-800 shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="print-hide bg-[#002D62] text-white p-4 sm:p-5 flex items-center justify-between border-b border-blue-900">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-[#FF6B00] text-white shadow-md">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase bg-emerald-500/30 text-emerald-300 border border-emerald-400/40 px-2.5 py-0.5 rounded-full">
                {focusReceipt ? (t.navDonationReceipt || 'Receipt') : '80G'}
              </span>
              <h3 className="font-display font-black text-lg sm:text-xl tracking-tight mt-0.5">
                {portalTitle}
              </h3>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode switch — WhatsApp opens 80G; one tap jumps to receipt with same PKF prefill */}
        <div className="print-hide px-4 sm:px-6 pt-4">
          <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={open80GForm}
              disabled={loading}
              className={`py-2.5 px-3 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer disabled:opacity-50 ${
                !focusReceipt
                  ? 'bg-[#FF6B00] text-white shadow-sm'
                  : 'text-neutral-600 dark:text-neutral-300 hover:bg-white/70 dark:hover:bg-slate-700'
              }`}
            >
              80G Certificate
            </button>
            <button
              type="button"
              id="btn-switch-download-receipt"
              onClick={openReceiptFromPrefill}
              disabled={loading}
              className={`py-2.5 px-3 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5 ${
                focusReceipt
                  ? 'bg-[#FF6B00] text-white shadow-sm'
                  : 'text-neutral-600 dark:text-neutral-300 hover:bg-white/70 dark:hover:bg-slate-700'
              }`}
            >
              <Receipt className="w-3.5 h-3.5" />
              Download Receipt
            </button>
          </div>
          {!focusReceipt && resolvePrefillReceipt() && (
            <p className="text-[10px] text-neutral-500 dark:text-neutral-400 mt-2 leading-relaxed">
              Receipt No. <span className="font-mono font-bold text-[#FF6B00]">{resolvePrefillReceipt()}</span> already
              filled from WhatsApp — tap <span className="font-bold">Download Receipt</span> to open it instantly.
            </p>
          )}
        </div>

        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto">
          {!certificateData && (
            <form onSubmit={(e) => void handleSubmit(e)} className="print-hide space-y-3">
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400 leading-relaxed">
                {portalIntro}
              </p>

              {focusReceipt ? (
                <div>
                  <label htmlFor="receipt-number" className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                    Receipt No. <span className="text-[#FF6B00]">*</span>
                  </label>
                  <input
                    id="receipt-number"
                    type="text"
                    value={form.receiptNumber}
                    onChange={(e) => setField('receiptNumber', e.target.value)}
                    placeholder="PKF-2025-26-000123"
                    className={inputClass}
                    autoComplete="off"
                    required
                    autoFocus
                  />
                  <p className="text-[10px] text-neutral-500 mt-1.5">
                    WhatsApp / email thank-you message me diya hua PKF receipt number use karein.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label htmlFor="80g-reference" className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                      {t.fetch80GReference} <span className="text-[#FF6B00]">*</span>
                    </label>
                    <input
                      id="80g-reference"
                      type="text"
                      value={form.referenceId}
                      onChange={(e) => {
                        setField('referenceId', e.target.value);
                        setField('receiptNumber', e.target.value);
                      }}
                      placeholder="PKF-2026-893241 or TXN…"
                      className={inputClass}
                      autoComplete="off"
                      required
                    />
                  </div>

                  <div>
                    <label htmlFor="80g-name" className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                      {t.donorNameLabel} <span className="text-[#FF6B00]">*</span>
                    </label>
                    <input
                      id="80g-name"
                      type="text"
                      value={form.fullName}
                      onChange={(e) => setField('fullName', e.target.value)}
                      className={inputClass}
                      autoComplete="name"
                      required
                    />
                  </div>

                  <div>
                    <label htmlFor="80g-email" className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                      {t.emailLabel} <span className="text-[#FF6B00]">*</span>
                    </label>
                    <input
                      id="80g-email"
                      type="email"
                      value={form.email}
                      onChange={(e) => setField('email', e.target.value)}
                      className={inputClass}
                      autoComplete="email"
                      required
                    />
                  </div>

                  <div>
                    <label htmlFor="80g-phone" className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                      {t.mobileNumberLabel} <span className="text-[#FF6B00]">*</span>
                    </label>
                    <input
                      id="80g-phone"
                      type="tel"
                      value={form.phone}
                      onChange={(e) => setField('phone', e.target.value)}
                      className={inputClass}
                      autoComplete="tel"
                      required
                    />
                  </div>

                  <div>
                    <label htmlFor="80g-pan" className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                      {t.panLabel.replace('(optional)', '').trim()} <span className="text-[#FF6B00]">*</span>
                    </label>
                    <input
                      id="80g-pan"
                      type="text"
                      value={form.panNumber}
                      onChange={(e) => setField('panNumber', e.target.value.toUpperCase())}
                      placeholder="ABCDE1234F"
                      className={`${inputClass} uppercase tracking-wider`}
                      maxLength={10}
                      autoComplete="off"
                      required
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label htmlFor="80g-address" className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                      {t.addressLabel} <span className="text-[#FF6B00]">*</span>
                    </label>
                    <textarea
                      id="80g-address"
                      value={form.address}
                      onChange={(e) => setField('address', e.target.value)}
                      className={`${inputClass} min-h-[72px] resize-y`}
                      rows={3}
                      required
                    />
                  </div>
                </div>
              )}

              <button
                type="submit"
                id="btn-fetch-80g"
                disabled={loading}
                className="w-full py-3 px-5 rounded-xl bg-[#FF6B00] hover:bg-[#E05300] text-white font-bold text-sm shadow-md shadow-orange-500/20 active:scale-98 transition-all cursor-pointer disabled:opacity-50"
              >
                {loading ? t.fetch80GSearching : submitLabel}
              </button>

              {errorMsg && (
                <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800/60 text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}
            </form>
          )}

          {certificateData && (
            <div className="mt-1 space-y-3">
              <div className="print-hide flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 px-3.5 py-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-wide text-neutral-500">{previewLabel}</p>
                  <p className="text-sm font-black text-neutral-900 dark:text-white truncate">
                    {certificateData.donation.fullName} · ₹
                    {certificateData.donation.amount.toLocaleString('en-IN')}
                  </p>
                  <p className="text-[11px] font-mono font-bold text-[#FF6B00]">
                    {certificateData.donation.receiptNumber}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setCertificateData(null);
                    setErrorMsg(null);
                  }}
                  className="text-[11px] font-bold text-[#002D62] dark:text-blue-300 underline cursor-pointer shrink-0"
                >
                  {t.fetch80GSearchAgain}
                </button>
              </div>

              {focusReceipt && (
                <div className="print-hide rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 space-y-2 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
                    <div>
                      <p className="text-[10px] font-bold uppercase text-neutral-400">Donor</p>
                      <p className="font-bold text-neutral-900 dark:text-white">{certificateData.donation.fullName}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase text-neutral-400">Amount</p>
                      <p className="font-bold text-neutral-900 dark:text-white">
                        ₹{certificateData.donation.amount.toLocaleString('en-IN')}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase text-neutral-400">Date</p>
                      <p className="font-semibold text-neutral-800 dark:text-neutral-200">
                        {new Date(
                          certificateData.donation.verifiedAt || certificateData.donation.timestamp,
                        ).toLocaleString('en-IN')}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase text-neutral-400">Cause</p>
                      <p className="font-semibold text-neutral-800 dark:text-neutral-200">
                        {certificateData.donation.causeTitle || '—'}
                      </p>
                    </div>
                    <div className="sm:col-span-2">
                      <p className="text-[10px] font-bold uppercase text-neutral-400">Transaction ID</p>
                      <p className="font-mono font-semibold text-neutral-700 dark:text-neutral-300 break-all">
                        {certificateData.donation.paymentRef ||
                          certificateData.donation.transactionId ||
                          '—'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <p className="print-hide text-[11px] text-neutral-500 dark:text-neutral-400">
                {previewNote}
              </p>

              {pdfUrl ? (
                <iframe
                  title={focusReceipt ? 'Donation Receipt' : '80G Tax Exemption Certificate'}
                  src={pdfUrl}
                  className="w-full h-[min(70vh,640px)] rounded-2xl border border-slate-200 dark:border-slate-700 bg-white"
                />
              ) : (
                <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 px-4 py-10 text-center text-xs text-neutral-600 dark:text-neutral-300">
                  {pdfPreviewError || t.fetch80GPreviewLoading}
                </div>
              )}

              {focusReceipt ? (
                <div className="print-hide flex flex-col gap-2 pt-1">
                  <button
                    type="button"
                    id="btn-download-donation-receipt"
                    onClick={() => void handleDownloadReceipt()}
                    disabled={pdfBusy !== null}
                    className="w-full py-3.5 px-4 rounded-xl bg-[#FF6B00] hover:bg-[#E05300] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md shadow-orange-500/20 cursor-pointer disabled:opacity-50"
                  >
                    <Receipt className="w-4 h-4" />
                    <span>
                      {pdfBusy === 'receipt' ? t.fetch80GDownloading : 'Download Donation Receipt'}
                    </span>
                  </button>
                  <button
                    type="button"
                    id="btn-print-receipt"
                    onClick={handlePrint}
                    className="w-full py-2.5 px-4 rounded-xl bg-slate-700 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Printer className="w-4 h-4" />
                    <span>{t.fetch80GPrint}</span>
                  </button>
                </div>
              ) : (
                <div className="print-hide grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    id="btn-download-80g-pdf"
                    onClick={() => void handleDownloadPdf()}
                    disabled={pdfBusy !== null}
                    className="py-2.5 px-4 rounded-xl bg-[#FF6B00] hover:bg-[#E05300] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm cursor-pointer disabled:opacity-50"
                  >
                    <Download className="w-4 h-4" />
                    <span>{pdfBusy === '80g' ? t.fetch80GDownloading : (t.fetch80GDownload || t.download80GShort)}</span>
                  </button>

                  <button
                    type="button"
                    id="btn-download-donation-receipt"
                    onClick={() => void handleDownloadReceipt()}
                    disabled={pdfBusy !== null}
                    className="py-2.5 px-4 rounded-xl bg-[#002D62] hover:bg-blue-900 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm cursor-pointer disabled:opacity-50"
                  >
                    <Receipt className="w-4 h-4" />
                    <span>
                      {pdfBusy === 'receipt'
                        ? t.fetch80GDownloading
                        : t.fetchDonationReceiptDownload || t.downloadDonationReceipt}
                    </span>
                  </button>

                  <button
                    type="button"
                    id="btn-share-whatsapp-80g"
                    onClick={handleShareWhatsApp}
                    className="py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                  >
                    <Share2 className="w-4 h-4" />
                    <span>{t.fetch80GWhatsApp}</span>
                  </button>

                  <button
                    type="button"
                    id="btn-print-80g"
                    onClick={handlePrint}
                    className="py-2.5 px-4 rounded-xl bg-slate-700 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                  >
                    <Printer className="w-4 h-4" />
                    <span>{t.fetch80GPrint}</span>
                  </button>
                </div>
              )}
              {errorMsg && (
                <div className="print-hide p-3 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800/60 text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

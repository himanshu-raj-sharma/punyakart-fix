import React, { useState } from 'react';
import { ArrowRight, CheckCircle2, Download, HeartHandshake, ReceiptText, ShieldCheck } from 'lucide-react';
import type { DonationSubmission, Language } from '../types';
import { downloadCertificatePdf, downloadDonationReceiptPdf } from '../certificateTrack';
import { navigate } from '../navigation';

interface ThankYouPageProps {
  language: Language;
  submission: DonationSubmission | null;
}

export const ThankYouPage: React.FC<ThankYouPageProps> = ({ submission }) => {
  const [busy, setBusy] = useState<'receipt' | '80g' | null>(null);
  const [error, setError] = useState('');

  if (!submission) {
    return (
      <section className="public-page mx-auto flex min-h-[60vh] max-w-3xl items-center justify-center px-4 py-10">
        <div className="public-card w-full rounded-[2rem] border p-8 text-center shadow-[0_20px_60px_rgba(0,45,98,0.08)]">
          <ReceiptText className="mx-auto h-12 w-12 text-[#FF6B00]" />
          <h1 className="mt-4 font-display text-3xl font-black text-[#002D62]">Donation details not found</h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-slate-600">
            This thank-you link has expired on this device. You can retrieve a receipt using the receipt portal.
          </p>
          <button type="button" onClick={() => navigate('/')} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#002D62] px-5 py-3 text-sm font-black text-white">
            Return to Punyakart <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </section>
    );
  }

  const download = async (kind: 'receipt' | '80g') => {
    setBusy(kind);
    setError('');
    try {
      if (kind === 'receipt') {
         await downloadDonationReceiptPdf(submission.id, submission.receiptNumber, `${submission.receiptNumber || submission.id}-receipt.pdf`, { clientToken: submission.clientToken });
      } else {
         await downloadCertificatePdf(submission.id, submission.receiptNumber, `${submission.receiptNumber || submission.id}-80G.pdf`, { clientToken: submission.clientToken });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not download the document. Please try again.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="public-page relative overflow-hidden px-4 py-6 sm:px-6 sm:py-10">
      <div className="pointer-events-none absolute left-1/2 top-0 h-80 w-[42rem] -translate-x-1/2 rounded-full bg-orange-100/70 blur-3xl" />
      <div className="relative mx-auto max-w-4xl">
        <div className="public-card overflow-hidden rounded-[2rem] border shadow-[0_24px_70px_rgba(0,45,98,0.12)]">
          <div className="bg-[#002D62] px-5 py-10 text-center text-white sm:px-12">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-400 text-[#002D62] shadow-lg shadow-emerald-950/20">
              <CheckCircle2 className="h-9 w-9" strokeWidth={2.5} />
            </div>
            <p className="mt-5 text-[11px] font-black uppercase tracking-[0.2em] text-emerald-200">Donation received successfully</p>
            <h1 className="mt-2 font-display text-3xl font-black tracking-tight sm:text-5xl">Thank you, {submission.fullName.split(' ')[0]}.</h1>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-blue-100 sm:text-base">
              Your contribution of <strong className="text-white">₹{submission.amount.toLocaleString('en-IN')}</strong> is now part of Punyakart Foundation&apos;s seva for {submission.causeTitle}.
            </p>
          </div>

          <div className="space-y-7 p-5 sm:p-10">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl public-muted-surface p-4">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Amount donated</p>
                <p className="mt-1 text-xl font-black text-[#002D62]">₹{submission.amount.toLocaleString('en-IN')}</p>
              </div>
              <div className="rounded-2xl public-muted-surface p-4">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Receipt number</p>
                <p className="mt-1 break-all font-mono text-sm font-black text-[#FF6B00]">{submission.receiptNumber || 'Generating…'}</p>
              </div>
              <div className="rounded-2xl public-muted-surface p-4">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Payment status</p>
                <p className="mt-1 text-xl font-black text-emerald-600">Verified</p>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="rounded-3xl border border-orange-100 bg-gradient-to-br from-orange-50 to-amber-50 p-6">
                <HeartHandshake className="h-8 w-8 text-[#FF6B00]" />
                <h2 className="mt-4 font-display text-2xl font-black text-[#002D62]">Your kindness creates real impact.</h2>
                <p className="mt-3 text-sm leading-7 text-slate-700">
                  Every verified gift helps fund compassionate care, emergency support, and dignified seva for animals and communities connected to our work.
                </p>
              </div>
              <div className="public-card rounded-3xl border p-6">
                <h2 className="font-display text-xl font-black text-[#002D62]">Keep your donation record</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">Download the official receipt now. If you requested 80G, the certificate is available here too.</p>
                <div className="mt-5 space-y-2">
                  <button type="button" onClick={() => void download('receipt')} disabled={busy !== null} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#FF6B00] px-4 py-3 text-sm font-black text-white transition hover:bg-[#E05300] disabled:opacity-50">
                    <Download className="h-4 w-4" /> {busy === 'receipt' ? 'Preparing receipt…' : 'Download donation receipt'}
                  </button>
                  {submission.want80G && (
                    <button type="button" onClick={() => void download('80g')} disabled={busy !== null} className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#002D62] px-4 py-3 text-sm font-black text-[#002D62] transition hover:bg-blue-50 disabled:opacity-50">
                      <ShieldCheck className="h-4 w-4" /> {busy === '80g' ? 'Preparing 80G…' : 'Download 80G certificate'}
                    </button>
                  )}
                </div>
                {error && <p className="mt-3 text-xs font-semibold text-red-600">{error}</p>}
              </div>
            </div>

            <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-200 pt-6 sm:flex-row">
              <p className="text-center text-xs leading-5 text-slate-500 sm:text-left">Keep your receipt number with your donor login or verification details for secure future document access.</p>
              <button type="button" onClick={() => navigate('/')} className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-[#002D62] px-4 py-3 text-xs font-black text-white hover:bg-blue-900">
                Continue to website <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

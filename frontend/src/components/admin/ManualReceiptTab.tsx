import React, { useState } from 'react';
import { AlertCircle, FilePlus2, Receipt } from 'lucide-react';
import { downloadAdminPdf } from '../../admin/adminApi';
import { DONATION_AMOUNT_ERROR, MAX_DONATION_AMOUNT, MIN_DONATION_AMOUNT, parseDonationAmount } from '../../constants/donation';

interface ManualReceiptTabProps {
  adminKey: string;
  onCreated: () => void;
}

const PAYMENT_MODES = [
  { id: 'cash', label: 'Cash' },
  { id: 'upi', label: 'UPI' },
  { id: 'bank_transfer', label: 'Bank Transfer' },
  { id: 'cheque', label: 'Cheque' },
  { id: 'card', label: 'Card' },
  { id: 'other', label: 'Other' },
] as const;

const emptyForm = {
  fullName: '',
  phone: '',
  email: '',
  address: '',
  panNumber: '',
  amount: '',
  causeTitle: 'General Donation',
  paymentMethod: '' as string,
  issuedBy: '',
  fundRaiser: '',
  transactionId: '',
  donationDate: new Date().toISOString().slice(0, 10),
};

export const ManualReceiptTab: React.FC<ManualReceiptTabProps> = ({ adminKey, onCreated }) => {
  const [form, setForm] = useState(emptyForm);
  const [confirm, setConfirm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const setField = (key: keyof typeof emptyForm, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseDonationAmount(form.amount);
    if (amount === null) {
      setErrorMsg(DONATION_AMOUNT_ERROR);
      return;
    }
    if (!confirm) {
      setErrorMsg('Confirm that this is a real offline donation before creating the receipt.');
      return;
    }
    if (!form.paymentMethod) {
      setErrorMsg('Select mode of payment.');
      return;
    }
    if (!form.issuedBy.trim()) {
      setErrorMsg('Enter who is creating this receipt (staff name).');
      return;
    }

    setCreating(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await downloadAdminPdf(
        '/api/admin/certificates/create',
        adminKey,
        'donation-receipt.pdf',
        {
          method: 'POST',
          body: JSON.stringify({
            fullName: form.fullName.trim(),
            phone: form.phone.trim(),
            email: form.email.trim(),
            address: form.address.trim(),
            panNumber: form.panNumber.trim().toUpperCase(),
            amount,
            causeTitle: form.causeTitle.trim() || 'General Donation',
            paymentMethod: form.paymentMethod,
            issuedBy: form.issuedBy.trim(),
            fundRaiser: form.fundRaiser.trim(),
            transactionId: form.transactionId.trim(),
            donationDate: form.donationDate
              ? new Date(`${form.donationDate}T12:00:00`).toISOString()
              : undefined,
            type: 'one-time',
            want80G: true,
            confirmManualIssue: true,
          }),
        },
      );
      setSuccessMsg(`Receipt created for ${form.fullName.trim()}. Donation receipt PDF downloaded.`);
      setForm({ ...emptyForm, donationDate: new Date().toISOString().slice(0, 10) });
      setConfirm(false);
      onCreated();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not create receipt.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <div className="p-2.5 rounded-2xl bg-orange-50 text-[#FF6B00] border border-orange-200">
          <Receipt className="w-5 h-5" />
        </div>
        <div>
          <h3 className="font-display font-black text-lg text-neutral-900 dark:text-white">
            Create manual receipt
          </h3>
          <p className="text-xs text-neutral-500 mt-0.5 max-w-2xl">
            For cash / UPI / bank / cheque donations received offline. A verified receipt number is generated and the
            branded donation receipt PDF downloads immediately. Use Manual 80G to download the tax certificate for the
            same donation.
          </p>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}
      {successMsg && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 font-semibold">
          {successMsg}
        </div>
      )}

      <form
        onSubmit={handleCreate}
        className="p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 space-y-4"
      >
        <div>
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2">Donor details</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300">
              Donor name *
              <input
                required
                minLength={2}
                value={form.fullName}
                onChange={(e) => setField('fullName', e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-semibold"
              />
            </label>
            <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300">
              Mobile number *
              <input
                required
                value={form.phone}
                onChange={(e) => setField('phone', e.target.value)}
                placeholder="10-digit mobile"
                className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-semibold"
              />
            </label>
            <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300">
              Email *
              <input
                required
                type="email"
                value={form.email}
                onChange={(e) => setField('email', e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-semibold"
              />
            </label>
            <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300">
              PAN (optional, needed for 80G claim)
              <input
                value={form.panNumber}
                onChange={(e) => setField('panNumber', e.target.value.toUpperCase())}
                placeholder="ABCDE1234F"
                className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-semibold"
              />
            </label>
            <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300 sm:col-span-2">
              Address *
              <input
                required
                minLength={5}
                value={form.address}
                onChange={(e) => setField('address', e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-semibold"
              />
            </label>
          </div>
        </div>

        <div>
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2">Donation details</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300">
              Amount (₹) *
              <input
                required
                type="number"
                min={MIN_DONATION_AMOUNT}
                max={MAX_DONATION_AMOUNT}
                step="1"
                value={form.amount}
                onChange={(e) => setField('amount', e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-semibold"
              />
            </label>
            <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300">
              Donation date *
              <input
                required
                type="date"
                value={form.donationDate}
                onChange={(e) => setField('donationDate', e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-semibold"
              />
            </label>
            <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300 sm:col-span-2">
              Mode of payment *
              <select
                required
                value={form.paymentMethod}
                onChange={(e) => setField('paymentMethod', e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-semibold"
              >
                <option value="">Select mode</option>
                {PAYMENT_MODES.map((mode) => (
                  <option key={mode.id} value={mode.id}>
                    {mode.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300 sm:col-span-2">
              Cause / purpose *
              <input
                required
                value={form.causeTitle}
                onChange={(e) => setField('causeTitle', e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-semibold"
              />
            </label>
            <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300">
              UPI / Cheque / Bank ref (optional)
              <input
                value={form.transactionId}
                onChange={(e) => setField('transactionId', e.target.value)}
                placeholder="UPI ref / cheque no / NEFT UTR"
                className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-semibold"
              />
            </label>
          </div>
        </div>

        <div>
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2">Staff details</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300">
              Receipt created by (staff) *
              <input
                required
                minLength={2}
                value={form.issuedBy}
                onChange={(e) => setField('issuedBy', e.target.value)}
                placeholder="Staff name who is issuing this receipt"
                className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-semibold"
              />
            </label>
            <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300">
              Collected / raised by (optional)
              <input
                value={form.fundRaiser}
                onChange={(e) => setField('fundRaiser', e.target.value)}
                placeholder="Volunteer / fund raiser name"
                className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-semibold"
              />
            </label>
          </div>
        </div>

        <label className="flex items-start gap-2 text-xs text-neutral-600 dark:text-neutral-400">
          <input
            type="checkbox"
            checked={confirm}
            onChange={(e) => setConfirm(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            I confirm this offline payment was received, the details above are correct, and I am authorised to issue
            this receipt / 80G certificate.
          </span>
        </label>

        <button
          type="submit"
          disabled={creating || !confirm}
          className="inline-flex items-center gap-2 py-2.5 px-5 rounded-xl bg-[#002D62] hover:bg-blue-900 text-white font-bold text-sm cursor-pointer disabled:opacity-50"
        >
          <FilePlus2 className="w-4 h-4" />
          {creating ? 'Creating…' : 'Create & download donation receipt'}
        </button>
      </form>
    </div>
  );
};

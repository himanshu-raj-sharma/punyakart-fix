import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { TaxReceiptData } from '../../types/campaign';
import { CAMPAIGN_ASSETS } from '../../data/campaigns';
import { X, Printer, Download, CheckCircle2, ShieldCheck, Heart } from 'lucide-react';

interface TaxReceiptModalProps {
  receipt: TaxReceiptData | null;
  onClose: () => void;
}

export const TaxReceiptModal: React.FC<TaxReceiptModalProps> = ({ receipt, onClose }) => {
  const handlePrint = () => {
    window.print();
  };

  return (
    <AnimatePresence>
      {receipt && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 15 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 15 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className="relative max-w-2xl w-full bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-4 sm:my-6 max-h-[95vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Top Bar */}
            <div className="bg-[#0F2942] text-white px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between print:hidden flex-shrink-0">
              <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400 flex-shrink-0" />
                <span className="font-display font-bold text-xs sm:text-base truncate">
                  Donation Successful • 80G Certificate
                </span>
              </div>

              <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  type="button"
                  onClick={handlePrint}
                  className="inline-flex items-center gap-1 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold px-2.5 sm:px-3 py-1.5 rounded-lg transition-colors cursor-pointer min-h-[36px]"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Print / PDF</span>
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  type="button"
                  onClick={onClose}
                  className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </motion.button>
              </div>
            </div>

        {/* Printable Official Certificate Body */}
        <div className="p-3 sm:p-8 bg-[#FDFBF7] print:p-0 print:bg-white text-slate-800 text-sm overflow-y-auto">
          
          {/* Certificate Border Frame */}
          <div className="border-2 sm:border-4 border-double border-amber-800/30 rounded-xl p-3.5 sm:p-8 bg-white relative">
            
            {/* Header / Seal */}
            <div className="flex items-start justify-between border-b border-amber-900/20 pb-5">
              <div className="flex items-center gap-3">
                <img
                  src={CAMPAIGN_ASSETS.logo}
                  alt="Punyakart Foundation Seal"
                  className="w-14 h-14 object-cover rounded-full border border-amber-300 p-0.5"
                  referrerPolicy="no-referrer"
                />
                <div>
                  <h2 className="font-display font-extrabold text-xl text-[#0F2942] tracking-tight">
                    PUNYAKART FOUNDATION
                  </h2>
                  <p className="text-xs text-slate-600 font-medium">
                    (Section 8 Company under Indian Companies Act 2013)
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Reg Office: Rishikesh-Dehradun Highway, Uttarakhand - 249201
                  </p>
                </div>
              </div>

              <div className="text-right">
                <span className="inline-block bg-emerald-50 text-emerald-800 border border-emerald-300 text-[10px] font-black uppercase px-2 py-0.5 rounded">
                  Form 10BE Compliant
                </span>
                <p className="text-xs text-slate-500 font-mono mt-1 font-semibold">
                  Receipt: {receipt.receiptNumber}
                </p>
                <p className="text-xs text-slate-500">
                  Date: {receipt.paymentDate}
                </p>
              </div>
            </div>

            {/* Title */}
            <div className="text-center my-5">
              <h3 className="font-display font-extrabold text-lg text-[#9F3D00] uppercase tracking-wider underline underline-offset-4">
                Certificate of Donation under Section 80G
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Income Tax Exemption Order No: <strong className="font-mono text-slate-800">AADTP2149NF20214</strong>
              </p>
            </div>

            {/* Donor & Contribution Details Grid */}
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 mb-5 text-xs sm:text-sm space-y-2.5">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-slate-400 block text-xs">Donor Name:</span>
                  <strong className="text-slate-900 font-semibold">{receipt.donorName}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-xs">Donor PAN:</span>
                  <strong className="text-slate-900 font-mono">{receipt.panNumber || 'NOT PROVIDED'}</strong>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-slate-400 block text-xs">Email / Mobile:</span>
                  <span className="text-slate-700">{receipt.email || receipt.phone}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-xs">Payment Reference:</span>
                  <span className="text-slate-700 font-mono">{receipt.transactionRef}</span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-slate-400 block text-xs">Payment Mode:</span>
                  <span className="text-slate-800 font-medium capitalize">{receipt.paymentMode}</span>
                </div>
                <div className="text-right">
                  <span className="text-slate-400 block text-xs">Total Amount Received:</span>
                  <span className="font-display font-extrabold text-xl text-[#9F3D00]">
                    ₹ {receipt.amount.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Legal Clauses */}
            <div className="text-[11px] text-slate-500 leading-relaxed space-y-1 mb-6 border-l-2 border-amber-600/40 pl-3">
              <p>
                1. Donations made to Punyakart Foundation are eligible for 50% deduction under Section 80G of the Indian Income Tax Act 1961.
              </p>
              <p>
                2. This is a computer-generated certificate issued upon electronic verification of banking funds and does not require a physical signature.
              </p>
              <p>
                3. Punyakart Foundation certifies that this contribution is utilized solely towards emergency trauma medical care, fodder, and shelter for stray cows.
              </p>
            </div>

            {/* Signature & Seal Block */}
            <div className="flex items-end justify-between pt-4 border-t border-slate-200">
              <div className="flex items-center gap-2">
                <div className="w-12 h-12 rounded-full border-2 border-dashed border-emerald-600/60 flex items-center justify-center text-emerald-800 font-black text-[9px] uppercase text-center leading-tight">
                  Official<br />Seal
                </div>
                <div className="text-[11px] text-slate-500">
                  Registered Section 8 NGO<br />
                  Govt of India
                </div>
              </div>

              <div className="text-right">
                <p className="font-display font-bold text-xs text-slate-800">
                  Authorized Signatory
                </p>
                <p className="text-[11px] text-slate-500">
                  Finance &amp; Trustee Board, Punyakart
                </p>
              </div>
            </div>

          </div>

          {/* Bottom Confirmation message */}
          <div className="mt-4 text-center text-xs text-slate-500 print:hidden">
            A copy of this 80G receipt has been dispatched to <strong>{receipt.email || 'your registered contact'}</strong>.
          </div>
        </div>

        {/* Modal Actions */}
        <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex items-center justify-between print:hidden">
          <div className="text-xs text-slate-500 flex items-center gap-1">
            <Heart className="w-3.5 h-3.5 text-red-500 fill-red-500" />
            <span>Thank you for blessing Gaumata.</span>
          </div>

          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.96 }}
            type="button"
            onClick={onClose}
            className="px-6 py-2 bg-[#9F3D00] hover:bg-[#863300] text-white font-semibold text-sm rounded-xl transition-colors cursor-pointer"
          >
            Done
          </motion.button>
        </div>

      </motion.div>
    </motion.div>
      )}
    </AnimatePresence>
  );
};

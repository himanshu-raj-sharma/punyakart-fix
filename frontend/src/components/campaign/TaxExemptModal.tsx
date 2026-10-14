import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ShieldCheck, FileCheck, CheckCircle2, Building, Download } from 'lucide-react';

interface TaxExemptModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TaxExemptModal: React.FC<TaxExemptModalProps> = ({ isOpen, onClose }) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4 overflow-y-auto"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 15 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 15 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className="relative max-w-2xl w-full bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-4 sm:my-8 max-h-[92vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="bg-[#0F2942] text-white p-4 sm:p-6 flex items-start justify-between flex-shrink-0">
              <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center flex-shrink-0">
                  <ShieldCheck className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-300" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-display font-bold text-base sm:text-xl text-white truncate">
                    80G Tax Exemption Details
                  </h3>
                  <p className="text-[11px] sm:text-xs text-slate-300 truncate">
                    Punyakart Foundation • MCA &amp; Income Tax Dept
                  </p>
                </div>
              </div>

              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors min-h-[38px] min-w-[38px] flex items-center justify-center cursor-pointer flex-shrink-0"
              >
                <X className="w-5 h-5" />
              </motion.button>
            </div>

            {/* Content */}
            <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 text-slate-700 text-sm overflow-y-auto">
              <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 flex items-start gap-3 text-emerald-900">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                <div className="text-xs sm:text-sm">
                  <strong>50% Tax Deduction Guarantee:</strong> Under Section 80G of the Indian Income Tax Act 1961, any contribution made by an Indian individual, Hindu Undivided Family (HUF), or enterprise to Punyakart Foundation qualifies for a 50% tax deduction on taxable income.
                </div>
              </div>

              {/* Registration Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-slate-50 px-4 py-2.5 font-display font-bold text-xs uppercase text-slate-500 border-b border-slate-200">
                  Official Statutory Registrations
                </div>
                <div className="divide-y divide-slate-100 text-xs sm:text-sm">
                  <div className="p-3 flex justify-between">
                    <span className="text-slate-500 font-medium">80G Approval Number</span>
                    <span className="font-mono font-bold text-slate-900">AADTP2149NF20214</span>
                  </div>
                  <div className="p-3 flex justify-between">
                    <span className="text-slate-500 font-medium">12A Income Tax Exemption</span>
                    <span className="font-mono font-bold text-slate-900">AADTP2149NE20212</span>
                  </div>
                  <div className="p-3 flex justify-between">
                    <span className="text-slate-500 font-medium">NITI Aayog NGO Darpan ID</span>
                    <span className="font-mono font-bold text-slate-900">UA/2021/0284719</span>
                  </div>
                  <div className="p-3 flex justify-between">
                    <span className="text-slate-500 font-medium">MCA CSR-1 Registration</span>
                    <span className="font-mono font-bold text-slate-900">CSR00034182</span>
                  </div>
                  <div className="p-3 flex justify-between">
                    <span className="text-slate-500 font-medium">PAN of Foundation</span>
                    <span className="font-mono font-bold text-slate-900">AADTP2149N</span>
                  </div>
                </div>
              </div>

              {/* How to claim */}
              <div className="space-y-2">
                <h4 className="font-display font-bold text-slate-900 text-sm">
                  How to Claim Your 80G Deduction in 3 Simple Steps:
                </h4>
                <ol className="list-decimal list-inside space-y-1.5 text-xs text-slate-600 pl-1">
                  <li>Enter your valid 10-digit PAN when making your contribution.</li>
                  <li>Instantly download or view the signed 80G Certificate with official seal upon checkout.</li>
                  <li>Provide our 80G Registration Number (AADTP2149NF20214) under "Table 80G" while filing your annual ITR.</li>
                </ol>
              </div>
            </div>

            {/* Footer */}
            <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex justify-end">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 bg-[#0F2942] hover:bg-[#1A3F64] text-white font-semibold text-sm rounded-xl transition-colors cursor-pointer"
              >
                I Understand
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

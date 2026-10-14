import React from 'react';
import { ShieldCheck, Info, HeartHandshake } from 'lucide-react';

interface AnnouncementBarProps {
  onOpenTaxModal: () => void;
}

export const AnnouncementBar: React.FC<AnnouncementBarProps> = ({ onOpenTaxModal }) => {
  return (
    <aside aria-label="Tax exemption announcement" className="bg-[#0F2942] text-white py-1.5 sm:py-2 px-3 sm:px-4 text-xs sm:text-sm font-medium border-b border-slate-700/50">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-1.5 sm:gap-2">
        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1 bg-[#006947] text-white text-[10px] sm:text-[11px] font-bold px-1.5 sm:px-2 py-0.5 rounded tracking-wide uppercase">
            <ShieldCheck className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            Govt Verified
          </span>
          <span className="text-slate-200 text-[11px] sm:text-xs md:text-sm">
            50% Tax Deductible under <strong>Section 80G</strong>.
          </span>
        </div>
        
        <div className="flex items-center gap-2 sm:gap-3 ml-auto">
          <button
            id="announcement-tax-details-btn"
            type="button"
            onClick={onOpenTaxModal}
            className="inline-flex items-center gap-1 text-amber-300 hover:text-amber-200 underline font-semibold text-[11px] sm:text-xs py-1 min-h-[32px] sm:min-h-[auto] transition-colors cursor-pointer"
          >
            <Info className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            <span>Tax Details</span>
          </button>
          <span className="hidden md:inline-block text-slate-400">|</span>
          <a
            href="https://wa.me/919876543210?text=Namaste%20Punyakart%2C%20I%20want%20to%20help%20with%20Gauseva"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden md:inline-flex items-center gap-1 text-emerald-300 hover:text-emerald-200 font-medium transition-colors"
          >
            <HeartHandshake className="w-3.5 h-3.5" />
            Support Hotline
          </a>
        </div>
      </div>
    </aside>
  );
};

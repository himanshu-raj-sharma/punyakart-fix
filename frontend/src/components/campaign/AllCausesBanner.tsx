import React from 'react';
import { 
  Heart, 
  ShieldCheck, 
  Sparkles, 
  ArrowRight, 
  Gift
} from 'lucide-react';

interface AllCausesBannerProps {
  onDonateClick?: () => void;
  onExploreCauses?: () => void;
  onSelectCategory?: (category: string) => void;
}

export const AllCausesBanner: React.FC<AllCausesBannerProps> = ({ 
  onDonateClick, 
  onExploreCauses
}) => {
  const handleScrollToDiscovery = () => {
    if (onExploreCauses) {
      onExploreCauses();
      return;
    }
    const discoveryEl = document.getElementById('causes-discovery') || document.querySelector('section');
    if (discoveryEl) {
      discoveryEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <section
      className="w-full bg-[#FAF7F2] text-slate-900 relative overflow-hidden border-b border-slate-200/80 shadow-2xs"
    >
      {/* Subtle Background Glows & Accent Orbs */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-[#FF6000]/10 rounded-full blur-3xl pointer-events-none -translate-y-1/2" />
      <div className="absolute bottom-0 left-10 w-80 h-80 bg-amber-400/10 rounded-full blur-3xl pointer-events-none translate-y-1/3" />

      <div className="max-w-[1440px] mx-auto px-3.5 sm:px-6 lg:px-8 py-5 sm:py-7 md:py-8 relative z-10">
        
        {/* Top Header Row of the Banner */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4 sm:mb-6">
          <div className="max-w-2xl">
            <div className="inline-flex max-w-full items-center gap-1.5 px-3 py-1 rounded-full bg-orange-50 border border-orange-200/80 text-[#FF6000] font-bold text-[10.5px] sm:text-xs tracking-wider uppercase mb-2">
              <Sparkles className="w-3.5 h-3.5 text-[#FF6000] flex-shrink-0" />
              <span>One Foundation • Infinite Compassion Across India</span>
            </div>
            <h2 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-[#001738] tracking-tight leading-tight">
              Transforming Lives Across <span className="text-[#FF6000]">Every Cause</span>
            </h2>
            <p className="text-sm text-slate-600 mt-1 max-w-xl leading-relaxed">
              From hungry children and rescued street animals to abandoned elders and emergency disaster relief — your kindness creates verified, on-ground impact every single day.
            </p>
          </div>

          {/* Quick Action Badges / CTAs on Desktop & Mobile */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 flex-shrink-0">
            <div className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl bg-white border border-slate-200 shadow-2xs text-amber-900 text-[11px] sm:text-xs font-semibold">
              <Gift className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
              <span>80G Tax Exemption (50%)</span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl bg-white border border-slate-200 shadow-2xs text-emerald-900 text-[11px] sm:text-xs font-semibold">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
              <span>100% Direct Seva</span>
            </div>
            {onDonateClick && (
              <button
                type="button"
                onClick={onDonateClick}
                className="bg-gradient-to-r from-[#FF6000] to-[#FF5100] hover:from-[#E55600] hover:to-[#D04A00] active:scale-95 text-white font-extrabold text-xs sm:text-sm px-4 py-2 rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5 min-h-[44px]"
              >
                <Heart className="w-3.5 h-3.5 fill-white" />
                <span>Donate Now</span>
              </button>
            )}
          </div>
        </div>

        {/* Unified High-Resolution Photographic Montage Poster */}
        <div
          className="relative rounded-2xl sm:rounded-3xl overflow-hidden border border-slate-200/90 shadow-xl bg-slate-900 group"
        >
          <div className="relative sm:aspect-[16/6] md:aspect-[12/4] min-h-[260px] sm:max-h-[400px] w-full overflow-hidden">
            <img
              src="/hero.jpeg"
              alt="Unified composite collage banner of all causes - Punyakart Foundation"
              className="absolute inset-0 sm:static w-full h-full object-cover object-center group-hover:scale-102 transition-transform duration-700"
              loading="eager"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#001738] via-[#001738]/45 to-transparent pointer-events-none" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#001738]/85 via-transparent to-[#001738]/85 pointer-events-none" />

            {/* Centered Floating Overlay Bar */}
            <div className="relative min-h-[260px] sm:min-h-0 sm:absolute inset-0 flex flex-col items-center justify-center p-3.5 sm:p-6 text-center">
              <span className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-full bg-black/60 border border-orange-400/40 text-orange-300 font-bold text-[10px] sm:text-xs tracking-wider uppercase mb-1.5 sm:mb-2.5 backdrop-blur-md">
                <Sparkles className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#FF6000]" />
                Combined Mission Panorama • All 8 Causes
              </span>
              <h3 className="text-lg sm:text-2xl md:text-3xl font-extrabold text-white drop-shadow-md leading-tight max-w-sm sm:max-w-none">
                Together, We Touch Every Life in Need
              </h3>
              <p className="text-sm text-slate-200 max-w-xl mt-1 sm:mt-1.5 drop-shadow-xs">
                Childhood Nutrition • Animal Sanctuaries • Senior Care • Daily Annadaan • Flood Survival
              </p>

              {/* Action Button */}
              <div className="mt-2.5 sm:mt-4 flex flex-col sm:flex-row items-center gap-3">
                <button
                  type="button"
                  onClick={handleScrollToDiscovery}
                  className="bg-[#FF6000] hover:bg-[#E55600] active:scale-95 text-white font-bold text-xs sm:text-sm px-5 py-2.5 rounded-xl shadow-xl transition-all cursor-pointer flex items-center justify-center gap-2 min-h-[44px]"
                >
                  <span>Explore All Causes Below</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Fast Info Bar */}
        <div className="mt-3 sm:mt-4 pt-3 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-2 text-[11px] sm:text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 shrink-0 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-slate-700 font-medium">
              Over <strong className="text-slate-900 font-bold">₹24,50,000+</strong> deployed directly to grassroots charities & rescue shelters this month.
            </span>
          </div>
          <button
            type="button"
            onClick={handleScrollToDiscovery}
            className="min-h-11 sm:min-h-0 text-[#FF6000] hover:text-[#E55600] font-bold inline-flex items-center gap-1 transition-colors cursor-pointer"
          >
            <span>Browse All Campaigns Below</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

      </div>
    </section>
  );
};

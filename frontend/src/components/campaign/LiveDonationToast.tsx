import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Heart, X } from 'lucide-react';

import { useRecentDonations } from '../../hooks/useRecentDonations';
import { formatDonationAmount, formatRelativeTime, startDonationRotation } from '../../utils/publicDonations';
export { formatDonationAmount, formatRelativeTime } from '../../utils/publicDonations';

interface LiveDonationToastProps {
  source: string;
  campaignName?: string;
  onDonateClick: () => void;
  suppressed?: boolean;
  compact?: boolean;
  /** @deprecated Use compact for the in-flow campaign chrome presentation. */
  inline?: boolean;
}

export const LiveDonationToast: React.FC<LiveDonationToastProps> = ({
  source,
  campaignName,
  onDonateClick,
  suppressed = false,
  compact = false,
  inline = false,
}) => {
  const isCompact = compact || inline;
  const { donations } = useRecentDonations(source, 12);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(true);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    setCurrentIndex(0);
    setIsVisible(true);
    setIsDismissed(false);
  }, [source]);

  useEffect(() => {
    setCurrentIndex(index => donations.length ? index % donations.length : 0);
    if (isDismissed) return;
    return startDonationRotation(donations.length, setIsVisible, () => {
      setCurrentIndex(index => (index + 1) % donations.length);
    });
  }, [source, donations.length, isDismissed]);

  if (suppressed || isDismissed || donations.length === 0) return null;

  const current = donations[currentIndex % donations.length];
  if (!current) return null;

  const destination = campaignName?.trim() || 'this campaign';

  return (
    <div data-presentation={isCompact ? 'compact' : 'floating'} className={isCompact
      ? 'live-donation-toast relative min-w-0 max-w-[34rem] pointer-events-none'
      : 'live-donation-toast fixed top-[calc(var(--site-header-height)+4rem)] bottom-auto sm:top-auto sm:bottom-20 lg:bottom-6 left-3 right-3 sm:left-6 sm:right-auto z-[35] w-auto max-w-[calc(100vw-1.5rem)] sm:max-w-sm pointer-events-none'}>
      <AnimatePresence mode="wait">
        {/* Keep the compact card's natural flow height throughout each rotation fade. */}
        {(isCompact || isVisible) && (
          <motion.div
            key={isCompact ? 'compact' : current.id}
            initial={isCompact ? false : { opacity: 0, y: 20, scale: 0.95 }}
            animate={isCompact ? { opacity: isVisible ? 1 : 0 } : { opacity: 1, y: 0, scale: 1 }}
            exit={isCompact ? { opacity: 0 } : { opacity: 0, y: 15, scale: 0.95 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            inert={isCompact && !isVisible}
            aria-hidden={isCompact && !isVisible}
            className={isCompact
              ? 'pointer-events-auto w-full min-w-0 rounded-xl border border-emerald-200/90 bg-[#F1FFF5] px-2.5 py-1.5 shadow-sm relative overflow-hidden sm:px-3 sm:py-2'
              : 'pointer-events-auto bg-white/95 backdrop-blur-md rounded-2xl border border-orange-200/90 p-3.5 shadow-lg shadow-slate-900/10 relative overflow-hidden'}
            role="status"
            aria-live="polite"
          >
            <div className={isCompact
              ? 'absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-amber-400 via-[#FF6B00] to-orange-500'
              : 'absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 via-[#FF6B00] to-orange-500'} />

            <button
              type="button"
              onClick={() => setIsDismissed(true)}
              className={isCompact
                ? 'absolute top-1 right-1 p-0.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors cursor-pointer'
                : 'absolute top-2 right-2 text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100 transition-colors cursor-pointer'}
              aria-label="Dismiss notification"
            >
              <X className={isCompact ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
            </button>

            <div className={isCompact ? 'flex items-center gap-2 pr-4' : 'flex items-start gap-3 pr-4'}>
              <div className={isCompact ? 'relative mt-0 flex-shrink-0' : 'relative mt-0.5 flex-shrink-0'}>
                <div className={isCompact
                  ? 'flex h-7 w-7 items-center justify-center rounded-lg border border-orange-200 bg-orange-50 text-[#FF6B00] shadow-xs sm:h-8 sm:w-8'
                  : 'flex h-9 w-9 items-center justify-center rounded-xl border border-orange-200 bg-orange-50 text-[#FF6B00] shadow-xs'}>
                  <Heart className={isCompact ? 'h-3.5 w-3.5 fill-[#FF6B00] sm:h-4 sm:w-4' : 'h-4 w-4 fill-[#FF6B00] animate-pulse'} />
                </div>
                <span className={isCompact ? 'absolute -right-1 -top-1 flex h-2 w-2' : 'absolute -top-1 -right-1 flex h-2.5 w-2.5'} aria-hidden="true">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className={isCompact ? 'relative inline-flex h-2 w-2 rounded-full bg-emerald-500' : 'relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500'} />
                </span>
              </div>

              <div className="min-w-0 text-xs">
                {isCompact ? (
                  <>
                    <p className="truncate text-[10px] font-bold leading-tight text-slate-900 sm:text-xs">
                      <span>{current.name}</span>{' '}donated{' '}
                      <span className="font-extrabold text-[#FF6B00]">{formatDonationAmount(current.amount)}</span>{' '}to {destination}
                    </p>
                    <div className="mt-0.5 flex items-center gap-2 text-[9px] leading-tight sm:text-[10px]">
                      <span className="text-slate-400">{formatRelativeTime(current.date)}</span>
                      <button
                        type="button"
                        onClick={onDonateClick}
                        className="inline-flex items-center gap-0.5 font-bold text-[#FF6B00] hover:text-[#E85D04] hover:underline cursor-pointer"
                      >
                        <span>Offer Seva Too</span>
                        <span aria-hidden="true">→</span>
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="truncate font-bold text-slate-900">{current.name}</p>
                    <p className="mt-0.5 text-[11px] font-medium text-slate-600">
                      <span className="rounded bg-orange-50 px-1.5 py-0.5 font-extrabold text-[#FF6B00]">
                        {formatDonationAmount(current.amount)}
                      </span>{' '}
                      donated to {destination}
                    </p>

                    <div className="mt-1.5 flex items-center justify-between gap-2 border-t border-slate-100 pt-1 text-[10px]">
                      <span className="text-slate-400">{formatRelativeTime(current.date)}</span>
                      <button
                        type="button"
                        onClick={onDonateClick}
                        className="flex items-center gap-0.5 font-bold text-[#FF6B00] hover:text-[#E85D04] hover:underline cursor-pointer"
                      >
                        <span>Offer Seva Too</span>
                        <span aria-hidden="true">→</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

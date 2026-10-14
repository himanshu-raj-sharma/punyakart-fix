import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Heart, ShoppingBag, ShieldCheck } from 'lucide-react';
import { DonationCartItem } from '../../types/campaign';

interface MobileStickyBarProps {
  cart: DonationCartItem[];
  currentTotalAmount: number;
  onOpenDonate: () => void;
  isModalOpen: boolean;
}

export const MobileStickyBar: React.FC<MobileStickyBarProps> = ({
  cart,
  currentTotalAmount,
  onOpenDonate,
  isModalOpen,
}) => {
  const totalCartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const displayAmount = currentTotalAmount > 0 ? currentTotalAmount : 1000;
  const hasActiveAmount = totalCartCount > 0 || currentTotalAmount > 0;

  return (
    <AnimatePresence>
      {!isModalOpen && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="fixed bottom-0 inset-x-0 z-30 lg:hidden bg-white/95 backdrop-blur-md border-t border-slate-200 px-4 py-2.5 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] pb-[max(0.625rem,env(safe-area-inset-bottom))]"
        >
          <div className="flex items-center justify-between gap-3 max-w-lg mx-auto">
            
            {/* Left Info: Cart or 80G Tax Benefit Guarantee */}
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {hasActiveAmount ? (
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-[#FF6B00]">
                    <ShoppingBag className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="truncate">{totalCartCount > 0 ? `${totalCartCount} item${totalCartCount > 1 ? 's' : ''}` : 'Donation Amount'}</span>
                  </div>
                  <p className="text-[11px] text-slate-500 font-medium truncate">
                    Total: <strong className="text-[#0B2545] font-extrabold">₹{displayAmount.toLocaleString()}</strong>
                  </p>
                </div>
              ) : (
                <div className="min-w-0">
                  <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-700">
                    <ShieldCheck className="w-3.5 h-3.5 flex-shrink-0 text-emerald-600" />
                    <span>80G Tax Deductible (50%)</span>
                  </div>
                  <p className="text-[11px] text-slate-500 font-medium truncate">
                    Govt Reg: <strong className="text-slate-800">AAPCP5662BF20251</strong>
                  </p>
                </div>
              )}
            </div>

            {/* Right CTA Button */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.95 }}
              id="mobile-sticky-donate-btn"
              type="button"
              onClick={onOpenDonate}
              className="flex-shrink-0 inline-flex items-center justify-center gap-1.5 bg-[#FF6B00] hover:bg-[#E85D04] text-white font-display font-extrabold text-xs sm:text-sm px-4 py-2.5 rounded-xl shadow-md shadow-orange-900/20 cursor-pointer transition-colors min-h-[44px]"
            >
              <Heart className="w-3.5 h-3.5 fill-white" />
              <span>{hasActiveAmount ? `Donate ₹${displayAmount.toLocaleString()}` : 'Donate Now →'}</span>
            </motion.button>

          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

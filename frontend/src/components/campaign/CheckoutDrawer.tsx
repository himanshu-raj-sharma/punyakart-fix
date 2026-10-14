import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { DonationCartItem, Currency, TaxReceiptData, ProductItem } from '../../types/campaign';
import { 
  X, 
  Heart, 
  ShieldCheck, 
  Lock, 
  QrCode, 
  CreditCard, 
  Building2, 
  CheckCircle2, 
  AlertCircle,
  Plus,
  Minus,
  Trash2,
  Sparkles
} from 'lucide-react';

interface CheckoutDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  directAmount: number | null;
  directCurrency: Currency;
  cart: DonationCartItem[];
  onUpdateCartQty: (product: ProductItem, delta: number) => void;
  onCompleteDonation: (receipt: TaxReceiptData) => void;
  initialFrequency?: 'one-time' | 'monthly';
}

export const CheckoutDrawer: React.FC<CheckoutDrawerProps> = ({
  isOpen,
  onClose,
  directAmount,
  directCurrency,
  cart,
  onUpdateCartQty,
  onCompleteDonation,
  initialFrequency = 'one-time'
}) => {
  const [frequency, setFrequency] = useState<'one-time' | 'monthly'>(initialFrequency);
  const [paymentMode, setPaymentMode] = useState<'upi' | 'card' | 'netbanking'>('upi');
  
  // Donor form
  const [donorName, setDonorName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [panNumber, setPanNumber] = useState('');
  const [want80G, setWant80G] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Calculate total: If cart has items and directAmount is null, use cart sum; otherwise use directAmount (or cart if directAmount was 0)
  const cartTotalINR = cart.reduce((sum, item) => sum + item.product.unitPrice * item.quantity, 0);
  const isCartCheckout = cart.length > 0 && (!directAmount || directAmount === 0);

  const finalAmount = isCartCheckout ? cartTotalINR : (directAmount || 3000);
  const finalCurrencySymbol = isCartCheckout ? '₹' : directCurrency.symbol;

  const handlePanChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
    setPanNumber(val);
  };

  const handleSubmitDonation = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!donorName.trim()) {
      setErrorMsg('Please enter your full legal name for the donation receipt.');
      return;
    }

    if (!email.trim() || !email.includes('@')) {
      setErrorMsg('Please enter a valid email address to receive your 80G Tax Certificate.');
      return;
    }

    if (!phone.trim() || phone.length < 8) {
      setErrorMsg('Please provide a valid contact number.');
      return;
    }

    if (want80G && panNumber && panNumber.length !== 10) {
      setErrorMsg('Indian PAN must be exactly 10 alphanumeric characters (e.g. ABCDE1234F).');
      return;
    }

    setIsProcessing(true);

    // Simulate seamless secure payment gateway execution
    setTimeout(() => {
      const receipt: TaxReceiptData = {
        receiptNumber: `PKF-${Date.now().toString().slice(-6)}`,
        donorName: donorName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        panNumber: want80G ? panNumber || 'APPLIED-80G' : 'N/A',
        amount: finalAmount,
        currency: finalCurrencySymbol,
        paymentMode: paymentMode.toUpperCase(),
        paymentDate: new Date().toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric'
        }),
        transactionRef: `TXN${Math.floor(100000000 + Math.random() * 900000000)}`,
        is80GEligible: want80G
      };

      setIsProcessing(false);
      onCompleteDonation(receipt);
    }, 1200);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-xs flex justify-end"
          onClick={onClose}
        >
          <motion.div 
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="w-full max-w-lg bg-white h-full shadow-2xl flex flex-col justify-between overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div className="p-5 sm:p-6 bg-[#0F2942] text-white flex items-center justify-between sticky top-0 z-10">
              <div className="flex items-center gap-2">
                <Heart className="w-5 h-5 text-amber-400 fill-amber-400" />
                <div>
                  <h3 className="font-display font-bold text-lg text-white">
                    Complete Your Sacred Contribution
                  </h3>
                  <p className="text-xs text-slate-300">
                    100% Tax Deductible under Section 80G
                  </p>
                </div>
              </div>
              <button
                id="checkout-drawer-close-btn"
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

        {/* Drawer Body Form */}
        <form onSubmit={handleSubmitDonation} className="p-5 sm:p-6 space-y-6 flex-1">
          
          {/* Frequency Selector */}
          <div className="bg-slate-100 p-1.5 rounded-xl flex items-center gap-1 border border-slate-200">
            <button
              type="button"
              onClick={() => setFrequency('one-time')}
              className={`flex-1 py-2.5 rounded-lg text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                frequency === 'one-time'
                  ? 'bg-white text-[#0F2942] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              One-Time Contribution
            </button>
            <button
              type="button"
              onClick={() => setFrequency('monthly')}
              className={`flex-1 py-2.5 rounded-lg text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                frequency === 'monthly'
                  ? 'bg-[#9F3D00] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Monthly Hero</span>
            </button>
          </div>

          {/* Amount / Items Summary Box */}
          <div className="bg-[#FDFBF7] rounded-2xl border border-amber-200 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                {isCartCheckout ? 'Selected Supplies Total' : 'Donation Pledge'}
              </span>
              <span className="font-display font-black text-2xl text-[#9F3D00]">
                {finalCurrencySymbol} {finalAmount.toLocaleString()}
                {frequency === 'monthly' && <span className="text-xs font-medium text-slate-500"> /mo</span>}
              </span>
            </div>

            {/* If cart items exist, show breakdown */}
            {isCartCheckout && (
              <div className="border-t border-amber-200/80 pt-3 space-y-2 max-h-40 overflow-y-auto text-xs">
                {cart.map((item) => (
                  <div key={item.product.id} className="flex items-center justify-between text-slate-700">
                    <div className="flex-1 pr-2">
                      <span className="font-semibold">{item.product.name}</span>
                      <span className="text-slate-400 block text-[11px]">
                        {item.quantity} × ₹{item.product.unitPrice}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onUpdateCartQty(item.product, -1)}
                        className="w-5 h-5 rounded bg-slate-200 flex items-center justify-center font-bold text-slate-700"
                      >
                        -
                      </button>
                      <span className="font-bold w-4 text-center">{item.quantity}</span>
                      <button
                        type="button"
                        onClick={() => onUpdateCartQty(item.product, 1)}
                        className="w-5 h-5 rounded bg-[#9F3D00] flex items-center justify-center font-bold text-white"
                      >
                        +
                      </button>
                      <span className="font-bold text-slate-900 ml-2">
                        ₹{(item.quantity * item.product.unitPrice).toLocaleString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Error notice if validation fails */}
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Donor Information */}
          <div className="space-y-3.5">
            <h4 className="font-display font-bold text-sm text-slate-900 flex items-center gap-1.5">
              <span>Donor Details</span>
              <span className="text-slate-400 font-normal text-xs">(For 80G Certificate)</span>
            </h4>

            <div>
              <label htmlFor="checkout-donor-name" className="block text-xs font-semibold text-slate-600 mb-1">
                Full Name / Entity *
              </label>
              <input
                id="checkout-donor-name"
                type="text"
                required
                value={donorName}
                onChange={(e) => setDonorName(e.target.value)}
                placeholder="e.g. Rameshwar Kumar"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-base sm:text-sm focus:ring-2 focus:ring-[#9F3D00] outline-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="checkout-email" className="block text-xs font-semibold text-slate-600 mb-1">
                  Email Address *
                </label>
                <input
                  id="checkout-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ramesh@example.com"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-base sm:text-sm focus:ring-2 focus:ring-[#9F3D00] outline-none"
                />
              </div>
              <div>
                <label htmlFor="checkout-phone" className="block text-xs font-semibold text-slate-600 mb-1">
                  Mobile / WhatsApp *
                </label>
                <input
                  id="checkout-phone"
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 9876543210"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-base sm:text-sm focus:ring-2 focus:ring-[#9F3D00] outline-none"
                />
              </div>
            </div>

            {/* 80G PAN Details */}
            <div className="p-3.5 bg-emerald-50/60 rounded-xl border border-emerald-200 space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={want80G}
                  onChange={(e) => setWant80G(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                />
                <span className="text-xs font-bold text-emerald-900">
                  I want an 80G Tax Exemption Certificate (50% Tax Saved)
                </span>
              </label>

              {want80G && (
                <div>
                  <label htmlFor="checkout-pan" className="block text-[11px] font-semibold text-slate-600 mb-1">
                    PAN Card Number (10 alphanumeric digits)
                  </label>
                  <input
                    id="checkout-pan"
                    type="text"
                    maxLength={10}
                    value={panNumber}
                    onChange={handlePanChange}
                    placeholder="ABCDE1234F"
                    className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-base sm:text-sm font-mono uppercase tracking-wider focus:ring-2 focus:ring-emerald-600 outline-none"
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    Required by Govt of India for issuing electronic Form 10BE certificate.
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Payment Method Selector */}
          <div className="space-y-3">
            <h4 className="font-display font-bold text-sm text-slate-900">
              Select Payment Method
            </h4>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setPaymentMode('upi')}
                className={`p-3 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1.5 ${
                  paymentMode === 'upi'
                    ? 'border-[#9F3D00] bg-amber-50/80 text-[#9F3D00] font-bold shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 text-slate-600'
                }`}
              >
                <QrCode className="w-5 h-5" />
                <span className="text-xs">UPI / QR</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMode('card')}
                className={`p-3 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1.5 ${
                  paymentMode === 'card'
                    ? 'border-[#9F3D00] bg-amber-50/80 text-[#9F3D00] font-bold shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 text-slate-600'
                }`}
              >
                <CreditCard className="w-5 h-5" />
                <span className="text-xs">Cards</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMode('netbanking')}
                className={`p-3 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1.5 ${
                  paymentMode === 'netbanking'
                    ? 'border-[#9F3D00] bg-amber-50/80 text-[#9F3D00] font-bold shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 text-slate-600'
                }`}
              >
                <Building2 className="w-5 h-5" />
                <span className="text-xs">NetBanking</span>
              </button>
            </div>

            {/* UPI QR Simulation Preview */}
            {paymentMode === 'upi' && (
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center gap-3">
                <div className="w-12 h-12 bg-white rounded-lg border border-slate-200 flex items-center justify-center p-1 shadow-2xs">
                  <QrCode className="w-9 h-9 text-slate-800" />
                </div>
                <div className="text-xs text-slate-600">
                  <strong className="text-slate-900 block">Instant UPI Apps &amp; Dynamic QR</strong>
                  PhonePe, Google Pay, Paytm, BHIM, and all banking apps supported with zero convenience charges.
                </div>
              </div>
            )}
          </div>

          {/* Submit Action Button */}
          <div className="pt-2 sticky bottom-0 bg-white pb-2">
            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              id="confirm-donation-pay-btn"
              type="submit"
              disabled={isProcessing}
              className="w-full py-4 px-6 rounded-xl bg-[#9F3D00] hover:bg-[#863300] text-white font-display font-bold text-base sm:text-lg shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-75"
            >
              {isProcessing ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Connecting to Bank Gateway...</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  <span>
                    Pay {finalCurrencySymbol}{finalAmount.toLocaleString()} &amp; Get 80G Receipt
                  </span>
                </>
              )}
            </motion.button>
            <p className="mt-2 text-center text-[11px] text-slate-400">
              Guaranteed 256-bit encrypted bank checkout. Instant official 80G certificate.
            </p>
          </div>

        </form>
      </motion.div>
    </motion.div>
      )}
    </AnimatePresence>
  );
};

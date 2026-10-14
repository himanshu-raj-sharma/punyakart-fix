import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { X, ShieldCheck, Heart, AlertCircle, Zap, QrCode } from 'lucide-react';
import confetti from 'canvas-confetti';
import { DonationType, Language, PaymentMethod, DonationSubmission, DonorDedication, DonationSource } from '../types';
import { translations } from '../data/content';
import { LANDING_FUND_RAISERS } from '../data/fundRaisers';
import { getDonationAmountError, getMinimumDonationAmount, isAutoPayAmount, isValidDonationPhone, MAX_DONATION_AMOUNT, normalizeDonationPhone, normalizeDonationSource, parseDonationAmount } from '../constants/donation';
import { collectMetaTrackingPayload, dispatchMetaInitiateCheckout, dispatchMetaPurchase, type VerifiedMetaDonation } from '../utils/metaTracking';
import { getTrafficAttributionForCheckout } from '../utils/trafficAttributionSession';
import { createPaymentSessionAuthority, type PaymentAttempt } from '../utils/paymentSession';

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => {
      open: () => void;
      on: (event: string, cb: (response: { error?: { description?: string } }) => void) => void;
    };
    fbq?: (...args: unknown[]) => void;
  }
}

interface DonationModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: Language;
  amount: number;
  type: DonationType;
  causeTitle: string;
  campaignId?: string;
  want80G: boolean;
  /** Landing vs crowd funding (and future public channels). */
  source?: DonationSource;
  dedication?: DonorDedication;
  onCompleteDonation: (submission: DonationSubmission) => void;
}

const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

function channelLabel(source?: DonationSource): string {
  if (source?.startsWith('campaign_')) return source.replace('campaign_', '');
  return source === 'chennai_airport' ? 'Chennai Airport' : 'Campaigns';
}

interface PendingPayment {
  attempt: PaymentAttempt;
  donation: { id: string; amount: number };
  razorpayOrderId?: string;
  razorpaySubscriptionId?: string;
  razorpayKeyId: string;
  clientToken: string;
  autoPay?: boolean;
}

export const DonationModal: React.FC<DonationModalProps> = ({
  isOpen,
  onClose,
  language,
  amount: initialAmount,
  type,
  causeTitle,
  campaignId,
  source = 'chennai_airport',
  dedication,
  onCompleteDonation,
}) => {
  const t = translations[language];
  const lockedSourceRef = useRef<DonationSource>(normalizeDonationSource(source));
  const wasOpenRef = useRef(false);
  const resolvedSource = isOpen && !wasOpenRef.current ? normalizeDonationSource(source) : lockedSourceRef.current;
  const minimumAmount = getMinimumDonationAmount(resolvedSource);
  const amountErrorMessage = getDonationAmountError(resolvedSource);
  const isLandingForm = resolvedSource === 'chennai_airport';
  const [amountInput, setAmountInput] = useState(String(initialAmount));
  const [sessionAmount, setSessionAmount] = useState(initialAmount);
  const chosenAmount = parseDonationAmount(amountInput, resolvedSource);
  const supportsAutoPay = type === 'monthly' && chosenAmount !== null && isAutoPayAmount(chosenAmount);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [panNumber, setPanNumber] = useState('');
  const [fundRaiser, setFundRaiser] = useState('');
  const [metaTrackingConsent, setMetaTrackingConsent] = useState(false);
  /** Monthly only: activate Auto Pay / recurring monthly debit. */
  const [autoPay, setAutoPay] = useState(true);
  const [paymentView, setPaymentView] = useState<'form' | 'loading' | 'pay'>('form');
  const amount = paymentView === 'form' ? (chosenAmount ?? 0) : sessionAmount;
  const amountLabel = paymentView === 'form' && chosenAmount === null ? '—' : amount.toLocaleString('en-IN');
  const effectiveAutoPay = autoPay && supportsAutoPay;
  const [qrImageUrl, setQrImageUrl] = useState<string | null>(null);
  const [processingStep, setProcessingStep] = useState('');
  const [apiError, setApiError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [activeDonationId, setActiveDonationId] = useState<string | null>(null);
  const pendingPaymentRef = useRef<PendingPayment | null>(null);
  const initiatingRef = useRef(false);
  const paymentAuthority = useRef(createPaymentSessionAuthority());
  const checkoutTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const cancelPaymentSession = useCallback(() => {
    paymentAuthority.current.cancel();
    if (checkoutTimer.current !== undefined) clearTimeout(checkoutTimer.current);
    initiatingRef.current = false;
    pendingPaymentRef.current = null;
  }, []);
  useLayoutEffect(() => {
    return cancelPaymentSession;
  }, [isOpen, cancelPaymentSession]);
  const trackedPurchaseDonationIdsRef = useRef<Set<string>>(new Set());

  const trackMetaPurchase = useCallback((donation: VerifiedMetaDonation | null | undefined) => {
    dispatchMetaPurchase(
      donation,
      typeof window === 'undefined' ? undefined : window.fbq,
      trackedPurchaseDonationIdsRef.current,
    );
  }, []);

  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      lockedSourceRef.current = normalizeDonationSource(source);
      setAmountInput(String(initialAmount));
      setSessionAmount(initialAmount);
      setAutoPay(type === 'monthly' && isAutoPayAmount(initialAmount));
      setMetaTrackingConsent(false);
    }
    wasOpenRef.current = isOpen;
  }, [isOpen, initialAmount, source, type]);

  useEffect(() => {
    if (!isOpen) {
      setFullName('');
      setPhone('');
      setEmail('');
      setAddress('');
      setPanNumber('');
      setFundRaiser('');
      setMetaTrackingConsent(false);
      setAutoPay(true);
      setPaymentView('form');
      setQrImageUrl(null);
      setProcessingStep('');
      setApiError(null);
      setFieldErrors({});
      setActiveDonationId(null);
      pendingPaymentRef.current = null;
      trackedPurchaseDonationIdsRef.current.clear();
    }
  }, [isOpen]);

  const triggerConfetti = useCallback(() => {
    try {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#FF6B00', '#002D62', '#10b981', '#fbbf24'],
      });
    } catch {
      // safe fallback
    }
  }, []);

  const finishPayment = useCallback((pending: PendingPayment, donation: DonationSubmission) => {
    if (!pending.attempt.complete(donation, pending.donation)) return;
    trackMetaPurchase(donation);
    triggerConfetti();
    onCompleteDonation({ ...donation, clientToken: donation.clientToken || pending.clientToken });
  }, [onCompleteDonation, trackMetaPurchase, triggerConfetti]);

  useEffect(() => {
    const pending = pendingPaymentRef.current;
    if (!isOpen || paymentView !== 'pay' || !activeDonationId || !pending) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const pollStatus = async () => {
      try {
        const res = await fetch(
          `/api/donations/${activeDonationId}/status?token=${encodeURIComponent(pending.clientToken)}`,
          { signal: pending.attempt.signal, cache: 'no-store' },
        );
        if (!res.ok) return;
        const data = await res.json();
        if (!active || !pending.attempt.isCurrent()) return;
        if (data.success === true && data.status === 'verified') finishPayment(pending, data.donation);
        else if (data.status === 'refunded') {
          setApiError('This payment has been refunded. Please contact the foundation for assistance.');
          pending.attempt.cancel();
        }
      } catch {
        // Transport failures retry without inventing a successful payment.
      } finally {
        if (active && pending.attempt.isCurrent()) timer = setTimeout(pollStatus, 2500);
      }
    };
    void pollStatus();
    return () => { active = false; if (timer !== undefined) clearTimeout(timer); };
  }, [isOpen, paymentView, activeDonationId, finishPayment]);

  if (!isOpen) return null;

  const openRazorpayCheckout = () => {
    const pending = pendingPaymentRef.current;
    if (!pending?.attempt.isCurrent()) return;
    if (!pending || typeof window.Razorpay === 'undefined') {
      setApiError('Payment gateway failed to load. Please refresh and try again.');
      return;
    }

    const { donation, razorpayOrderId, razorpaySubscriptionId, razorpayKeyId, autoPay: isAutoPay } = pending;
    const checkoutKey = razorpayKeyId || import.meta.env.VITE_RAZORPAY_KEY_ID;

    if (isAutoPay && razorpaySubscriptionId) {
      const options = {
        key: checkoutKey,
        subscription_id: razorpaySubscriptionId,
        name: 'Punyakart Foundation',
        description: `Auto Pay · ${causeTitle}`,
        prefill: {
          name: fullName.trim(),
          email: email.trim(),
          contact: normalizeDonationPhone(phone),
        },
        theme: { color: '#FF6B00' },
        handler: async (response: {
          razorpay_payment_id: string;
          razorpay_subscription_id: string;
          razorpay_signature: string;
        }) => {
          if (!pending.attempt.isCurrent()) return;
          try {
            setProcessingStep('Activating Auto Pay...');
            const verifyRes = await fetch('/api/donations/verify-razorpay', {
              method: 'POST',
              signal: pending.attempt.signal,
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_subscription_id: response.razorpay_subscription_id,
                razorpay_signature: response.razorpay_signature,
                 donation_id: donation.id,
                 clientToken: pending.clientToken,
              }),
            });

            const verifyData = await verifyRes.json();
            if (!pending.attempt.isCurrent()) return;
            if (!verifyRes.ok) {
              throw new Error(verifyData.error || 'Auto Pay activation failed');
            }

            finishPayment(pending, verifyData.donation);
          } catch (err: unknown) {
            if (!pending.attempt.isCurrent()) return;
            setApiError(err instanceof Error ? err.message : 'Auto Pay activation failed. Please contact support.');
          }
        },
        modal: {
          ondismiss: () => {
            if (pending.attempt.isCurrent()) setApiError(null);
          },
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', (response) => {
        if (!pending.attempt.isCurrent()) return;
        const reason = response.error?.description || 'Payment failed';
        setApiError(reason);
      });
      rzp.open();
      return;
    }

    if (!razorpayOrderId) {
      setApiError('Payment session is incomplete. Please go back and try again.');
      return;
    }

    const options = {
      key: checkoutKey,
      amount: donation.amount * 100,
      currency: 'INR',
      name: 'Punyakart Foundation',
      description: causeTitle,
      order_id: razorpayOrderId,
      prefill: {
        name: fullName.trim(),
        email: email.trim(),
        contact: normalizeDonationPhone(phone),
      },
      theme: { color: '#FF6B00' },
      config: {
        display: {
          blocks: {
            upi: {
              name: 'Pay via UPI',
              instruments: [{ method: 'upi' }],
            },
          },
          sequence: ['block.upi'],
          preferences: { show_default_blocks: true },
        },
      },
      handler: async (response: {
        razorpay_order_id: string;
        razorpay_payment_id: string;
        razorpay_signature: string;
      }) => {
        if (!pending.attempt.isCurrent()) return;
        try {
          setProcessingStep('Verifying payment...');
          const verifyRes = await fetch('/api/donations/verify-razorpay', {
            method: 'POST',
            signal: pending.attempt.signal,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
               donation_id: donation.id,
               clientToken: pending.clientToken,
            }),
          });

          const verifyData = await verifyRes.json();
          if (!pending.attempt.isCurrent()) return;
          if (!verifyRes.ok) {
            throw new Error(verifyData.error || 'Payment verification failed');
          }

          finishPayment(pending, verifyData.donation);
        } catch (err: unknown) {
          if (!pending.attempt.isCurrent()) return;
          setApiError(err instanceof Error ? err.message : 'Payment verification failed. Please contact support.');
        }
      },
      modal: {
        ondismiss: () => {
          if (pending.attempt.isCurrent()) setApiError(null);
        },
      },
    };

    const rzp = new window.Razorpay(options);
    rzp.on('payment.failed', (response) => {
      if (!pending.attempt.isCurrent()) return;
      const reason = response.error?.description || 'Payment failed';
      setApiError(reason);
    });
    rzp.open();
  };

  const validateClient = (): Record<string, string> | null => {
    const errors: Record<string, string> = {};
    if (chosenAmount === null) {
      errors.amount = amountErrorMessage;
    }
    if (!fullName.trim() || fullName.trim().length < 2) errors.fullName = t.modalNameError;
    if (!isValidDonationPhone(phone)) errors.phone = 'Enter a valid WhatsApp number with country code, e.g. +91 9876543210.';
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errors.email = t.modalEmailError;
    }
    if (!address.trim() || address.trim().length < 5) errors.address = t.modalAddressError;
    const pan = panNumber.trim().toUpperCase();
    if (pan && !PAN_REGEX.test(pan)) {
      errors.panNumber = t.modalPanError;
    }
    if (
      isLandingForm &&
      fundRaiser.trim() &&
      !(LANDING_FUND_RAISERS as readonly string[]).includes(fundRaiser.trim())
    ) {
      errors.fundRaiser = t.modalFundRaiserError;
    }
    return Object.keys(errors).length ? errors : null;
  };

  const handleCompletePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (initiatingRef.current || paymentView !== 'form') return;
    setApiError(null);
    setFieldErrors({});

    const clientErrors = validateClient();
    if (clientErrors) {
      setFieldErrors(clientErrors);
      return;
    }

    initiatingRef.current = true;
    const attempt = paymentAuthority.current.begin();
    setSessionAmount(amount);
    setPaymentView('loading');
    setProcessingStep('Creating secure payment...');

    try {
      const payload = {
        amount,
        type,
        causeTitle,
        campaignId,
        fullName: fullName.trim(),
        email: email.trim(),
        phone: normalizeDonationPhone(phone),
        address: address.trim(),
        panNumber: panNumber.trim() ? panNumber.trim().toUpperCase() : '',
        fundRaiser: isLandingForm && fundRaiser.trim() ? fundRaiser.trim() : '',
        want80G: true,
        autoPay: effectiveAutoPay,
        paymentMethod: 'razorpay' as PaymentMethod,
        dedication,
        source: lockedSourceRef.current,
        consentDpdP: true,
        metaTracking: collectMetaTrackingPayload(metaTrackingConsent),
        trafficAttribution: getTrafficAttributionForCheckout(),
      };

      const res = await fetch('/api/donations/initiate', {
        method: 'POST',
        signal: attempt.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!attempt.isCurrent()) return;

      if (!res.ok) {
        if (data.details) setFieldErrors(data.details);
        if (data.code === 'GATEWAY_NOT_CONFIGURED') {
          throw new Error('Payment gateway is not configured on the server. Please contact the foundation.');
        }
        const detailMsg = data.details
          ? Object.values(data.details as Record<string, string>).filter(Boolean).join(' ')
          : '';
        throw new Error(detailMsg || data.error || 'Donation could not be registered. Please try again.');
      }

      const {
        donation,
        razorpayOrderId,
        razorpaySubscriptionId,
        razorpayKeyId,
        clientToken,
        autoPay: initiatedAutoPay,
      } = data;
      if (data.success !== true || !donation || typeof donation.id !== 'string' ||
          !donation.id || donation.amount !== amount || typeof clientToken !== 'string' || !clientToken ||
          (!razorpayOrderId && !razorpaySubscriptionId)) {
        throw new Error('The payment session response was incomplete. Please retry or contact the foundation.');
      }
      const checkoutKey = razorpayKeyId || import.meta.env.VITE_RAZORPAY_KEY_ID;
      if (!checkoutKey || checkoutKey.includes('your_') || checkoutKey.includes('dummy')) {
        throw new Error('Payment gateway is not configured. Please contact the foundation.');
      }

      pendingPaymentRef.current = {
        attempt,
        donation,
        razorpayOrderId,
        razorpaySubscriptionId,
        razorpayKeyId: checkoutKey,
        clientToken,
        autoPay: Boolean(initiatedAutoPay && razorpaySubscriptionId),
      };
      setActiveDonationId(donation.id);
      setSessionAmount(donation.amount);
      // Track only after a valid server-created Razorpay session, and only with explicit Meta opt-in.
      dispatchMetaInitiateCheckout(
        donation.id,
        donation.amount,
        metaTrackingConsent,
        (window as Window & { fbq?: (...args: unknown[]) => void }).fbq,
      );
      // Use the QR rendered inside Razorpay Checkout. It is tied to the
      // created order and avoids showing a separate QR that may expire or
      // become invalid before the donor scans it.
      setQrImageUrl(null);
      setPaymentView('pay');
      setProcessingStep('');

      // Open Razorpay Checkout immediately for both one-time and recurring
      // payments so donors always scan the gateway-managed QR.
      checkoutTimer.current = setTimeout(() => { if (attempt.isCurrent()) openRazorpayCheckout(); }, 150);
    } catch (err: unknown) {
      if (!attempt.isCurrent()) return;
      setPaymentView('form');
      setProcessingStep('');
      setApiError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      if (attempt.isCurrent()) initiatingRef.current = false;
    }
  };

  return (
    <div className="fixed inset-0 z-50 min-h-0 flex items-end sm:items-center justify-center p-0 pt-[env(safe-area-inset-top)] sm:p-4 bg-slate-950/80 backdrop-blur-xs overflow-y-auto overscroll-contain">
      <div className="relative w-full min-w-0 min-h-0 sm:max-w-lg rounded-t-3xl sm:rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden my-0 sm:my-auto max-h-[96vh] supports-[height:100dvh]:max-h-[calc(100dvh-env(safe-area-inset-top))] sm:max-h-[92vh] sm:supports-[height:100dvh]:max-h-[92dvh] flex flex-col">
        <div className="bg-[#002D62] text-white p-4 sm:p-5 flex items-center justify-between gap-2 border-b border-blue-900 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 rounded-2xl bg-[#FF6B00] text-white shadow-md shrink-0">
              <Heart className="w-5 h-5 fill-white" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-black uppercase bg-emerald-500/30 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-400/40">
                {t.taxBadge} · {channelLabel(resolvedSource)}
              </span>
              <h3 className="font-display font-black text-base sm:text-lg tracking-tight mt-0.5 break-words sm:truncate">
                {isLandingForm ? t.modalAirportDonation : t.modalCrowdDonation} • ₹{amountLabel}
                {(paymentView === 'pay' ? pendingPaymentRef.current?.autoPay : effectiveAutoPay) ? t.stickyPerMonth : ''}
              </h3>
            </div>
          </div>
          <button
            onClick={() => { cancelPaymentSession(); onClose(); }}
            className="w-11 h-11 sm:w-auto sm:h-auto p-2 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer shrink-0"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {paymentView === 'loading' ? (
          <div className="min-h-0 overflow-y-auto overscroll-contain p-8 pb-[calc(2rem+env(safe-area-inset-bottom))] sm:pb-8 text-center space-y-4 my-auto">
            <div className="relative w-16 h-16 mx-auto">
              <div className="w-16 h-16 rounded-full border-4 border-orange-200 border-t-[#FF6B00] animate-spin" />
              <Heart className="w-6 h-6 text-[#FF6B00] absolute inset-0 m-auto animate-pulse fill-[#FF6B00]" />
            </div>
            <h4 className="font-display font-black text-lg text-neutral-900 dark:text-white">
              {effectiveAutoPay ? 'Preparing Auto Pay...' : 'Preparing UPI QR...'}
            </h4>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 font-medium">{processingStep}</p>
          </div>
        ) : paymentView === 'pay' ? (
          <div className="min-h-0 min-w-0 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:p-6 space-y-4 overflow-y-auto overscroll-contain">
            <div className="text-center space-y-3">
              {pendingPaymentRef.current?.autoPay ? (
                <>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-950 text-[#002D62] dark:text-blue-200 text-xs font-black">
                    <Zap className="w-4 h-4" />
                    Activate Auto Pay
                  </div>
                  <p className="text-sm font-black text-neutral-900 dark:text-white">
                    ₹{amountLabel}/month
                  </p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed px-2">
                    Authorize today’s payment and monthly Auto Pay on Razorpay (UPI Autopay / card). You can cancel later by contacting the foundation.
                  </p>
                </>
              ) : (
                <>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-100 dark:bg-orange-950 text-[#FF6B00] text-xs font-black">
                    <QrCode className="w-4 h-4" />
                    Scan & Pay via UPI
                  </div>
                  <p className="text-sm font-black text-neutral-900 dark:text-white">
                    ₹{amountLabel}{type === 'monthly' ? ' · One-time payment (monthly intent)' : ''}
                  </p>

                  {qrImageUrl ? (
                    <div className="mx-auto w-fit p-3 rounded-2xl bg-white border-2 border-[#FF6B00]/30 shadow-lg">
                      <img
                        src={qrImageUrl}
                        alt={`UPI QR code to pay ₹${amount}`}
                        className="w-56 max-w-full h-auto aspect-square sm:w-64 sm:h-64 object-contain"
                      />
                    </div>
                  ) : (
                    <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-neutral-600 dark:text-neutral-300">
                      Razorpay Checkout is opening with a secure, order-linked UPI QR. If it did not open, use the button below.
                    </div>
                  )}

                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    Open GPay, PhonePe, or Paytm → Scan this QR → Pay exact amount
                  </p>
                </>
              )}
              <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold animate-pulse">
                Waiting for payment confirmation...
              </p>
              {activeDonationId && (
                <p className="text-[10px] text-neutral-400 font-mono">Ref: {activeDonationId.slice(0, 18)}…</p>
              )}
              <p className="text-[10px] text-neutral-500 dark:text-neutral-400">
                Optional Meta advertising measurement: {metaTrackingConsent ? 'allowed' : 'not allowed'} for this payment.
              </p>
            </div>

            {apiError && (
              <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-300 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{apiError}</span>
              </div>
            )}

            <button
              type="button"
              onClick={openRazorpayCheckout}
              className="w-full py-3 rounded-2xl bg-[#002D62] hover:bg-[#0A3D78] text-white font-display font-black text-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              <Zap className="w-4 h-4" />
              {pendingPaymentRef.current?.autoPay
                ? 'Authorize Auto Pay on Razorpay'
                : 'Pay with UPI Apps / Card / NetBanking'}
            </button>

            <button
              type="button"
              onClick={() => {
                cancelPaymentSession();
                setPaymentView('form');
                setQrImageUrl(null);
                setApiError(null);
                setActiveDonationId(null);
                pendingPaymentRef.current = null;
              }}
              className="w-full min-h-11 sm:min-h-0 py-2 text-xs font-bold text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 cursor-pointer"
            >
              ← Edit amount or donor details
            </button>
          </div>
        ) : (
          <div className="min-h-0 min-w-0 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:p-6 space-y-4 overflow-y-auto overscroll-contain">
            <div className="p-3 rounded-2xl bg-orange-50/80 dark:bg-slate-800/80 border border-[#FF6B00]/30 dark:border-slate-700 flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 text-xs">
              <div className="min-w-0">
                <span className="text-[10px] font-black text-[#FF6B00] dark:text-orange-400 uppercase block">Selected Purpose</span>
                <span className="font-bold text-neutral-800 dark:text-white break-words">{causeTitle}</span>
              </div>
              <span className="text-base font-black font-display text-[#FF6B00] dark:text-orange-400 shrink-0">
                ₹{amountLabel}{effectiveAutoPay ? '/mo' : ''}
              </span>
            </div>

            <form onSubmit={handleCompletePayment} className="space-y-2.5">
              <div className="flex items-center gap-1 text-xs font-black text-neutral-800 dark:text-white">
                <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>Donor Details</span>
              </div>

              {apiError && (
                <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-300 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{apiError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 gap-2 text-xs [&>div]:min-w-0 [&_input]:min-w-0 [&_select]:min-w-0">
                <div>
                  <label htmlFor="checkout-donation-amount" className="block text-[11px] font-bold text-neutral-600 dark:text-neutral-400 mb-1">
                    Donation amount (₹) *
                  </label>
                  <input
                    id="checkout-donation-amount"
                    type="number"
                    inputMode="numeric"
                    required
                    min={minimumAmount}
                    max={MAX_DONATION_AMOUNT}
                    step="1"
                    value={amountInput}
                    onChange={(e) => {
                      setAmountInput(e.target.value);
                      setFieldErrors((errors) => ({ ...errors, amount: '' }));
                      setApiError(null);
                    }}
                    aria-invalid={Boolean(fieldErrors.amount)}
                    aria-describedby="checkout-amount-hint checkout-amount-error"
                    className={`w-full px-3 py-2.5 rounded-xl border bg-white dark:bg-slate-800 text-neutral-900 dark:text-white outline-none focus:border-[#FF6B00] text-base sm:text-xs ${fieldErrors.amount ? 'border-red-400' : 'border-slate-300 dark:border-slate-700'}`}
                  />
                  <p id="checkout-amount-hint" className="text-[10px] text-neutral-500 mt-1">{amountErrorMessage}</p>
                  <p id="checkout-amount-error" role="alert" className="text-[10px] text-red-500 mt-0.5">{fieldErrors.amount}</p>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-neutral-600 dark:text-neutral-400 mb-1">{t.donorNameLabel} *</label>
                  <input
                    type="text"
                    required
                    autoComplete="name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Anand Kumar"
                    className={`w-full px-3 py-2.5 rounded-xl border bg-white dark:bg-slate-800 text-neutral-900 dark:text-white outline-none focus:border-[#FF6B00] text-base sm:text-xs ${fieldErrors.fullName ? 'border-red-400' : 'border-slate-300 dark:border-slate-700'}`}
                  />
                  {fieldErrors.fullName && <p className="text-[10px] text-red-500 mt-0.5">{fieldErrors.fullName}</p>}
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-neutral-600 dark:text-neutral-400 mb-1">{t.mobileNumberLabel} *</label>
                  <input
                    type="tel"
                    inputMode="tel"
                    required
                    autoComplete="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 9876543210"
                    className={`w-full px-3 py-2.5 rounded-xl border bg-white dark:bg-slate-800 text-neutral-900 dark:text-white outline-none focus:border-[#FF6B00] text-base sm:text-xs ${fieldErrors.phone ? 'border-red-400' : 'border-slate-300 dark:border-slate-700'}`}
                  />
                  {fieldErrors.phone && <p className="text-[10px] text-red-500 mt-0.5">{fieldErrors.phone}</p>}
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-neutral-600 dark:text-neutral-400 mb-1">{t.emailLabel} *</label>
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="donor@gmail.com"
                    className={`w-full px-3 py-2.5 rounded-xl border bg-white dark:bg-slate-800 text-neutral-900 dark:text-white outline-none focus:border-[#FF6B00] text-base sm:text-xs ${fieldErrors.email ? 'border-red-400' : 'border-slate-300 dark:border-slate-700'}`}
                  />
                  {fieldErrors.email && <p className="text-[10px] text-red-500 mt-0.5">{fieldErrors.email}</p>}
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-neutral-600 dark:text-neutral-400 mb-1">{t.addressLabel} *</label>
                  <input
                    type="text"
                    required
                    autoComplete="street-address"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Your full postal address"
                    className={`w-full px-3 py-2.5 rounded-xl border bg-white dark:bg-slate-800 text-neutral-900 dark:text-white outline-none focus:border-[#FF6B00] text-base sm:text-xs ${fieldErrors.address ? 'border-red-400' : 'border-slate-300 dark:border-slate-700'}`}
                  />
                  {fieldErrors.address && <p className="text-[10px] text-red-500 mt-0.5">{fieldErrors.address}</p>}
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-neutral-600 dark:text-neutral-400 mb-1">{t.panLabel}</label>
                  <input
                    type="text"
                    maxLength={10}
                    value={panNumber}
                    onChange={(e) => setPanNumber(e.target.value.toUpperCase())}
                    placeholder="ABCDE1234F (optional)"
                    className={`w-full px-3 py-2.5 rounded-xl border bg-white dark:bg-slate-800 text-neutral-900 dark:text-white uppercase outline-none focus:border-[#FF6B00] font-mono text-base sm:text-xs ${fieldErrors.panNumber ? 'border-red-400' : 'border-slate-300 dark:border-slate-700'}`}
                  />
                  {fieldErrors.panNumber && <p className="text-[10px] text-red-500 mt-0.5">{fieldErrors.panNumber}</p>}
                </div>

                {isLandingForm && (
                  <div>
                    <label
                      htmlFor="landing-fund-raiser"
                      className="block text-[11px] font-bold text-neutral-600 dark:text-neutral-400 mb-1"
                    >
                      {t.modalFundRaiser}
                    </label>
                    <select
                      id="landing-fund-raiser"
                      value={fundRaiser}
                      onChange={(e) => setFundRaiser(e.target.value)}
                      className={`w-full px-3 py-2.5 rounded-xl border bg-white dark:bg-slate-800 text-neutral-900 dark:text-white outline-none focus:border-[#FF6B00] text-base sm:text-xs ${
                        fieldErrors.fundRaiser ? 'border-red-400' : 'border-slate-300 dark:border-slate-700'
                      }`}
                    >
                      <option value="">{t.modalFundRaiserPlaceholder}</option>
                      {LANDING_FUND_RAISERS.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                    {fieldErrors.fundRaiser && (
                      <p className="text-[10px] text-red-500 mt-0.5">{fieldErrors.fundRaiser}</p>
                    )}
                    <p className="text-[10px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                      Chennai Airport staff only — used in the staff report.
                    </p>
                  </div>
                )}
              </div>

                      {type === 'monthly' && (
                <label
                  htmlFor="monthly-autopay"
                  className="flex items-start gap-3 p-3 rounded-2xl border border-[#002D62]/20 dark:border-blue-800/50 bg-blue-50/70 dark:bg-slate-800/80 cursor-pointer"
                >
                  <input
                    id="monthly-autopay"
                    type="checkbox"
                    checked={effectiveAutoPay}
                    disabled={!supportsAutoPay}
                    onChange={(e) => setAutoPay(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded border-slate-300 text-[#002D62] focus:ring-[#FF6B00] cursor-pointer shrink-0 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                  <span className="min-w-0">
                    <span className="block text-xs font-black text-[#002D62] dark:text-blue-200">
                      {t.modalAutoPayLabel}
                    </span>
                    <span className="block text-[10px] text-neutral-600 dark:text-neutral-400 mt-0.5 leading-relaxed">
                      {supportsAutoPay
                        ? `${t.modalAutoPayHint.replace('{amount}', amountLabel)} Available only for supported preset amounts.`
                        : 'Auto Pay is available only for ₹500, ₹1,000, ₹2,000, ₹3,500, ₹5,000, ₹8,500, ₹12,000, ₹18,000 and ₹22,000. This amount is a one-time payment with monthly intent; it will not be debited automatically.'}
                    </span>
                  </span>
                </label>
              )}

              <div className="p-3 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-1">
                <label htmlFor="checkout-meta-tracking" className="flex items-start gap-3 cursor-pointer">
                  <input
                    id="checkout-meta-tracking"
                    type="checkbox"
                    checked={metaTrackingConsent}
                    onChange={(e) => setMetaTrackingConsent(e.target.checked)}
                    aria-describedby="checkout-meta-tracking-note"
                    className="mt-0.5 w-4 h-4 rounded border-slate-300 text-[#002D62] focus:ring-[#FF6B00] cursor-pointer shrink-0"
                  />
                  <span className="text-[11px] text-neutral-700 dark:text-neutral-300 leading-relaxed">
                    <span className="font-bold">Optional — Meta advertising measurement.</span>{' '}
                    I agree to share my payment amount, hashed email and phone number, and browser identifiers with Meta (Facebook/Instagram) to measure advertising effectiveness.
                  </span>
                </label>
                <p id="checkout-meta-tracking-note" className="pl-7 text-[10px] text-neutral-500 dark:text-neutral-400 leading-relaxed">
                  You can donate without checking this box.{' '}
                  {effectiveAutoPay && 'If selected, this also covers captured recurring payments for this Auto Pay subscription. Contact us to withdraw this optional consent. '}
                  <a href="/privacy" target="_blank" rel="noopener noreferrer" className="underline font-bold">Privacy policy</a>
                </p>
              </div>

              <p className="text-[10px] text-neutral-500 dark:text-neutral-400 leading-relaxed">
                {t.modalPrivacyNote}{' '}
                <button type="button" className="underline font-bold cursor-pointer" onClick={() => window.open('/privacy', '_blank')}>
                  {t.footerPrivacy}
                </button>
              </p>

              <button
                type="submit"
                id="btn-complete-donation"
                className="w-full py-3.5 rounded-2xl bg-[#FF6B00] hover:bg-[#E05300] text-white font-display font-black text-sm sm:text-base flex items-center justify-center gap-2 shadow-lg shadow-orange-500/25 active:scale-98 cursor-pointer mt-2"
              >
                <Zap className="w-4 h-4 fill-white" />
                <span>
                  {effectiveAutoPay
                    ? `Activate Auto Pay · ₹${amountLabel}/mo`
                    : `Pay ₹${amountLabel}${type === 'monthly' ? ' once (monthly intent)' : ''} via Razorpay`}
                </span>
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

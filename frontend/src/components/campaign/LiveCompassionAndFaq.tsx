import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldCheck, ChevronDown, Heart } from 'lucide-react';
import { Donor } from '../../types/campaign';

interface LiveCompassionAndFaqProps {
  onOpenTaxModal: () => void;
}

interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

export const LiveCompassionAndFaq: React.FC<LiveCompassionAndFaqProps> = ({ onOpenTaxModal }) => {
  // Live donor ticker data
  const donorList: { name: string; amount: number; comment: string }[] = [
    {
      name: 'Nandan R.',
      amount: 1000,
      comment:
        'Your contribution directly funds food, medical care, disaster relief kits, and sanctuary operations. We publish impact updates so you can see the difference.',
    },
    {
      name: 'Pooja Deshmukh',
      amount: 2000,
      comment:
        'Sponsoring medical trauma kits for Gaumatas. Praying for fast recovery of all innocent souls in Uttarakhand.',
    },
    {
      name: 'Vikram Singhania',
      amount: 5000,
      comment:
        'Transparent and selfless ground work. Proud to support Punyakart Foundation’s relief work.',
    },
    {
      name: 'Ananya Roy',
      amount: 1500,
      comment:
        'Every small help brings big change. Blessings to the rescue team working day and night.',
    },
  ];

  const [activeDonorIndex, setActiveDonorIndex] = useState<number>(0);

  // Auto rotate donors every 6 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveDonorIndex((prev) => (prev + 1) % donorList.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [donorList.length]);

  const activeDonor = donorList[activeDonorIndex];

  // FAQs matching the 3 items in the PDF
  const faqs: FaqItem[] = [
    {
      id: 'faq-1',
      question: 'Will I get an 80G tax receipt?',
      answer:
        'Yes! Punyakart Foundation is an officially registered non-profit under Section 80G of the Income Tax Act (Reg: AAPCP5662BF20251). An instant 80G Tax Exemption Certificate with QR verification is generated immediately upon donation, entitling you to a 50% tax deduction.',
    },
    {
      id: 'faq-2',
      question: 'Can I donate from outside India?',
      answer:
        'Yes, we accept contributions from anywhere in the world using international credit/debit cards, netbanking, and global gateways. Note that 80G tax exemption certificates apply to Indian income tax returns.',
    },
    {
      id: 'faq-3',
      question: 'Is my online transaction safe?',
      answer:
        '100% safe and secure. All transactions are protected by bank-grade 256-bit SSL encryption through PCI-DSS Level 1 certified payment gateways including Razorpay, UPI, RuPay, and Cashfree. No card details are ever stored.',
    },
  ];

  // Accordion state
  const [openFaqId, setOpenFaqId] = useState<string | null>(null);

  const toggleFaq = (id: string) => {
    setOpenFaqId((prev) => (prev === id ? null : id));
  };

  return (
    <section id="faq-compassion" className="py-8 sm:py-12 bg-white border-b border-slate-200/80">
      <div className="max-w-md sm:max-w-lg md:max-w-xl mx-auto px-3.5 sm:px-4">
        
        {/* Rounded Card Container matching PDF */}
        <div className="bg-[#F8FAFC] border border-slate-200 rounded-3xl p-4 sm:p-5 shadow-xs">
          
          {/* Top Header: Live Compassion Board + 80G Badge */}
          <div className="flex items-start justify-between gap-2 pb-3.5 border-b border-slate-200/80">
            <div>
              <div className="flex items-center gap-1.5">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                </span>
                <span className="font-display font-black text-xs sm:text-sm text-[#0B1B2B]">
                  Live compassion board
                </span>
              </div>
              <p className="text-[10px] sm:text-xs text-slate-500 mt-0.5">
                Real donations coming in right now
              </p>
            </div>

            {/* 80G Pill Badge */}
            <button
              type="button"
              onClick={onOpenTaxModal}
              className="inline-flex items-center gap-1 bg-emerald-50 border border-emerald-300 text-emerald-800 px-2.5 py-1 rounded-full text-[10px] sm:text-[11px] font-bold hover:bg-emerald-100 transition-colors cursor-pointer flex-shrink-0"
            >
              <ShieldCheck className="w-3 h-3 text-emerald-600 flex-shrink-0" />
              <span>80G Tax-Exempt</span>
            </button>
          </div>

          {/* Active Donor Box (Matching Nandan R. item in PDF) */}
          <div 
            onClick={() => setActiveDonorIndex((prev) => (prev + 1) % donorList.length)}
            className="py-3.5 border-b border-slate-200/80 cursor-pointer select-none group"
            title="Tap to see next live donor"
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={activeDonor.name}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.3 }}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs sm:text-sm text-[#0B1B2B]">
                      {activeDonor.name}
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium">
                      ({activeDonorIndex + 1}/{donorList.length})
                    </span>
                  </div>
                  <span className="font-display font-extrabold text-xs sm:text-sm text-[#FF6B00]">
                    ₹{activeDonor.amount.toLocaleString()}
                  </span>
                </div>
                <p className="text-[11px] sm:text-xs text-slate-600 leading-relaxed">
                  {activeDonor.comment}
                </p>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* 3 FAQ Accordion Rows */}
          <div className="pt-2 space-y-1">
            {faqs.map((faq) => {
              const isOpen = openFaqId === faq.id;
              return (
                <div key={faq.id} className="border-b border-slate-200/70 last:border-b-0">
                  <button
                    type="button"
                    onClick={() => toggleFaq(faq.id)}
                    className="w-full py-3 flex items-center justify-between gap-3 text-left cursor-pointer group"
                    aria-expanded={isOpen}
                  >
                    <span className="font-bold text-xs sm:text-[13px] text-[#0B1B2B] group-hover:text-[#FF6B00] transition-colors">
                      {faq.question}
                    </span>
                    <motion.div
                      animate={{ rotate: isOpen ? 180 : 0 }}
                      transition={{ duration: 0.2 }}
                      className="text-slate-400 group-hover:text-slate-700 flex-shrink-0"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </motion.div>
                  </button>

                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25, ease: 'easeInOut' }}
                        className="overflow-hidden"
                      >
                        <p className="pb-3 text-xs text-slate-600 leading-relaxed pr-2">
                          {faq.answer}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>

        </div>

      </div>
    </section>
  );
};

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { CampaignContent } from '../../types/campaignCms';

export const FaqSection: React.FC<{ content?: CampaignContent; faqs?: Array<{ question: string; answer: string }> }> = ({ content, faqs: customFaqs }) => {
  // First item open by default as shown in the screenshot
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs = customFaqs?.length ? customFaqs.map((faq) => ({ q: faq.question, a: faq.answer })) : [
    {
      q: 'How is my donation utilized?',
      a: 'Your contribution directly funds food, medical care, disaster relief kits, and sanctuary operations. We publish impact updates so you can see the difference.',
    },
    {
      q: 'Will I get an 80G tax receipt?',
      a: 'Yes, every donor receives an instant 80G Tax Exemption Certificate with official registration number (80G: AAPCP5662BF20251), allowing you to claim a 50% tax deduction on your taxable income under Section 80G of the Indian Income Tax Act.',
    },
    {
      q: 'Can I donate from outside India?',
      a: 'Yes! We warmly welcome international devotees and gausevaks. We accept contributions in USD, EUR, and AED via international debit/credit cards with instant transaction confirmations.',
    },
    {
      q: 'Is my online transaction safe?',
      a: 'Absolutely. All donations are handled through 256-bit encrypted bank-grade payment channels (PhonePe, Google Pay, Paytm, BHIM, UPI, and major banks) with zero card data stored on our servers.',
    },
  ];

  const toggleFaq = (idx: number) => {
    setOpenIndex((curr) => (curr === idx ? null : idx));
  };

  return (
    <section id="faq" className="py-4 sm:py-7 bg-[#F4F7FA] border-b border-slate-200/80">
      <div className="max-w-4xl lg:max-w-5xl mx-auto px-4 sm:px-6">
        
        {/* Main FAQ White Card Container matching Screenshot 3 */}
        <div className="bg-white rounded-3xl p-5 sm:p-8 border border-slate-200/80 shadow-sm">
          
          {/* Header with Orange Question Circle Icon */}
          <div className="flex items-center gap-2.5 mb-6">
            <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full border-2 border-[#FF6B00] flex items-center justify-center text-[#FF6B00] text-xs sm:text-sm font-extrabold flex-shrink-0">
              ?
            </div>
            <h2 className="font-display font-black text-xl sm:text-2xl text-[#002D62] tracking-tight">
              {content?.faq_title || 'Frequently asked questions'}
            </h2>
          </div>

          {/* Accordion List */}
          <div className="space-y-3">
            {faqs.map((faq, idx) => {
              const isOpen = openIndex === idx;
              return (
                <div
                  key={idx}
                  className="bg-[#F4F7FA] rounded-xl sm:rounded-2xl border border-slate-200/70 transition-all duration-200 overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => toggleFaq(idx)}
                    className="w-full text-left px-4 sm:px-5 py-3.5 sm:py-4 flex items-center justify-between gap-4 cursor-pointer hover:bg-slate-100/60 transition-colors"
                  >
                    <span className="font-display font-bold text-xs sm:text-sm md:text-base text-[#002D62]">
                      {faq.q}
                    </span>
                    <span className="flex-shrink-0">
                      {isOpen ? (
                        <ChevronUp className="w-4 h-4 text-[#FF6B00] stroke-[2.5]" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-400 stroke-[2.5]" />
                      )}
                    </span>
                  </button>

                  <AnimatePresence>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: "easeInOut" }}
                        className="overflow-hidden"
                      >
                        <div className="px-4 sm:px-5 pb-4 pt-1 text-xs sm:text-sm text-slate-600 leading-relaxed">
                          {faq.a}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>

        </div>

        {/* Quote Banner directly below the card matching Screenshot 3 */}
        <div className="mt-5 bg-[#FFF0E6] border border-[#FFD9BE] rounded-2xl p-4 sm:p-5 text-center shadow-2xs">
          <h3 className="font-display font-black text-base sm:text-lg text-[#002D62] tracking-tight mb-1">
            {content?.faq_quote_title || 'Help a Life in Need'}
          </h3>
          <p className="font-display font-medium text-xs sm:text-sm text-slate-600 leading-relaxed">
            {content?.faq_quote_description || 'Your kindness can give an injured animal a second chance'}
          </p>
        </div>

      </div>
    </section>
  );
};

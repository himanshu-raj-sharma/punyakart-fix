import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { navigate } from '../navigation';
import { Language } from '../types';
import { translations } from '../data/content';

type LegalKind = 'privacy' | 'terms' | 'refund';

const fullCopy: Record<LegalKind, { updated: string; body: string[] }> = {
  privacy: {
    updated: '10 October 2026',
    body: [
      'Punyakart Foundation collects donor name, email, mobile number, address, PAN (optional), donation amount, and payment identifiers so we can process donations, issue 80G certificates, and send receipts.',
      'This information is processed under the Digital Personal Data Protection Act, 2023, based on your consent at checkout. We do not sell donor data. Payment card details are handled by Razorpay, not stored on our servers.',
      'You may email info@punyakart.com to request access, correction, or deletion of your personal data, except records we must retain for tax and audit purposes (typically donation receipts and 80G certificates).',
      'We use session storage for the staff admin key on /admin and for a short-lived, first-party arrival summary in the current browser tab. Public 80G lookup requires a receipt number, transaction ID, donation ID, or Razorpay payment/order ID.',
      'Arrival reporting helps us understand how donors find our campaigns. We retain the latest meaningful external or campaign-tagged arrival for up to 30 minutes in this tab, using memory if session storage is unavailable. At checkout, a copy is saved with the donation for our internal reporting. This summary uses allowlisted campaign labels (UTM source, medium, campaign and content), an external referring hostname, a public landing path, a capture time, and only the presence of supported advertising click parameters.',
      'This arrival summary does not collect donor contact details, full URLs, full query strings, URL fragments, or raw advertising click IDs. It creates no cookies, sends no third-party requests, uses no local storage, and creates no persistent cross-visit visitor profile. Campaign labels and referrers can be missing or incorrect: attribution is best-effort, not verified identity or proof of paid advertising. Direct / unknown means a captured visit had no usable source evidence; Unknown / not recorded means no arrival summary was available.',
      'We use Microsoft Clarity to understand how visitors use the site through aggregate analytics, session recordings, and interaction data such as clicks, scrolling, and page navigation. Clarity may use cookies or similar browser storage and may process device, browser, and usage information. This service is used to improve site usability and is subject to Microsoft\'s privacy terms. Do not enter payment-card details or other sensitive information into free-text fields while using the site.',
      'Optional Meta advertising measurement: checkout includes a separate, unchecked choice. You can donate without selecting it. If you opt in, after your payment is verified as captured we may share a Purchase event with Meta (Facebook/Instagram) through its Conversions API and the corresponding checkout Pixel. This helps attribute donations to advertising and measure and improve our fundraising advertisements.',
      'For an Auto Pay subscription, selecting this choice also covers its future captured recurring payments until you withdraw consent. We do not replay the original browser cookies or browser information for later automatic charges. Contact info@punyakart.com to withdraw this optional subscription sharing without cancelling your donation.',
      'This optional sharing includes the payment amount and currency, a donation event ID, hashed email and phone number, available Meta browser identifiers (_fbp and _fbc cookies), browser information, and the page origin and path without its query string or fragment. Hashing is not anonymisation: Meta may match the hashes and browser identifiers to its users. We do not send your postal address, PAN, or payment card details through this optional checkout event.',
      'Leave the optional box unchecked to decline this checkout sharing. The choice applies to the payment session and resets when you close and reopen checkout. To withdraw consent for future sharing or ask about information already shared, contact info@punyakart.com; withdrawal cannot undo events already sent. This choice controls the optional checkout integration, not existing sitewide Meta PageView tracking or other existing integrations.',
    ],
  },
  terms: {
    updated: '5 September 2026',
    body: [
      'By donating on punyakart.com you confirm that you are legally able to make a voluntary contribution to Punyakart Foundation for animal welfare.',
      'Monthly Giving with Activate Auto Pay (preset amounts) creates a Razorpay subscription: you authorize mandate + pay today, then Razorpay auto-debits each month. Cancel anytime via info@punyakart.com. Without Auto Pay (or for custom amounts), the payment is a one-time monthly-intent gift only.',
      '80G certificates are issued only after payment is captured (or after staff confirm an offline donation). Placeholder registration numbers are not valid for ITR filing.',
      'The site is provided as-is for fundraising. Contact info@punyakart.com for questions about a donation or certificate.',
    ],
  },
  refund: {
    updated: '5 September 2026',
    body: [
      'Donations are generally non-refundable because they are used for animal care immediately after verification.',
      'If you were charged in error, duplicate-charged, or a payment was captured without your consent, email info@punyakart.com with the Razorpay payment ID or receipt number within 7 days. We will review gateway records and, where appropriate, process a refund through Razorpay.',
      'Refunded donations are marked refunded and are not valid for 80G / ITR claims. Please do not file a certificate for a refunded payment.',
    ],
  },
};

export const LegalPage: React.FC<{ kind: LegalKind; language: Language }> = ({ kind, language }) => {
  const t = translations[language];
  const page = fullCopy[kind];
  const title =
    kind === 'privacy' ? t.legalPrivacyTitle : kind === 'terms' ? t.legalTermsTitle : t.legalRefundTitle;
  const summary =
    kind === 'privacy'
      ? t.legalPrivacySummary
      : kind === 'terms'
        ? t.legalTermsSummary
        : t.legalRefundSummary;

  return (
    <div className="public-page min-h-screen text-neutral-900 dark:text-neutral-50">
      <div className="max-w-3xl mx-auto px-4 py-5 sm:py-7 space-y-4">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-[#002D62] dark:text-blue-300 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          {t.legalBack}
        </button>
        <h1 className="font-display font-black text-2xl">{title}</h1>
        <p className="text-xs text-neutral-500">
          {t.legalUpdated} {page.updated}
        </p>
        <p className="text-sm font-semibold text-neutral-800 dark:text-neutral-200 leading-relaxed">{summary}</p>
        {page.body.map((paragraph) => (
          <p key={paragraph.slice(0, 24)} className="text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
            {paragraph}
          </p>
        ))}
      </div>
    </div>
  );
};

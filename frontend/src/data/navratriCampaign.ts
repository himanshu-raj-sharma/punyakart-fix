export const NAVRATRI_CAMPAIGN_ID = 'c7';
export const NAVRATRI_CAMPAIGN_PATH = '/campaigns/navratri';
export const NAVRATRI_DONATION_SOURCE = 'campaign_c7';

/** Shared seed/display content. Keep this module free of browser and asset imports. */
export const NAVRATRI_DEFAULT_CAMPAIGN = {
  id: NAVRATRI_CAMPAIGN_ID,
  title: 'This Navratri, Your Donation Can Give a Voiceless Life a Second Chance.',
  category: 'Faith',
  organizer: 'Punyakart Foundation',
  // Zero means no fundraising goal has been configured.
  target: 0,
  image: '/navratri-hero.jpg',
  description: 'Celebrate Navratri with compassion. Your contribution supports Punyakart Foundation’s food and care initiatives, bringing the spirit of giving into everyday acts of kindness.',
  sort_order: 7,
  has_tax_benefit: false,
  is_active: true,
  donation_presets: [501, 1001, 2100, 5100],
  content: {
    hero_title: 'THIS NAVRATRI, LET YOUR DEVOTION BECOME THEIR HOPE',
    hero_subtitle: 'While we seek Maa Durga’s blessings, 1,400 voiceless souls are waiting for food, care, and protection. They cannot ask for help. They cannot express their pain in words. But every hungry cow, every injured animal, and every helpless life deserves a chance to live with dignity and love.',
    contribution_heading: 'Give with Compassion. Support food and care initiatives.',
    contribution_subtitle: 'Your contribution can support the foundation’s ongoing food and care work during Navratri.',
    about_eyebrow: 'The spirit of seva',
    about_title: 'This Navratri, let your Seva become their strength.',
    about_banner_title: 'GIVE WITH COMPASSION',
    about_banner_description: 'Your contribution can help provide green fodder to hungry cows, treatment to injured animals, and shelter to those who have nowhere else to go.',
    seva_sankalp_text: '🪔 Worship Maa Durga through compassion.\n🐄 Feed the hungry.\n🐾 Protect the voiceless.\n❤️ Give hope to 1,400 lives.\nDonate today. Because for them, your kindness is not just a donation — it is hope, care, and a reason to live.\n🙏 Jai Mata Di | Jai Gau Mata 🙏',
    faq_title: 'A little more about giving',
    allocation_rows: [
      { amount: '₹200', purpose: 'A meaningful contribution towards foundation food and care initiatives.' },
      { amount: '₹501', purpose: 'Support practical nourishment and daily care work.' },
      { amount: 'Custom Amount', purpose: 'Offer Navratri Seva according to your श्रद्धा & capacity.' },
    ],
  },
  faqs: [
    {
      question: 'What does my Navratri contribution support?',
      answer: 'Your contribution supports Punyakart Foundation’s food and care initiatives. It is a contribution towards this work, not a guarantee of a particular item, quantity or outcome.',
    },
    {
      question: 'Can I choose my own donation amount?',
      answer: 'Yes. Choose a suggested amount or enter a whole-rupee amount from ₹200 to ₹1,00,00,000.',
    },
    {
      question: 'Is the Navratri photo artwork a photograph from an event?',
      answer: 'No. The supplied Navratri photo artwork is campaign artwork used to illustrate the spirit of compassionate care; it is not presented as a photograph of a particular event.',
    },
  ],
};

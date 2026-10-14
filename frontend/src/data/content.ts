import { ImpactItem, RecentDonor, RescueStory, Language } from '../types';
import { localePacks } from './localePacks';
import { SITE_LANGUAGES } from './languages';

/** UI copy with English fallback for any missing keys in a language pack. */
export const translations = Object.fromEntries(
  SITE_LANGUAGES.map((lang) => [
    lang.id,
    { ...localePacks.en, ...localePacks[lang.id] },
  ]),
) as Record<Language, Record<string, string>>;

// 8 Official Donation Sponsorship Cards with authentic, original cow photography
export const impactItems: ImpactItem[] = [
  {
    id: 'impact-22000',
    amount: 22000,
    monthlyAmount: 22000,
    title: {
      en: 'Save a Life - Sponsor an Urgent Surgery for an Injured Cow',
      ta: 'உயிர் காக்கும் அறுவை சிகிச்சை - காயமடைந்த பசுவுக்கு அவசர ஆபரேஷன்',
      hi: 'Save a Life - Sponsor an Urgent Surgery for an Injured Cow',
    },
    description: {
      en: 'Complete emergency orthopaedic surgery, bone pinning, surgeon fee, anaesthesia, and post-operative ICU care.',
      ta: 'அவசர அறுவை சிகிச்சை, மயக்க மருந்து, எலும்பு முறிவு சிகிச்சை மற்றும் தீவிர சிகிச்சைக்கான முழு செலவு.',
      hi: 'सड़क दुर्घटना में गंभीर फ्रैक्चर सर्जरी, ऑपरेशन थिएटर, विशेषज्ञ डॉक्टर व 1 माह का पोस्ट-ऑपरेटिव आईसीयू केयर।',
    },
    impactPill: {
      en: 'Critical Lifesaving Surgery & Rehabilitation',
      ta: 'அவசர அறுவை சிகிச்சை மற்றும் மறுவாழ்வு',
      hi: 'गंभीर फ्रैक्चर सर्जरी व 1 माह का रिहैबिलिटेशन',
    },
    badge: 'Critical Surgery',
    image: '/impact1.jpeg',
    iconName: 'Sparkles',
  },
  {
    id: 'impact-18000',
    amount: 18000,
    monthlyAmount: 18000,
    title: {
      en: 'Life Saving Medical Care',
      ta: 'உயிர் காக்கும் மருத்துவ சிகிச்சை',
      hi: 'Life Saving Medical Care',
    },
    description: {
      en: 'Specialist veterinary emergency care, daily IV drips, heavy antibiotics, lab blood tests, and specialized wound healing.',
      ta: 'சிறப்பு கால்நடை மருத்துவ சிகிச்சை, சலைன் ட்ரிப், மருந்துகள் மற்றும் ஆய்வக பரிசோதனைகள்.',
      hi: '24 घंटे क्रिटिकल केयर वार्ड में निरंतर मॉनिटरिंग, आईवी फ्लूइड्स, हाई-डोज़ एंटीबायोटिक्स व टेस्ट।',
    },
    impactPill: {
      en: 'Comprehensive 15-Day Critical Inpatient Care',
      ta: '15 நாட்கள் தீவிர உள்நோயாளி சிகிச்சை',
      hi: '15 दिनों की संपूर्ण इन-पेशेंट चिकित्सा व दवाएं',
    },
    badge: 'Intensive Care',
    image: '/impact2.jpeg',
    iconName: 'ShieldAlert',
  },
  {
    id: 'impact-12000',
    amount: 12000,
    monthlyAmount: 12000,
    title: {
      en: 'Rescue and Recovery Care',
      ta: 'மீட்பு மற்றும் குணமடைதல் பராமரிப்பு',
      hi: 'Rescue and Recovery Care',
    },
    description: {
      en: 'Hydraulic ambulance rescue dispatch, wound debridement, regular medical dressings, and safe shelter admission.',
      ta: 'அவசர ஆம்புலன்ஸ் மீட்பு, காயம் ஆற்றுதல் மற்றும் பாதுகாப்பான தங்குமிடம்.',
      hi: 'सड़क से एम्बुलेंस द्वारा रेस्क्यू, घावों की नियमित मरहम-पट्टी, पोषण युक्त आहार व सुरक्षित आश्रय।',
    },
    impactPill: {
      en: 'Ambulance Rescue & Full Recovery Shelter Care',
      ta: 'ஆம்புலன்ஸ் மீட்பு மற்றும் முழுமையான சிகிச்சை',
      hi: 'एम्बुलेंस रेस्क्यू व पूर्ण स्वस्थ होने तक शेल्टर केयर',
    },
    badge: 'Rescue Mission',
    image: '/impact3.jpeg',
    iconName: 'HeartHandshake',
  },
  {
    id: 'impact-8500',
    amount: 8500,
    monthlyAmount: 8500,
    title: {
      en: 'Treatment',
      ta: 'மருத்துவ சிகிச்சை',
      hi: 'Treatment',
    },
    description: {
      en: 'Specialized therapy, maggot wound healing courses, skin infection cures, anti-rabies and multi-vitamin shots.',
      ta: 'புழுக்கள் பிடித்த காயங்கள் மற்றும் தோல் நோய்களுக்கான முழு சிகிச்சை.',
      hi: 'कीड़ों वाले गहरे घावों की ड्रेसिंग, स्किन इन्फेक्शन, एंटी-रेबीज इंजेक्शन और दर्द निवारक दवाइयां।',
    },
    impactPill: {
      en: 'Complete Treatment for 5 Severe Wound Cases',
      ta: '5 காயமடைந்த பசுக்களுக்கு முழு சிகிச்சை',
      hi: '5 गंभीर घायल गौवंश का संपूर्ण उपचार',
    },
    badge: 'Specialized Cure',
    image: '/impact4.jpeg',
    iconName: 'Award',
  },
  {
    id: 'impact-5000',
    amount: 5000,
    monthlyAmount: 5000,
    title: {
      en: 'Emergency Treatment',
      ta: 'அவசர சிகிச்சை',
      hi: 'Emergency Treatment',
    },
    description: {
      en: 'Immediate spot medical intervention, accident trauma stabilization, tetanus/painkiller injections, and antiseptic wash.',
      ta: 'உடனடி விபத்து சிகிச்சை, வலி நிவாரணி மற்றும் அவசர மருந்துகள்.',
      hi: 'तत्काल ऑन-स्पॉट दुर्घटना उपचार, पेनकिलर व एंटी-टिटनेस इंजेक्शन, एंटीसेप्टिक वाश व राहत।',
    },
    impactPill: {
      en: 'Immediate Trauma Stabilization for 3 Cows',
      ta: '3 பசுகளுக்கான உடனடி அவசர சிகிச்சை',
      hi: '3 घायल गौवंश को त्वरित आपातकालीन इलाज',
    },
    badge: 'Most Given',
    popular: true,
    image: '/impact5.jpeg',
    iconName: 'Zap',
  },
  {
    id: 'impact-3500',
    amount: 3500,
    monthlyAmount: 3500,
    title: {
      en: 'Daily Medicine for Cows',
      ta: 'பசுகளுக்கான தினசரி மருந்துகள்',
      hi: 'Daily Medicine for Cows',
    },
    description: {
      en: 'Essential pharmacy supply including bandages, betadine, ointments, calcium syrups, digestive tonics, and pain relief.',
      ta: 'தினசரி அத்தியாவசிய மருந்துகள், கட்டுகள் மற்றும் டானிக்குகள்.',
      hi: 'दैनिक शेल्टर डिस्पेंसरी की दवाइयां, बीटाडीन, गॉज रोल, कैल्शियम सिरप व लिवर टॉनिक।',
    },
    impactPill: {
      en: '1 Week Essential Medical Pharmacy Supplies',
      ta: '1 வாரத்திற்கான மருத்துவ மருந்துகள்',
      hi: 'पूरे शेल्टर की 1 सप्ताह की प्राथमिक दवाइयां',
    },
    badge: 'Daily Pharmacy',
    image: '/wa-image-1.jpeg',
    iconName: 'ShieldAlert',
  },
  {
    id: 'impact-2000',
    amount: 2000,
    monthlyAmount: 2000,
    title: {
      en: 'Help to Feed 8 Animals',
      ta: '8 விலங்குகளுக்கு உணவு உதவி',
      hi: 'Help to Feed 8 Animals',
    },
    description: {
      en: '₹500 feeds 1 animal for 1 day. ₹2,000 provides fresh fodder, straw, and water for 8 rescued animals.',
      ta: '₹500 = 1 விலங்குக்கு 1 நாள் உணவு. ₹2,000 8 விலங்குகளுக்கு 1 நாள் உணவு.',
      hi: '₹500 = 1 पशु का 1 दिन का आहार। ₹2,000 से 8 आश्रित पशुओं को 1 दिन का चारा-पानी।',
    },
    impactPill: {
      en: '₹500/animal/day • Feeds 8 animals for one day',
      ta: '₹500 = 1 நாள் உணவு • 8 விலங்குகள்',
      hi: '₹500 प्रति पशु/दिन • 8 पशुओं का 1 दिन का आहार',
    },
    badge: 'Feed 8 Souls',
    image: '/wa-image-2.jpeg',
    iconName: 'Utensils',
  },
  {
    id: 'impact-1000',
    amount: 1000,
    monthlyAmount: 1000,
    title: {
      en: 'Help to Feed 4 Animals',
      ta: '4 விலங்குகளுக்கு உணவு உதவி',
      hi: 'Help to Feed 4 Animals',
    },
    description: {
      en: '₹500 feeds 1 animal for 1 day. ₹1,000 provides daily fodder and nourishing feed for 4 animals.',
      ta: '₹500 = 1 விலங்குக்கு 1 நாள் உணவு. ₹1,000 4 விலங்குகளுக்கு 1 நாள் உணவு.',
      hi: '₹500 = 1 पशु का 1 दिन का आहार। ₹1,000 से 4 पशुओं को 1 दिन का चारा।',
    },
    impactPill: {
      en: '₹500/animal/day • Feeds 4 animals for one day',
      ta: '₹500 = 1 நாள் உணவு • 4 விலங்குகள்',
      hi: '₹500 प्रति पशु/दिन • 4 पशुओं का 1 दिन का आहार',
    },
    badge: 'Feed 4 Souls',
    image: '/wa-image-3.jpeg',
    iconName: 'Utensils',
  },
];

// Presets as requested by user
export const oneTimePresetAmounts = [22000, 18000, 12000, 8500, 7500, 5000, 3500, 2000, 1000];
export const monthlyPresetAmounts = [22000, 18000, 12000, 8500, 5000, 3500, 2000, 1000, 500];

// Shelter Census Counts with authentic high-resolution real photography (no cartoons, no artificial slop)
export const shelterCensus = {
  totalResidents: 1187,
  cows: 1140,
  calves: 5,
  bulls: 6,
  oxen: 2,
  injuredCows: 23,
  rescuedCalves: 3,
  oldCows: 5,
  blindCows: 3,
  underTreatment: 54,
};

export const siteImages = {
  hero: '/hero.jpeg',
};

export const authenticCowPhotos = {
  cows: '/wa-image-4.jpeg',
  calves: '/wa-image-5.jpeg',
  bulls: '/wa-image-6.jpeg',
  oxen: '/wa-image-7.jpeg',
  injuredCows: '/wa-image-8.jpeg',
  rescuedCalves: '/impact1.jpeg',
  oldCows: '/impact2.jpeg',
  blindCows: '/impact3.jpeg',
  criticalTreatment: '/impact4.jpeg',
};

export const recentDonorsSample: RecentDonor[] = [
  { id: '1', name: 'Anand Kumar', amount: 5000, location: 'Rajpur Road, Dehradun', timeAgo: '2 mins ago', cause: 'Emergency Treatment' },
  { id: '2', name: 'Dr. Radhika M.', amount: 2000, location: 'Govind Garh, Dehradun', timeAgo: '6 mins ago', cause: 'Help to Feed 20 Cows' },
  { id: '3', name: 'S. Venkatesh & Family', amount: 22000, location: 'Ballupur Chowk, Dehradun', timeAgo: '14 mins ago', cause: 'Urgent Surgery Fund' },
  { id: '4', name: 'Deepa Sundaram', amount: 3500, location: 'Chakrata Road, Dehradun', timeAgo: '22 mins ago', cause: 'Daily Medicine' },
  { id: '5', name: 'Captain Rajesh Varma', amount: 18000, location: 'Dalanwala, Dehradun', timeAgo: '30 mins ago', cause: 'Life Saving Medical Care' },
  { id: '6', name: 'Amit Sharma', amount: 1000, location: 'Sahastradhara, Dehradun', timeAgo: '45 mins ago', cause: 'Help to Feed 10 Cows' },
];

export const airportFAQs = [
  {
    question: 'How do I get my 80G Tax Exemption Certificate?',
    answer: 'Verified donations to Punyakart Foundation are eligible for 50% deduction under Section 80G once our official registration numbers are printed on your certificate. The certificate is generated after payment is captured. Download it anytime from the 80G portal using your receipt number (PKF-), transaction ID (TXN), donation ID, or Razorpay payment ID.',
  },
  {
    question: 'Where is the cow sanctuary located and can we visit?',
    answer: 'Our main sanctuary and cow hospital is in Dehradun (Registered Office: 59/22, Near SBI Bank, Moti Bazar, Dehradun - 248001). Donors and well-wishers are warmly welcome to visit the cows, see daily feeding, and interact with the veterinary care team.',
  },
  {
    question: 'How does the Monthly Lifesaver Subscription work?',
    answer: 'Choose Monthly Giving and tick Activate Auto Pay (preset amounts only). Razorpay opens so you can authorize UPI Autopay / card mandate and pay today’s amount. Next months are auto-debited; each successful charge gets its own 80G/receipt. Custom amounts still work as one-time monthly gifts if you uncheck Auto Pay. Contact the foundation anytime to cancel.',
  },
  {
    question: 'How are my contributions utilized?',
    answer: '100% of public donations directly fund cow fodder, nutritional feed, emergency ambulance fuel, life-saving surgeries, veterinary doctor fees, and hospital medicines for the 1,187+ sanctuary residents and 54 critical trauma patients.',
  },
];

export const rescueStories: RescueStory[] = [
  {
    id: 'story-nandi',
    name: 'Gauri & Nandi (Highway Accident Recovery)',
    daysInShelter: 'Rescued & Fully Healed',
    beforeImage: '/wa-image-1.jpeg',
    afterImage: '/wa-image-2.jpeg',
    story: 'Rescued from a severe highway collision with deep fracture trauma. After 45 days of daily splint dressings, calcium drips, and round-the-clock veterinary attention, Gauri and her calf now live peacefully in the permanent green meadow.',
  },
  {
    id: 'story-bhola',
    name: 'Bhola (Abandoned Disabled Dog)',
    daysInShelter: 'Healthy Resident',
    beforeImage: '/wa-image-3.jpeg',
    afterImage: '/wa-image-4.jpeg',
    story: 'Found abandoned near a dumpster suffering from severe maggot wounds and malnutrition. With complete antiseptic washes, nourishing porridge, and loving foster shelter care, Bhola has made a joyous, 100% recovery.',
  },
];

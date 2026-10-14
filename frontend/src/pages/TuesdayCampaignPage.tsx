import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  Sparkles,
  ShieldCheck,
  Lock,
  ArrowRight,
  Check,
  Plus,
  Minus,
  Heart,
  ChevronDown,
  Gift,
  Calendar,
  Users,
  Award,
  HelpCircle,
  Clock,
  Image as ImageIcon
} from 'lucide-react';
import tuesdayHeroImg from '../assets/images/regenerated_image_1790524556850.jpg';
import c6HeroBanner from '../assets/campaigns/c6-hero.jpg';
import { resolveCampaignImage } from '../components/campaign/campaignImages';
import { allocationMaterialsFromProducts, WhereYourMoneyGoes } from '../components/campaign/WhereYourMoneyGoes';
import greenGrassImg from '../assets/campaigns/green_grass.png';
import birthdayCard1 from '../assets/campaigns/birthday-card-1.png';
import birthdayCard2 from '../assets/campaigns/birthday-card-2.png';
import birthdayCard3 from '../assets/campaigns/birthday-card-3.png';
import birthdayCard4 from '../assets/campaigns/birthday-card-4.png';
import dryGrassImg from '../assets/campaigns/dry_grass.png';
import cowFoodImg from '../assets/campaigns/cow_food.png';
import medicalKitImg from '../assets/campaigns/medical_kit.png';
import calfStoryImg from '../assets/campaigns/story_calf_rescue.jpg';
import monkeyStoryImg from '../assets/campaigns/story_monkeys_fruit.jpg';
import gauSevaStoryImg from '../assets/campaigns/story_feed_cows.jpg';
import monkeyFruitImg from '../assets/campaigns/story_monkeys_fruit.jpg';
import gauSevaAboutShelterImg from '../assets/campaigns/gau-seva-about-cow-shelter.png';
import gauSevaAboutCareImg from '../assets/campaigns/gau-seva-about-cow-care.png';
import gauSevaAboutFeedingImg from '../assets/campaigns/gau-seva-about-cow-feeding.png';
import gauSevaGreenGrassImg from '../assets/campaigns/gau-seva-green-grass.jpg';
import gauSevaFodderImg from '../assets/campaigns/gau-seva-fodder.png';
import gauSevaMedicineKitImg from '../assets/campaigns/gau-seva-medicine-kit.png';
import gauSevaVegetablesImg from '../assets/campaigns/gau-seva-vegetables.png';
import aboutCard1 from '../assets/campaigns/about-card-1.jpg';
import aboutCard2 from '../assets/campaigns/about-card-2.jpg';
import aboutCard3 from '../assets/campaigns/about-card-3.jpg';
import { CURRENCIES } from '../data/campaigns';
import { NAVRATRI_DEFAULT_CAMPAIGN } from '../data/navratriCampaign';
import { DONATION_AMOUNT_ERROR, isValidDonationAmount, MAX_DONATION_AMOUNT, MIN_DONATION_AMOUNT, parseDonationAmount } from '../constants/donation';
import type { Currency, DonationCartItem, ProductItem } from '../types/campaign';
import { useRecentDonations } from '../hooks/useRecentDonations';
import { usePublicCampaign } from '../hooks/usePublicCampaign';
import { campaignDonationAvailable, campaignAvailabilityMessage } from '../utils/publicCampaignPolling';
import { resolveCampaignQuantityChange } from '../utils/campaignQuantity.js';
import { canonicalCampaignId } from '../utils/campaignRoutes';
import { donorFeedMessage, formatRelativeTime, publicStat } from '../utils/publicDonations';

interface TuesdayCampaignPageProps {
  onOpenCheckout: (amount: number, causeTitle?: string) => void;
  onOpen80GSearch: () => void;
  campaignId?: string;
}

interface RescueCard {
  id: string;
  image?: string;
  line1: string;
  line2: string;
  line3: string;
  supportAmount: number;
}

const RESCUE_CARDS: RescueCard[] = [
  {
    id: 'story-1',
    image: calfStoryImg,
    line1: 'Weak & Abandoned,',
    line2: 'Now Safely Healing',
    line3: 'With Tender Care.',
    supportAmount: 1000,
  },
  {
    id: 'story-2',
    image: monkeyStoryImg,
    line1: 'Sacred Vaanar Seva,',
    line2: 'Fresh Bananas For',
    line3: 'Hungry Troops.',
    supportAmount: 1000,
  },
  {
    id: 'story-3',
    image: gauSevaStoryImg,
    line1: 'Pavitra Gau Seva,',
    line2: 'Nutritious Feed For',
    line3: 'Sheltered Cows.',
    supportAmount: 1000,
  },
];

const GAU_SEVA_ABOUT_CARDS: RescueCard[] = [
  {
    id: 'gau-seva-story-1',
    image: gauSevaAboutShelterImg,
    line1: 'Weak & Injured,',
    line2: 'Safe Treatment',
    line3: '& Loving Care.',
    supportAmount: 1000,
  },
  {
    id: 'gau-seva-story-2',
    image: gauSevaAboutCareImg,
    line1: 'Rescued Gau Mata,',
    line2: 'Safe Shelter',
    line3: '& Protection.',
    supportAmount: 1000,
  },
  {
    id: 'gau-seva-story-3',
    image: gauSevaAboutFeedingImg,
    line1: 'Daily Gau Seva,',
    line2: 'Nutritious Food',
    line3: '& Feeding.',
    supportAmount: 1000,
  },
];

const BIRTHDAY_ABOUT_CARDS: RescueCard[] = [
  {
    id: 'birthday-about-food',
    image: aboutCard1,
    line1: 'Wholesome Meals,',
    line2: 'Cake & Birthday',
    line3: 'Wishes for Children.',
    supportAmount: 1000,
  },
  {
    id: 'birthday-about-joy',
    image: aboutCard2,
    line1: 'A Special Day,',
    line2: 'Shared With',
    line3: 'Underprivileged Kids.',
    supportAmount: 1000,
  },
  {
    id: 'birthday-about-celebration',
    image: aboutCard3,
    line1: 'Celebrate With',
    line2: 'Purpose, Love',
    line3: '& Dignity.',
    supportAmount: 1000,
  },
];

interface SevaItem {
  id: string;
  name: string;
  unitPrice: number;
  unit: string;
  image?: string;
  tag: string;
  description: string;
  icon: string;
}

const SEVA_ITEMS: SevaItem[] = [
  {
    id: 't-green-grass',
    name: 'Fresh Green Grass for Gau Mata',
    unitPrice: 416,
    unit: 'Bundle',
    image: greenGrassImg,
    tag: 'Daily Essential',
    description: 'Nutritious green fodder vital for digestion, hydration, and immunity of recovering and rescued cows.',
    icon: '🌱',
  },
  {
    id: 't-monkeys',
    name: 'Fresh Bananas & Fruits for Monkeys',
    unitPrice: 250,
    unit: 'Basket',
    image: monkeyFruitImg,
    tag: 'Tuesday Special',
    description: 'Fresh bananas, papayas, and seasonal fruits offered to hungry monkeys in temple outskirts and forest fringes.',
    icon: '🍌',
  },
  {
    id: 't-cow-food',
    name: 'Essential Care for Animals in Need',
    unitPrice: 1317,
    unit: 'Care Pack',
    image: cowFoodImg,
    tag: 'High Impact',
    description: 'High-nutrition fodder, balanced cattle feed, and vital care supplies for recovering cows and animals in distress.',
    icon: '🐄',
  },
  {
    id: 't-medical-kit',
    name: 'Emergency Medical Care Kit',
    unitPrice: 416,
    unit: 'Kit',
    image: medicalKitImg,
    tag: 'Life Saver',
    description: 'Antiseptics, healing maggot spray, sterile bandages, and painkillers for injured street animals.',
    icon: '🩹',
  },
];

const GAU_SEVA_ITEMS: SevaItem[] = [
  {
    id: 'gau-green-grass',
    name: 'Green Grass',
    unitPrice: 550,
    unit: 'Bundle',
    image: gauSevaGreenGrassImg,
    tag: 'Daily Essential',
    description: 'Fresh green grass to support healthy digestion and daily nourishment for Gau Mata.',
    icon: '🌱',
  },
  {
    id: 'gau-fodder',
    name: 'Fodder',
    unitPrice: 1150,
    unit: 'Care Pack',
    image: gauSevaFodderImg,
    tag: 'Daily Nutrition',
    description: 'Nutritious dry fodder to help provide consistent food and strength for rescued cows.',
    icon: '🌾',
  },
  {
    id: 'gau-medicine-kit',
    name: 'Medicine Kit',
    unitPrice: 1250,
    unit: 'Kit',
    image: gauSevaMedicineKitImg,
    tag: 'Life Saver',
    description: 'Essential medical supplies for treatment, wound care, and recovery support.',
    icon: '🩹',
  },
  {
    id: 'gau-vegetables',
    name: 'Vegetables',
    unitPrice: 750,
    unit: 'Basket',
    image: gauSevaVegetablesImg,
    tag: 'Fresh Nutrition',
    description: 'Fresh vegetables to add nutritious variety to daily meals for Gau Mata.',
    icon: '🥕',
  },
];

const BIRTHDAY_ITEMS: SevaItem[] = [
  {
    id: 'birthday-party-small',
    name: 'Sweet Little Birthday Party for Slum Kids',
    unitPrice: 2000,
    unit: 'Celebration',
    image: birthdayCard1,
    tag: 'Share Happiness',
    description: 'Help create a warm birthday celebration with food, cake, and wishes for children in slum communities.',
    icon: '🎂',
  },
  {
    id: 'birthday-feeding-cake',
    name: 'Birthday Feeding & Cake Celebration with Wishes',
    unitPrice: 1400,
    unit: 'Celebration',
    image: birthdayCard3,
    tag: 'Birthday Seva',
    description: 'Sponsor a wholesome meal, cake, and heartfelt birthday wishes for children who deserve to feel remembered.',
    icon: '🎈',
  },
  {
    id: 'birthday-food-packets-wishes',
    name: "Food Packets with B'day Wishes",
    unitPrice: 700,
    unit: 'Food Pack',
    image: birthdayCard2,
    tag: 'Direct Support',
    description: 'Provide nourishing food packets with personal birthday wishes for children and families in need.',
    icon: '🍱',
  },
  {
    id: 'birthday-grand-party',
    name: 'Grand Birthday Party for Underprivileged Kids',
    unitPrice: 5000,
    unit: 'Party',
    image: birthdayCard4,
    tag: 'High Impact',
    description: 'Help organize a joyful group celebration with a meal, cake, and meaningful moments of belonging.',
    icon: '🎉',
  },
];

const PRESETS = [501, 1001, 2100, 5100];

const TUESDAY_FAQS = [
  {
    q: 'Why is Tuesday considered sacred for Gau and Vaanar Seva?',
    a: 'Tuesday (Mangalwar) is reverently dedicated to Lord Hanuman, the supreme devotee and symbol of selfless service. Feeding monkeys (Vaanar Sena) and sacred cows (Gau Mata) on this day invokes divine blessings, spreads living compassion, and brings peace and positivity into one’s life.',
  },
  {
    q: 'Will I get an 80G tax exemption certificate for my donation?',
    a: 'Yes, 100%! All donations to Punyakart Foundation are eligible for 50% tax exemption under Section 80G of the Income Tax Act. Your official 80G tax receipt is instantly generated and sent to your email and WhatsApp.',
  },
  {
    q: 'How does Punyakart Foundation ensure my contribution reaches the animals?',
    a: 'Our volunteer teams and sanctuary caretakers conduct regular morning and afternoon feeding rounds every Tuesday. We document the feeding with photos and videos and share regular updates with all donors via WhatsApp and our compassion portal.',
  },
  {
    q: 'Can I dedicate this donation in the name of my family or ancestors?',
    a: 'Absolutely. During checkout, you can select the dedication option to dedicate your Tuesday Seva in memory of ancestors, for family well-being, or on the occasion of birthdays and anniversaries.',
  },
  {
    q: 'What payment modes are accepted?',
    a: 'We accept all standard Indian UPI apps (Google Pay, PhonePe, Paytm, BHIM), Net Banking, Debit/Credit Cards, and International Cards (USD, EUR, AED).',
  },
];

function renderCampaignTitle(title: string): React.ReactNode {
  const emphasis = /(?:Pitru Paksha|Sacred Memory|Navratri|Devotion|Hope|Tuesday|Seva|Gau Seva|Thursday|Gaumata|Special Day|Happiness)/i;
  const parts = title.split(/((?:Pitru Paksha|Sacred Memory|Navratri|Devotion|Hope|Tuesday|Seva|Gau Seva|Thursday|Gaumata|Special Day|Happiness))/gi);
  return parts.map((part, index) => emphasis.test(part)
    ? <span key={`${part}-${index}`} className="text-[#FF6B00] italic">{part}</span>
    : <React.Fragment key={`${part}-${index}`}>{part}</React.Fragment>);
}

export const TuesdayCampaignPage: React.FC<TuesdayCampaignPageProps> = ({
  onOpenCheckout,
  onOpen80GSearch,
  campaignId = 'c3',
}) => {
  const canonicalId = canonicalCampaignId(campaignId);
  const isNavratriCampaign = canonicalId === 'c7';
  const [selectedCurrency, setSelectedCurrency] = useState<Currency>(CURRENCIES[0]);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [customAmountValue, setCustomAmountValue] = useState<string>('');
  const [amountError, setAmountError] = useState<string | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<number | null>(null);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);
  const { campaign: currentCampaign, status: campaignStatus } = usePublicCampaign(canonicalId);
  const { donations: visibleDonors, status: donorStatus } = useRecentDonations(`campaign_${canonicalId}`);
  const donorMessage = donorFeedMessage(donorStatus, visibleDonors.length);
  const campaignData = isNavratriCampaign
    ? { ...NAVRATRI_DEFAULT_CAMPAIGN, ...currentCampaign,
        content: { ...NAVRATRI_DEFAULT_CAMPAIGN.content, ...currentCampaign?.content } }
    : currentCampaign;
  const content = campaignData?.content;
  const donationUnavailable = !campaignDonationAvailable(campaignStatus, currentCampaign);
  const navratriTaxBenefit = isNavratriCampaign && currentCampaign?.has_tax_benefit === true;
  const showTaxBenefit = isNavratriCampaign ? navratriTaxBenefit : campaignData?.has_tax_benefit !== false;
  const taxBenefitLabel = isNavratriCampaign && !navratriTaxBenefit ? 'Tax benefit details pending confirmation' : '50% Tax Exemption (80G)';
  const availabilityHint = isNavratriCampaign && campaignStatus === 'loading'
    ? 'Campaign preview: donations are unavailable until Navratri is confirmed active. You can still explore the campaign and choose a contribution.'
    : campaignAvailabilityMessage(campaignStatus);
  const isGauSevaCampaign = canonicalId === 'c4' || canonicalId === 'c5' || isNavratriCampaign;
  const isThursdayGauSevaCampaign = canonicalId === 'c5';
  const isBirthdayCampaign = canonicalId === 'c6';
  const campaignName =
    campaignData?.title ||
    (isNavratriCampaign
      ? NAVRATRI_DEFAULT_CAMPAIGN.title
      : isThursdayGauSevaCampaign
      ? 'This Thursday, Let’s Feed 1,400+ Gaumata'
      : isGauSevaCampaign
        ? '1,400+ Lives Depend on Your Kindness — Donate Today'
        : isBirthdayCampaign
          ? 'Celebrate Your Special Day by Sharing Happiness'
        : 'This Tuesday, Turn Your Faith Into Seva');
  const campaignTagline = isNavratriCampaign
    ? 'NAVRATRI • SEVA • COMPASSION'
    : isBirthdayCampaign
    ? 'CELEBRATE • SHARE • BRING JOY'
    : isGauSevaCampaign
    ? 'FEED • HEAL • SHELTER • PROTECT'
    : 'FEED A COW • FEED A MONKEY • SPREAD COMPASSION';
  const configuredItems = Array.isArray(content?.contribution_cards)
    ? content.contribution_cards.filter((card) => card && isValidDonationAmount(card.price)
        && [card.title, card.unit, card.image, card.subtitle].every(value => typeof value === 'string' && value.trim())).map((card, index): SevaItem => ({
        id: card.id || `campaign-contribution-${index}`,
        name: card.title,
        unitPrice: card.price,
        unit: card.unit,
        image: card.image,
         tag: card.unit || 'Seva',
        description: card.subtitle,
        icon: card.icon || '🧡',
      }))
    : [];
  const campaignItems = configuredItems.length ? configuredItems : isBirthdayCampaign ? BIRTHDAY_ITEMS : isGauSevaCampaign ? GAU_SEVA_ITEMS : SEVA_ITEMS;
  const campaignHeroFallback = isNavratriCampaign
    ? NAVRATRI_DEFAULT_CAMPAIGN.content.hero_title
    : isGauSevaCampaign
    ? isThursdayGauSevaCampaign
      ? 'This Thursday, Let’s Feed 1,400+ Gaumata'
      : 'Help provide timely treatment, nutritious food, shelter, medicines, and continuous care to rescued Gau Mata.'
    : 'This Tuesday, offer your Seva by helping provide food and care to cows and monkeys in need.';
  const campaignDescriptionFallback = isNavratriCampaign
    ? NAVRATRI_DEFAULT_CAMPAIGN.description
    : isBirthdayCampaign
    ? 'Turn your Birthday, Anniversary, or any special occasion into a reason for a child to smile through a wholesome meal, moments of joy, and the feeling that someone cares.'
    : isGauSevaCampaign
    ? 'Your contribution helps rescued animals receive emergency treatment, daily nourishment, safe shelter, and the lifelong care they deserve.'
    : 'Tuesday is traditionally associated with Lord Hanuman, devotion, strength, and selfless service. Let your devotion become an act of Jeev Seva.';
  const campaignDescription = content?.hero_subtitle || campaignData?.description || (isNavratriCampaign
    ? content?.hero_subtitle || campaignData?.description || campaignDescriptionFallback
    : isBirthdayCampaign
    ? 'Turn Your Birthday or Anniversary Into a Celebration of Giving. Birthdays and anniversaries are special moments filled with love, happiness and celebration.'
    : isGauSevaCampaign
    ? 'Punyakart Foundation is dedicated to the care and protection of 1,400+ Gau Mata. Every day, we receive 10+ calls for accident cases, involving animals who are injured, helpless, and in urgent need of medical attention.'
    : campaignDescriptionFallback);
  const campaignCtaLabel = isNavratriCampaign ? 'Give Navratri Seva' : isBirthdayCampaign ? 'Celebrate With a Purpose' : isGauSevaCampaign ? 'Offer Gau Seva' : 'Offer Tuesday Seva';
  const configuredHeroTitle = currentCampaign?.content?.hero_title || currentCampaign?.hero_title || currentCampaign?.title;
  const showDefaultNavratriHeading = isNavratriCampaign && (!configuredHeroTitle || configuredHeroTitle === NAVRATRI_DEFAULT_CAMPAIGN.content.hero_title);
  const campaignGoal = publicStat(currentCampaign?.target);
  const campaignRaised = publicStat(currentCampaign?.raised);
  const campaignDonors = publicStat(currentCampaign?.donors);
  const campaignProgress = campaignGoal !== null && campaignGoal > 0 && campaignRaised !== null
    ? Math.min(100, Math.round((campaignRaised / campaignGoal) * 100))
    : null;
  const configuredPresets = campaignData?.donation_presets?.filter((amount) => isValidDonationAmount(amount)) || [];
  const presets = configuredPresets.length ? configuredPresets : PRESETS;
  const configuredAboutCards = Array.isArray(content?.about_cards)
    ? content.about_cards.filter((card) => card && isValidDonationAmount(card.supportAmount)
        && [card.id, card.image, card.line1, card.line2, card.line3].every(value => typeof value === 'string' && value.trim()))
    : [];
  const aboutCards = configuredAboutCards.length ? configuredAboutCards : isBirthdayCampaign
    ? BIRTHDAY_ABOUT_CARDS
    : isGauSevaCampaign
    ? GAU_SEVA_ABOUT_CARDS
    : RESCUE_CARDS;
  const aboutBannerDescription = content?.about_banner_description || (isNavratriCampaign
    ? content?.about_banner_description || NAVRATRI_DEFAULT_CAMPAIGN.content.about_banner_description
    : isBirthdayCampaign
    ? 'Every year, we celebrate our special days with family and friends. We cut cakes, enjoy delicious food and exchange gifts. But for many children living in underprivileged communities, even a wholesome meal can feel like a celebration. With Punyakart Foundation, you can share a part of your happiness with these children. Instead of spending your entire celebration only on yourself, dedicate a part of your special day to making someone else’s day brighter.'
    : isGauSevaCampaign
    ? 'We rescue these animals and provide them with treatment, shelter, nutritious food, medicines, and continuous care until they recover. But caring for so many animals is a daily responsibility, and we cannot do it alone. Your support can help us provide timely treatment, food, shelter, and care to these innocent lives.'
    : content?.about_banner_description ||
      'Hanuman Ji हमें भक्ति के साथ Seva, Karuna और Nishkaam Bhav का मार्ग दिखाते हैं। इस मंगलवार, केवल प्रार्थना ही नहीं — किसी बेज़ुबान के लिए भोजन का माध्यम बनें।');
  const faqs = campaignData?.faqs?.length
    ? campaignData.faqs.map((faq) => ({ q: faq.question, a: faq.answer }))
    : isNavratriCampaign
      ? NAVRATRI_DEFAULT_CAMPAIGN.faqs.map((faq) => ({ q: faq.question, a: faq.answer }))
      : TUESDAY_FAQS;

  // Local stepper values for the card counter [- 1 +] (default 1)
  const [stepperValues, setStepperValues] = useState<Record<string, number>>({
    't-green-grass': 1,
    't-monkeys': 1,
    't-cow-food': 1,
    't-medical-kit': 1,
  });

  // Cart total from specific item selections
  const cartTotal = Object.entries(quantities).reduce((sum, [id, qty]) => {
    const item = campaignItems.find((s) => s.id === id);
    const count = typeof qty === 'number' ? qty : 0;
    return sum + (item ? item.unitPrice * count : 0);
  }, 0);

  const customAmountNum = parseDonationAmount(customAmountValue);
  const directDonation = customAmountValue ? (customAmountNum ?? 0) : (selectedPreset || 0);
  const totalAmount = cartTotal + directDonation;
  const finalDonationAmount = customAmountValue ? totalAmount : (totalAmount > 0 ? totalAmount : 1001);

  const handleStepperChange = (id: string, delta: number) => {
    const cartQuantity = quantities[id] || 0;
    const change = resolveCampaignQuantityChange(
      cartQuantity,
      stepperValues[id] || 1,
      delta,
    );
    setStepperValues((prev) => ({ ...prev, [id]: change.nextStepperQuantity }));
    if (change.target === 'cart') {
      updateQuantity(id, delta);
    }
  };

  const handleAddToCart = (item: SevaItem) => {
    if ((quantities[item.id] || 0) > 0) return;
    const addCount = stepperValues[item.id] || 1;
    setQuantities((prev) => ({ ...prev, [item.id]: addCount }));
    setStepperValues((prev) => ({ ...prev, [item.id]: addCount }));
    setSelectedPreset(null);
    setCustomAmountValue('');
  };

  const updateQuantity = (id: string, delta: number) => {
    setQuantities((prev) => {
      const current = prev[id] || 0;
      const next = Math.max(0, current + delta);
      if (next === 0) {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      }
      return { ...prev, [id]: next };
    });
    setSelectedPreset(null);
    setCustomAmountValue('');
  };

  const handlePresetClick = (preset: number) => {
    if (selectedPreset === preset && !customAmountValue && cartTotal === 0) {
      setSelectedPreset(null);
    } else {
      setSelectedPreset(preset);
      setCustomAmountValue('');
      setQuantities({});
    }
  };

  const handleCustomAmountChange = (val: string) => {
    setCustomAmountValue(val);
    setAmountError(null);
    if (val) {
      setSelectedPreset(null);
      setQuantities({});
    }
  };

  const handleDonate = () => {
    if (donationUnavailable) return;
    if ((customAmountValue && customAmountNum === null) || !isValidDonationAmount(finalDonationAmount)) {
      setAmountError(DONATION_AMOUNT_ERROR);
      return;
    }
    setAmountError(null);
    onOpenCheckout(finalDonationAmount, campaignName);
  };

  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});

  const handleImageError = (id: string) => {
    setImageErrors((prev) => ({ ...prev, [id]: true }));
  };

  const handleSupportStory = (amount: number) => {
    if (donationUnavailable) return;
    if (!isValidDonationAmount(amount)) {
      setAmountError(DONATION_AMOUNT_ERROR);
      return;
    }
    onOpenCheckout(amount, `${campaignName} - Emergency Medical Treatment`);
  };

  return (
    <div className="bg-[#FFFBF7] text-neutral-900 min-h-screen pb-6 sm:pb-0">
      {donationUnavailable && <p className="border border-amber-200 bg-amber-50 px-3 py-2 text-xs sm:text-sm text-amber-900" role="status">{availabilityHint}</p>}
      
      {/* HERO SECTION */}
      <section className="relative pt-4 sm:pt-6 pb-8 sm:py-12 md:py-14 overflow-hidden border-b border-orange-100 bg-gradient-to-b from-[#FFF6ED] via-[#FFFBF7] to-white">
        <div className="relative max-w-4xl mx-auto px-3.5 sm:px-6 text-center">
          
          {/* Top Tagline Pill */}
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="inline-flex items-center gap-1.5 px-3 py-1 sm:px-3.5 sm:py-1.5 rounded-full bg-orange-100/90 border border-orange-300/80 text-orange-950 font-black text-[10px] sm:text-xs tracking-wider uppercase mb-3 sm:mb-4 shadow-2xs max-w-full"
          >
            <Sparkles className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-orange-600 shrink-0" />
            <span className="min-w-0 break-words sm:truncate">{campaignTagline}</span>
          </motion.div>

          {/* Main Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.08 }}
            className="font-display text-xl sm:text-2xl md:text-4xl font-black text-slate-950 leading-[1.16] tracking-[-0.035em] mb-3 sm:mb-4 max-w-4xl mx-auto px-1"
            aria-label={isNavratriCampaign ? (configuredHeroTitle || NAVRATRI_DEFAULT_CAMPAIGN.content.hero_title) : undefined}
          >
            {configuredHeroTitle && !showDefaultNavratriHeading ? (
              <span>{renderCampaignTitle(configuredHeroTitle)}</span>
            ) : isNavratriCampaign ? (
              <>
                THIS <span className="text-[#FF6B00]">NAVRATRI,</span> LET YOUR{' '}
                <span className="text-[#FF6B00] italic font-playfair font-normal">DEVOTION</span>{' '}
                BECOME THEIR <span className="text-[#FF6B00] italic font-playfair font-normal">HOPE</span>
              </>
            ) : isBirthdayCampaign ? (
              <>Celebrate Your <span className="text-[#E85D04]">Special Day</span> by Sharing <span className="text-[#E85D04]">Happiness</span></>
            ) : isThursdayGauSevaCampaign ? (
              <>This <span className="text-[#E85D04]">Thursday,</span> Let’s Feed <span className="text-[#E85D04]">1,400+ Gaumata</span></>
            ) : isGauSevaCampaign ? (
              <>
                <span className="text-[#E85D04]">Help provide</span>{' '}
                timely treatment, nutritious food, shelter, medicines, and
                continuous care to rescued <span className="text-[#E85D04]">Gau Mata.</span>
              </>
            ) : campaignId === 'c3' ? (
              <>
                This <span className="text-[#FF6B00]">Tuesday,</span> offer your{' '}
                <span className="text-[#FF6B00]">Seva</span> by helping provide{' '}
                <span className="font-serif-hero italic font-normal text-[#FF6B00]">food and care</span>{' '}
                to cows and monkeys in need.
              </>
            ) : (
              content?.hero_title || campaignData?.hero_title || campaignHeroFallback
            )}
          </motion.h1>



          {/* Hero Banner Photo Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="relative rounded-xl sm:rounded-3xl overflow-hidden shadow-xl sm:shadow-2xl border-2 sm:border-4 border-orange-200/80 aspect-[16/9] max-w-3xl mx-auto mb-4 sm:mb-6 bg-slate-900 group"
          >
            {isBirthdayCampaign && !campaignData?.image ? (
              <img
                src={c6HeroBanner}
                alt="Birthday Campaign Hero"
                className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-500"
                loading="eager"
              />
            ) : (
              <img
                src={resolveCampaignImage(campaignId, campaignData?.image) || tuesdayHeroImg}
                alt={campaignName}
                className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-500"
                loading="eager"
              />
            )}
            
            {/* 80G Tax Exemption Floating Badge on Hero */}
            {showTaxBenefit && <div className="absolute top-2 right-2 sm:top-4 sm:right-4 flex items-center gap-1 sm:gap-1.5 bg-black/80 backdrop-blur-md text-amber-300 border border-amber-400/40 text-[10px] sm:text-xs font-bold px-2 py-1 sm:px-3 sm:py-1.5 rounded-full shadow-lg">
              <Gift className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-300 shrink-0" />
              <span>{isNavratriCampaign ? '50% Tax Exemption (80G)' : '100% Tax Exempt (80G)'}</span>
            </div>}

            {/* Bottom Scrim */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />
          </motion.div>

          {/* Campaign Narrative Description */}
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.22 }}
            className="text-sm md:text-base text-slate-700 max-w-2xl mx-auto leading-relaxed mb-4 sm:mb-6 font-normal px-1"
          >
            {campaignDescription}
          </motion.p>

        </div>
      </section>

      {/* SEVA CONTRIBUTION SECTION */}
      <section id="choose-cause" className="py-4 sm:py-6 bg-white border-b border-slate-100">
        <div className="max-w-md sm:max-w-3xl lg:max-w-6xl mx-auto px-3 sm:px-4 lg:px-8">
          
          <div className="text-left mb-3">
            <div className="text-center sm:text-left mb-2">
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-[#FF6B00] bg-orange-100/90 px-3.5 py-1 rounded-full inline-block mb-1.5 border border-orange-200 shadow-2xs">
                {isNavratriCampaign ? 'Navratri • Seva & Compassion' : isBirthdayCampaign ? 'Celebrate With a Purpose' : isGauSevaCampaign ? 'Gau Seva • Jeev Daya Sankalp' : 'Jeev Seva • Mangalwar Sankalp'}
              </span>
              <h2 className="font-display text-xl sm:text-2xl font-black text-[#002D62] tracking-tight leading-tight">
                {content?.contribution_heading || (isBirthdayCampaign ? <>Celebrate Your Joy. <span className="text-[#FF6B00]">Share Happiness.</span></> : isGauSevaCampaign ? <>Support Care. <span className="text-[#FF6B00]">Protect a Life.</span></> : <>Offer Your Seva. <span className="text-[#FF6B00]">Feed a Life.</span></>)}
              </h2>
              <p className="text-[#5A6E85] text-xs mt-1 leading-relaxed">
                {content?.contribution_subtitle || (isNavratriCampaign
                  ? <>Your contribution can support the foundation’s ongoing food and care work during Navratri.</>
                  : isBirthdayCampaign
                  ? <>आपका विशेष दिन किसी बच्चे के लिए <strong className="font-bold text-[#002D62]">खुशी और सम्मान</strong> का कारण बन सकता है।</>
                  : isGauSevaCampaign
                  ? <>आपका छोटा सा योगदान किसी <strong className="font-bold text-[#002D62]">Gau Mata</strong> के उपचार, भोजन और सुरक्षित आश्रय में मदद कर सकता है।</>
                  : <>आपका छोटा सा योगदान किसी भूखी <strong className="font-bold text-[#002D62]">Gau Mata</strong> के लिए चारा और भोजन बन सकता है, या किसी <strong className="font-bold text-[#002D62]">Vanar</strong> के लिए एक पौष्टिक आहार।</>)}
              </p>
            </div>
            <div className="mt-2.5 pt-2 border-t border-orange-100 flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-[11px] sm:text-xs font-extrabold text-[#47607D] uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-[#FF6B00]" />
                Your contribution can help provide:
              </span>
            </div>
          </div>

          {/* 2x2 Grid of Compact Contribution Cards */}
          <div className="grid grid-cols-1 min-[360px]:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-5">
            {campaignItems.map((card) => {
              const inCartQty = quantities[card.id] || 0;
              const stepperVal = stepperValues[card.id] || 1;
              return (
                <div
                  key={card.id}
                  id={`impact-card-${card.id}`}
                  className="group border-2 border-[#FF6B00]/80 rounded-2xl bg-white overflow-hidden flex flex-col justify-between transition-all duration-300 shadow-[0_4px_18px_rgba(0,45,98,0.06)] hover:-translate-y-0.5 hover:shadow-[0_10px_26px_rgba(0,45,98,0.12)]"
                >
                  {/* Image */}
                  <div className="w-full aspect-[4/3] min-h-32 sm:min-h-36 flex items-center justify-center overflow-hidden bg-[#F7FAFC] p-3 relative">
                    {card.image ? (
                      <img
                        src={card.image}
                        alt={card.name}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        loading="lazy"
                      />
                    ) : (
                      <span className="text-[10px] font-bold text-slate-400">Image placeholder</span>
                    )}
                    <span className="absolute top-3 left-3 inline-flex items-center rounded-full bg-[#0F2942]/95 px-2.5 py-1 text-[10px] font-extrabold text-white shadow-sm">
                      {card.tag}
                    </span>
                  </div>

                  {/* Content */}
                  <div className="flex-1 flex flex-col justify-between min-w-0 p-3 sm:p-4">
                    <div>
                      <h3 className="font-display font-extrabold text-base sm:text-lg text-[#002D62] leading-snug break-words">
                        {card.name}
                      </h3>
                      <p className="text-xs sm:text-sm text-[#5A6E85] mt-1.5 leading-relaxed line-clamp-3">
                        {card.description}
                      </p>
                    </div>

                    {/* Unified orange quantity/price control */}
                    <div className="mt-4 pt-3 border-t border-slate-100">
                      <div className="flex min-h-12 w-full items-stretch overflow-hidden rounded-xl bg-[#FF6B00] text-white shadow-2xs">
                        <button
                          type="button"
                          onClick={() => handleStepperChange(card.id, -1)}
                          className="flex w-1/4 items-center justify-center border-r border-white/35 text-xl font-black hover:bg-[#E05300] active:scale-95 cursor-pointer"
                          aria-label={`Decrease quantity of ${card.name}`}
                        >
                          <Minus className="w-4 h-4" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAddToCart(card)}
                          disabled={inCartQty > 0}
                          className="flex min-w-0 flex-1 items-center justify-center px-2 text-xs sm:text-sm font-black tabular-nums hover:bg-[#E05300] active:scale-95 cursor-pointer disabled:cursor-default disabled:hover:bg-[#FF6B00]"
                          aria-label={inCartQty > 0
                            ? `${card.name} added, quantity ${inCartQty}, total ₹${(card.unitPrice * inCartQty).toLocaleString('en-IN')}`
                            : `Add ${card.name} worth ₹${(card.unitPrice * stepperVal).toLocaleString('en-IN')}`}
                        >
                          {inCartQty > 0 ? (
                            <span className="flex flex-col items-center leading-tight">
                              <span>Added ({inCartQty})</span>
                              <span className="text-[10px] font-bold">₹{(card.unitPrice * inCartQty).toLocaleString('en-IN')}</span>
                            </span>
                          ) : (
                            `₹${(card.unitPrice * stepperVal).toLocaleString('en-IN')}`
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleStepperChange(card.id, 1)}
                          className="flex w-1/4 items-center justify-center border-l border-white/35 text-xl font-black hover:bg-[#E05300] active:scale-95 cursor-pointer"
                          aria-label={`Increase quantity of ${card.name}`}
                        >
                          <Plus className="w-4 h-4" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* MAKE A DONATION Section */}
          <div className="mt-4 hidden sm:block rounded-2xl border border-orange-100 bg-[#FFFDFC] p-4 sm:p-5 lg:p-6 shadow-[0_6px_24px_rgba(255,107,0,0.06)]">
            {/* Header Row */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-1.5 mb-3">
              <span className="text-[#47607D] font-extrabold text-xs tracking-[0.16em] uppercase">
                MAKE A DONATION
              </span>
              <span className="text-[#FF6B00] text-xs font-bold">
                {isNavratriCampaign ? 'Give with compassion 🧡' : 'Every rupee creates a kinder tomorrow 🧡'}
              </span>
            </div>

            {/* 4 Preset Buttons */}
            <div className="grid grid-cols-4 gap-2 mb-3">
              {presets.map((amt) => {
                const isSelected = selectedPreset === amt && !customAmountValue && cartTotal === 0;
                return (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => handlePresetClick(amt)}
                    className={`border-2 rounded-xl min-h-11 py-2 px-1 text-center font-extrabold text-xs sm:text-sm transition-all cursor-pointer ${
                      isSelected
                        ? 'border-[#FF6B00] bg-[#FF6B00] text-white ring-1 ring-[#FF6B00]/30 shadow-2xs'
                        : 'border-slate-300 bg-white text-[#002D62] hover:border-[#FF6B00] hover:bg-[#FFF0E6]/30 active:scale-95'
                    }`}
                  >
                    ₹{amt.toLocaleString('en-IN')}
                  </button>
                );
              })}
            </div>

            {amountError && <p id="desktop-donation-amount-error" role="alert" className="mb-2 text-xs text-red-600">{amountError}</p>}
            {/* Custom Amount + Campaign CTA */}
            <div className="flex w-full items-stretch overflow-hidden rounded-xl border-2 border-slate-300 bg-white shadow-2xs transition-colors focus-within:border-[#FF6B00] focus-within:ring-1 focus-within:ring-[#FF6B00]/30">
              <div className="relative flex w-1/2 min-w-0 items-center">
                <span className="pointer-events-none absolute left-3 text-[#FF6B00] font-black text-sm">
                  ₹
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  min={MIN_DONATION_AMOUNT}
                  max={MAX_DONATION_AMOUNT}
                  aria-label="Donation amount in rupees"
                  aria-invalid={Boolean(amountError)}
                  aria-describedby={amountError ? 'desktop-donation-amount-error' : undefined}
                  step="1"
                  placeholder={`Enter custom amount (min ₹${MIN_DONATION_AMOUNT})`}
                  value={customAmountValue}
                  onChange={(e) => handleCustomAmountChange(e.target.value)}
                  className="w-full min-w-0 min-h-12 bg-transparent pl-7 pr-10 py-2 text-base sm:text-xs font-bold text-[#002D62] placeholder:text-slate-400 focus:outline-hidden"
                />
                {customAmountValue && (
                  <button
                    type="button"
                    onClick={() => setCustomAmountValue('')}
                    aria-label="Clear donation amount"
                    className="absolute right-0 min-w-10 min-h-11 text-xs font-semibold text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    ✕
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={handleDonate}
                disabled={donationUnavailable}
                aria-disabled={donationUnavailable}
                className="flex w-1/2 min-w-0 min-h-12 items-center justify-center gap-1 border-l-2 border-orange-200 bg-[#FF6B00] px-2 py-2.5 text-center text-xs sm:text-base font-black leading-tight text-white hover:bg-[#E05300] active:bg-[#C84800] transition-all cursor-pointer"
              >
                <span className="shrink-0">🧡</span>
                <span className="min-w-0 break-words">{campaignCtaLabel} • ₹{finalDonationAmount.toLocaleString('en-IN')}</span>
                <ArrowRight className="h-4 w-4 shrink-0" />
              </button>
            </div>

            {/* Dual Trust Badges */}
            <div className="grid grid-cols-2 gap-3 mt-3 pt-1">
              <div className="flex items-center gap-1.5 text-left">
                <Lock className="w-3 h-3 text-[#FF6B00] shrink-0" />
                <span className="text-[10px] font-semibold text-[#FF6B00] leading-tight">
                  {isNavratriCampaign ? 'Secure giving' : '100% Secure &amp; Tax-Deductible'}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-left justify-end">
                <ShieldCheck className="w-3 h-3 text-[#FF6B00] shrink-0" />
                <button
                  type="button"
                  onClick={onOpen80GSearch}
                  disabled={isNavratriCampaign && !navratriTaxBenefit}
                  className="text-[10px] font-semibold text-[#FF6B00] hover:underline leading-tight"
                >
                  {taxBenefitLabel}
                </button>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* IMPACT BANNER (One donation. Multiple lives changed. + Progress bar) */}
      <section className="py-4 px-3.5 sm:px-4 bg-[#F4F7FA] border-b border-slate-200/80">
        <div className="max-w-md sm:max-w-lg md:max-w-xl mx-auto space-y-3.5">
          
          {/* Soft pale cream card */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="relative bg-gradient-to-r from-[#FFFDF7] via-[#FFF6EE] to-[#FFFDF7] border border-[#FFD9BE] rounded-2xl p-4 sm:p-5 shadow-xs overflow-hidden"
          >
            <div className="flex items-center justify-between gap-2">
              
              {/* Left Graphic: Glowing Heart */}
              <div className="w-12 h-12 sm:w-14 sm:h-14 shrink-0 flex items-center justify-center rounded-2xl bg-[#FFF0E6] border border-[#FFD9BE] shadow-inner">
                <span className="text-2xl sm:text-3xl select-none" role="img" aria-label="Heart">
                  ❤️
                </span>
              </div>

              {/* Center Text Block */}
              <div className="flex-1 text-center px-1 sm:px-2 min-w-0">
                {/* Eyebrow */}
                <div className="flex items-center justify-center gap-1 text-[10px] sm:text-[11px] font-black text-[#FF6B00] uppercase tracking-widest mb-1">
                  <Sparkles className="w-2.5 h-2.5 text-[#FFB347]" />
                  <span>EVERY RUPEE MATTERS</span>
                  <Sparkles className="w-2.5 h-2.5 text-[#FFB347]" />
                </div>

                {/* Headline */}
                <h3 className="font-display font-black text-sm sm:text-base text-[#002D62] leading-snug">
                  One donation. Multiple lives changed.
                </h3>

                {/* Subtext */}
                <p className="text-[10.5px] sm:text-xs text-slate-600 mt-1 leading-relaxed max-w-xs mx-auto">
                  {isBirthdayCampaign
                    ? 'Your celebration can provide food, cake, wishes, and a joyful gathering for children who are often left out of special occasions.'
                    : isGauSevaCampaign
                    ? 'Your Gau Seva supports emergency treatment, nutritious food, safe shelter, and lifelong recovery care.'
                    : 'From hungry cows to temple monkeys — your Tuesday Seva reaches sacred animals who need it most, fast.'}
                </p>
              </div>

              {/* Right Graphic: Golden Rupee Coins */}
              <div className="w-12 h-12 sm:w-14 sm:h-14 shrink-0 flex items-center justify-center rounded-2xl bg-amber-100/70 border border-amber-200 shadow-inner">
                <span className="text-2xl sm:text-3xl select-none" role="img" aria-label="Coins">
                  🪙
                </span>
              </div>

            </div>

          </motion.div>

          {/* Live Progress Card */}
          <div className="bg-white rounded-xl sm:rounded-2xl border border-orange-200/80 p-3.5 sm:p-5 shadow-xs text-left">
              {campaignStatus !== 'ready' && <p role="status" className="text-xs text-slate-500 mb-2">{campaignStatus === 'loading' ? 'Loading campaign totals…' : 'Campaign totals are temporarily unavailable.'}</p>}
              <div className="flex flex-wrap sm:flex-nowrap gap-2 items-center justify-between text-xs sm:text-sm font-semibold text-slate-600 mb-2">
              <div className="flex items-center gap-1.5 text-emerald-800">
                <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="font-bold text-xs sm:text-sm">{isNavratriCampaign ? 'Navratri Seva Initiative' : isBirthdayCampaign ? 'Celebrate Any Special Occasion' : isGauSevaCampaign ? 'Care Every Day' : 'Active Every Tuesday'}</span>
              </div>
              <span className="text-xs sm:text-sm text-slate-500">{campaignGoal === null ? 'Goal unavailable' : campaignGoal > 0 ? `Goal: ₹${campaignGoal.toLocaleString('en-IN')}` : 'No fixed target'}</span>
            </div>

            {campaignGoal !== null && campaignGoal > 0 && campaignProgress !== null && <div className="w-full bg-slate-100 rounded-full h-2.5 sm:h-3 overflow-hidden mb-2.5 sm:mb-3">
              <div className="bg-gradient-to-r from-amber-500 via-[#FF6B00] to-orange-600 h-full rounded-full transition-all duration-700" style={{ width: `${campaignProgress}%` }} />
            </div>}

            <div className="grid grid-cols-3 gap-1.5 sm:gap-2 text-center pt-1 border-t border-slate-100">
              <div>
                <p className="text-sm sm:text-lg font-black text-slate-900">{campaignRaised === null ? '—' : `₹${campaignRaised.toLocaleString('en-IN')}`}</p>
                <p className="text-[9px] sm:text-xs text-slate-500 uppercase tracking-wider font-semibold">Raised</p>
              </div>
              <div>
                <p className="text-sm sm:text-lg font-black text-slate-900">{campaignDonors === null ? '—' : campaignDonors.toLocaleString('en-IN')}</p>
                <p className="text-[9px] sm:text-xs text-slate-500 uppercase tracking-wider font-semibold">Devotee Donors</p>
              </div>
              <div>
                <p className="text-sm sm:text-lg font-black text-emerald-600">{campaignGoal !== null && campaignGoal > 0 && campaignProgress !== null ? `${campaignProgress}%` : '—'}</p>
                <p className="text-[9px] sm:text-xs text-slate-500 uppercase tracking-wider font-semibold">Funded</p>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* RESCUE STORIES / ABOUT THE CAMPAIGN SECTION */}
      <section id="rescue-stories" className="py-4 sm:py-6 bg-[#F4F7FA] border-b border-slate-200/80">
        <div className="max-w-4xl lg:max-w-5xl mx-auto px-3 sm:px-6">
          
          {/* Eyebrow Label */}
          <div className="text-left mb-1">
            <span className="text-[#FF6B00] font-black text-[11px] sm:text-[13px] tracking-wider uppercase block">
              {content?.about_eyebrow || (isNavratriCampaign ? 'NAVRATRI SEVA' : isBirthdayCampaign ? 'CELEBRATE WITH A PURPOSE' : 'PROJECT DETAILS')}
            </span>
          </div>

          {/* Section Headline */}
          <div className="text-left mb-3 sm:mb-4">
            <h2 className="font-slab font-black text-xl sm:text-2xl md:text-3xl lg:text-[34px] text-[#002D62] tracking-tight leading-tight">
              {content?.about_title || (isNavratriCampaign ? 'Let compassion be part of your celebration' : isBirthdayCampaign ? 'Turn Your Celebration Into Giving' : 'About the Campaign')}
            </h2>
          </div>

          {/* Top Urgency Banner Box */}
          <div className="border border-[#FF6B00] sm:border-2 bg-[#FFF0E6] rounded-xl sm:rounded-2xl py-3 px-3 sm:py-5 sm:px-6 mb-3 sm:mb-5 shadow-2xs text-center">
            <h3 className="font-slab font-black text-[#A82512] text-xs xs:text-sm sm:text-base md:text-lg leading-snug sm:leading-tight max-w-3xl mx-auto mb-1.5 uppercase tracking-wide">
              {content?.about_banner_title || (isNavratriCampaign ? 'GIVE WITH COMPASSION' : isBirthdayCampaign ? 'SHARE YOUR HAPPINESS' : '🕉️ SEVA IS A FORM OF DEVOTION')}
            </h3>
            <p className="font-sans text-[11px] xs:text-xs sm:text-xs md:text-sm text-slate-700 font-normal leading-relaxed max-w-3xl mx-auto">
              {aboutBannerDescription}
            </p>
          </div>

          {/* 3 Cards Grid (always 3 columns matching the uploaded mockup image) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 lg:gap-5">
            {aboutCards.map((card) => {
              const hasError = imageErrors[card.id];

              return (
                <div
                  key={card.id}
                  onClick={() => handleSupportStory(card.supportAmount)}
                  className="border border-[#FF6B00]/70 sm:border-2 rounded-xl sm:rounded-2xl bg-white p-1.5 xs:p-2 sm:p-3.5 shadow-2xs hover:shadow-md hover:border-[#FF6B00] transition-all duration-300 flex flex-col justify-between cursor-pointer group select-none min-w-0 active:scale-[0.98]"
                   role="button"
                   aria-disabled={donationUnavailable}
                   tabIndex={0}
                  onKeyDown={(e) => {
                     if (e.key === 'Enter' || e.key === ' ') {
                       e.preventDefault();
                       handleSupportStory(card.supportAmount);
                    }
                  }}
                  aria-label={`Support story: ${card.line1} ${card.line2} ${card.line3}`}
                >
                  {/* Image Container with Soft Rounded Corners */}
                  <div className="w-full aspect-[4/3] rounded-lg sm:rounded-xl overflow-hidden bg-[#E2E8F0] mb-1.5 sm:mb-3 flex items-center justify-center relative">
                    {card.image && !hasError ? (
                      <img
                        src={card.image}
                        alt={`${card.line1} ${card.line2} ${card.line3}`}
                        className="w-full h-full object-cover group-hover:scale-104 transition-transform duration-500"
                        referrerPolicy="no-referrer"
                        onError={() => handleImageError(card.id)}
                        loading="lazy"
                      />
                    ) : (
                      <div className={`w-full h-full flex flex-col items-center justify-center ${card.image ? 'bg-[#DFE4EA] text-slate-400' : 'bg-[#E2E8F0]'}`}>
                        {card.image && <ImageIcon className="w-5 h-5 sm:w-10 sm:h-10 opacity-60" />}
                      </div>
                    )}
                  </div>

                  {/* Story title uses the full card width below the image on mobile. */}
                  <div className="flex-1 w-full min-w-0">
                    <h4 className="font-slab font-black text-sm sm:text-sm md:text-base text-[#9E1B1B] leading-snug break-words">
                      {card.line1} {card.line2} {card.line3}
                    </h4>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Seva Sankalp Banner */}
          <div className="mt-4 sm:mt-6 text-center bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 border border-[#FF6B00]/40 rounded-xl py-3 px-4 shadow-xs">
            <p className={`font-slab font-black text-xs xs:text-sm sm:text-base md:text-lg text-[#9E1B1B] tracking-wide ${isNavratriCampaign ? 'whitespace-pre-line' : ''}`}>
                {isNavratriCampaign
                  ? content?.seva_sankalp_text || NAVRATRI_DEFAULT_CAMPAIGN.content.seva_sankalp_text
                  : isBirthdayCampaign
                ? 'A special day becomes even more meaningful when it gives a child a reason to smile.'
                : 'जब एक भूखे जीव को भोजन मिलता है, वहीं से सच्ची करुणा की शुरुआत होती है।'}
            </p>
          </div>

          {isBirthdayCampaign && (
            <div className="mt-4 sm:mt-6 grid grid-cols-2 sm:grid-cols-4 gap-2">
              {['Birthday', 'Anniversary', 'Graduation', 'Achievement'].map((occasion) => (
                <div
                  key={occasion}
                  className="rounded-xl border border-orange-200 bg-white px-3 py-2 text-center text-xs sm:text-sm font-bold text-[#002D62]"
                >
                  {occasion}
                </div>
              ))}
            </div>
          )}

        </div>
      </section>

      {/* IMPACT & TRUST PILLARS BANNER */}
      <section className="py-6 sm:py-8 bg-white border-b border-slate-100">
        <div className="max-w-4xl mx-auto px-3.5 sm:px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-4 text-center">
            <div className="p-2.5 sm:p-3 rounded-xl sm:rounded-2xl bg-orange-50/50 border border-orange-100">
              <div className="w-8 h-8 sm:w-10 sm:h-10 mx-auto mb-1.5 sm:mb-2 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-bold text-sm sm:text-lg">
                {isNavratriCampaign ? 'Seva' : isBirthdayCampaign ? '100+' : '450+'}
              </div>
              <h4 className="font-extrabold text-xs sm:text-sm text-slate-900 leading-tight">
                {isNavratriCampaign ? 'Food & Care' : isBirthdayCampaign ? 'Children Supported' : 'Animals Fed Weekly'}
              </h4>
              <p className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5">
                {isNavratriCampaign ? 'Foundation initiatives' : isBirthdayCampaign ? 'Through meals and celebrations' : 'Every Tuesday morning & evening'}
              </p>
            </div>

            <div className="p-2.5 sm:p-3 rounded-xl sm:rounded-2xl bg-orange-50/50 border border-orange-100">
              <div className="w-8 h-8 sm:w-10 sm:h-10 mx-auto mb-1.5 sm:mb-2 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 font-bold text-sm sm:text-lg">
                 {isNavratriCampaign ? 'Info' : '80G'}
               </div>
               <h4 className="font-extrabold text-xs sm:text-sm text-slate-900 leading-tight">{isNavratriCampaign ? 'Tax details' : 'Tax Exemption'}</h4>
               <p className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5">{isNavratriCampaign ? 'Confirmation pending' : '50% deduction on all gifts'}</p>
            </div>

            <div className="p-2.5 sm:p-3 rounded-xl sm:rounded-2xl bg-orange-50/50 border border-orange-100">
              <div className="w-8 h-8 sm:w-10 sm:h-10 mx-auto mb-1.5 sm:mb-2 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-sm sm:text-lg">
                100%
              </div>
              <h4 className="font-extrabold text-xs sm:text-sm text-slate-900 leading-tight">Transparent Seva</h4>
              <p className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5">Video & photo updates on WhatsApp</p>
            </div>

            <div className="p-2.5 sm:p-3 rounded-xl sm:rounded-2xl bg-orange-50/50 border border-orange-100">
              <div className="w-8 h-8 sm:w-10 sm:h-10 mx-auto mb-1.5 sm:mb-2 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 font-bold text-sm sm:text-lg">
                {isNavratriCampaign ? 'CARE' : isBirthdayCampaign ? 'JOY' : '24x7'}
              </div>
              <h4 className="font-extrabold text-xs sm:text-sm text-slate-900 leading-tight">
                  {isNavratriCampaign ? 'Compassion' : isBirthdayCampaign ? 'Shared Happiness' : 'Animal Sanctuary'}
              </h4>
              <p className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5">
                  {isNavratriCampaign ? 'Support during Navratri' : isBirthdayCampaign ? 'A reason for a child to smile' : 'Safe haven for rescued cows & wildlife'}
              </p>
            </div>
          </div>
        </div>
      </section>

      <WhereYourMoneyGoes
        campaignId={campaignId}
        content={content}
        materials={allocationMaterialsFromProducts(campaignItems)}
      />

      {/* LIVE WALL OF COMPASSION */}
      <section className="py-6 sm:py-10 bg-white border-b border-slate-100">
        <div className="max-w-4xl mx-auto px-3.5 sm:px-6">
          <div className="text-center mb-4 sm:mb-6">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full inline-block mb-1.5 border border-emerald-200">
              Devotees & Donors
            </span>
            <h2 className="font-display font-black text-lg sm:text-2xl text-slate-900">
              {content?.donor_wall_title || 'Live Wall of Compassion'}
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 sm:gap-3">
            {visibleDonors.map((d) => (
              <div
                key={d.id}
                className="bg-slate-50 border border-slate-200/80 rounded-xl sm:rounded-2xl p-3 sm:p-3.5 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-xs sm:text-sm text-slate-900">{d.name}</span>
                    <span className="text-[11px] font-black text-[#FF6B00]">₹{d.amount.toLocaleString('en-IN')}</span>
                  </div>
                  <p className="text-[11px] sm:text-xs text-slate-600 mb-2">Contributed towards {campaignName}</p>
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1.5 border-t border-slate-200/60 font-medium">
                  <span />
                  <span className="flex items-center gap-1">
                    <Clock className="w-2.5 h-2.5" />
                    <time dateTime={d.date}>{formatRelativeTime(d.date)}</time>
                  </span>
                </div>
              </div>
            ))}
            {donorMessage && (
              <p role="status" className="sm:col-span-2 md:col-span-3 text-center text-xs sm:text-sm text-slate-500 py-4">
                {donorMessage}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* FAQ SECTION */}
      <section className="py-6 sm:py-12 bg-[#F4F7FA]">
        <div className="max-w-3xl mx-auto px-3.5 sm:px-6">
          <div className="text-center mb-4 sm:mb-6">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-[#FF6B00] bg-orange-100 px-3 py-1 rounded-full inline-block mb-1.5 border border-orange-200">
              Questions & Answers
            </span>
            <h2 className="font-display font-black text-lg sm:text-2xl text-slate-900">
              {content?.faq_title || 'Frequently Asked Questions'}
            </h2>
          </div>

          <div className="space-y-2.5 sm:space-y-3">
            {faqs.map((faq, idx) => {
              const isOpen = openFaqIndex === idx;
              return (
                <div
                  key={idx}
                  className="bg-white rounded-xl sm:rounded-2xl border border-slate-200/80 overflow-hidden shadow-2xs"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                    className="w-full p-3.5 sm:p-5 text-left font-bold text-xs sm:text-sm text-slate-900 flex items-center justify-between gap-3 cursor-pointer hover:bg-slate-50 transition-colors"
                  >
                    <span>{faq.q}</span>
                    <ChevronDown
                      className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${
                        isOpen ? 'rotate-180 text-[#FF6B00]' : ''
                      }`}
                    />
                  </button>

                  {isOpen && (
                    <div className="px-3.5 pb-3.5 sm:px-5 sm:pb-5 text-xs sm:text-sm text-slate-600 leading-relaxed border-t border-slate-100 pt-2.5 sm:pt-3">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Bottom CTA to Donate */}
          <div className="mt-6 sm:mt-8 text-center">
            <button
              type="button"
              onClick={handleDonate}
              disabled={donationUnavailable}
              aria-disabled={donationUnavailable}
              className="py-3 px-6 sm:px-8 rounded-full bg-[#FF6B00] hover:bg-orange-600 text-white font-black text-xs sm:text-base inline-flex items-center gap-2 shadow-md transition-all cursor-pointer active:scale-95"
            >
              <Heart className="w-4 h-4 fill-white" />
              <span>{campaignCtaLabel} (₹{finalDonationAmount.toLocaleString('en-IN')})</span>
            </button>
          </div>

        </div>
      </section>

      {/* MOBILE STICKY FLOATING DONATION BAR (Full Widget) */}
      <div data-mobile-donation-bar className="fixed bottom-0 left-0 right-0 sm:hidden z-40 max-h-[40vh] supports-[height:100dvh]:max-h-[45dvh] overflow-y-auto overscroll-contain rounded-t-2xl border border-orange-100 bg-[#FFFDFC] p-3.5 pb-[calc(0.875rem+env(safe-area-inset-bottom))] shadow-[0_-8px_30px_rgba(0,0,0,0.12)]">
        <div className="flex flex-wrap items-center justify-between gap-1 mb-2">
          <span className="text-[#47607D] font-extrabold text-[11px] tracking-wider uppercase">
            MAKE A DONATION
          </span>
            <span className="text-[#FF6B00] text-[10px] font-bold">
             {isNavratriCampaign ? 'Give with compassion 🧡' : 'Every rupee creates a kinder tomorrow 🧡'}
          </span>
        </div>

        <div className="grid grid-cols-4 gap-2 mb-2.5">
          {presets.map((amt) => {
            const isSelected = selectedPreset === amt && !customAmountValue && cartTotal === 0;
            return (
              <button
                key={amt}
                type="button"
                onClick={() => handlePresetClick(amt)}
                className={`border-2 rounded-xl min-h-11 py-1.5 px-1 text-center font-extrabold text-[11px] transition-all cursor-pointer ${
                  isSelected
                    ? 'border-[#FF6B00] bg-[#FFF0E6] text-[#FF6B00] ring-1 ring-[#FF6B00]/30 shadow-2xs'
                    : 'border-slate-300 bg-white text-[#002D62] hover:border-[#FF6B00] hover:bg-[#FFF0E6]/30 active:scale-95'
                }`}
              >
                ₹{amt.toLocaleString('en-IN')}
              </button>
            );
          })}
        </div>

        <div className="mb-3 flex items-stretch overflow-hidden rounded-xl border-2 border-slate-300 bg-white shadow-2xs focus-within:border-[#FF6B00] focus-within:ring-1 focus-within:ring-[#FF6B00]/30">
          <div className="relative flex w-1/2 min-w-0 items-center">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#FF6B00] font-black text-sm">
            ₹
          </span>
          <input
            type="text"
            inputMode="numeric"
            min={MIN_DONATION_AMOUNT}
            max={MAX_DONATION_AMOUNT}
            aria-label="Donation amount in rupees"
            aria-invalid={Boolean(amountError)}
            aria-describedby={amountError ? 'mobile-donation-amount-error' : undefined}
            step="1"
            placeholder="Enter custom amount"
            value={customAmountValue}
            onChange={(e) => handleCustomAmountChange(e.target.value)}
            className="w-full min-w-0 min-h-12 bg-transparent pl-7 pr-10 py-2 text-base font-bold text-[#002D62] placeholder:text-slate-400 focus:outline-hidden"
          />
          {customAmountValue && (
            <button
              type="button"
              onClick={() => handleCustomAmountChange('')}
              aria-label="Clear donation amount"
              className="absolute right-0 min-w-11 min-h-11 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              ✕
            </button>
          )}
          </div>

          <button
            type="button"
            onClick={handleDonate}
            disabled={donationUnavailable}
            aria-disabled={donationUnavailable}
            className="flex w-1/2 min-w-0 min-h-12 items-center justify-center gap-1 border-l-2 border-orange-200 bg-[#FF6B00] px-2 py-2.5 text-center text-xs font-black leading-tight text-white hover:bg-[#E05300] active:bg-[#C84800] transition-all cursor-pointer"
          >
            <span className="shrink-0">🧡</span>
            <span className="min-w-0 break-words">{campaignCtaLabel} • ₹{finalDonationAmount.toLocaleString('en-IN')}</span>
            <ArrowRight className="h-4 w-4 shrink-0" />
          </button>
        </div>

        {amountError && <p id="mobile-donation-amount-error" role="alert" className="mb-2 text-xs text-red-600">{amountError}</p>}

        <div className="grid grid-cols-2 gap-2 mt-2 pt-1">
          <div className="flex items-center gap-1.5 text-left">
            <Lock className="w-3 h-3 text-[#FF6B00] shrink-0" />
            <span className="text-[9px] font-semibold text-[#FF6B00] leading-tight">
              {isNavratriCampaign ? 'Secure giving' : '100% Secure &amp; Tax-Deductible'}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-left justify-end">
            <ShieldCheck className="w-3 h-3 text-[#FF6B00] shrink-0" />
            <span className="text-[9px] font-semibold text-[#FF6B00] leading-tight">
              {taxBenefitLabel}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

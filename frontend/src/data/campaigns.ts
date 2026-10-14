import { ProductItem, FinancialAllocation, CampaignUpdate, FaqItem, Donor, Currency } from '../types/campaign';
import { MIN_DONATION_AMOUNT } from '../constants/donation';
import dryGrassAsset from '../assets/campaigns/dry_grass.png';
import greenGrassAsset from '../assets/campaigns/green_grass.png';
import cowFoodAsset from '../assets/campaigns/cow_food.png';
import medicalKitAsset from '../assets/campaigns/medical_kit.png';

export const CAMPAIGN_ASSETS = {
  logo: "/punyakart-logo.png",
  heroRescue: "/hero-cow-new.jpg",
  products: {
    dryGrass: dryGrassAsset,
    greenGrass: greenGrassAsset,
    cowFood: cowFoodAsset,
    medicalKit: medicalKitAsset,
    rescueEquip: "/hero-cow-new.jpg"
  },
  stories: {
    story1: "/before.jpeg",
    story2: "/after.jpeg",
    story3: "/hero-cow-new.jpg"
  },
  moneyGoes: {
    medical: "/medical-support.jpeg",
    food: "/hunger-relief.jpeg",
    shelter: "/animal-welfare.jpeg",
    rescue: "/disaster-relief.jpeg"
  }
};

export const CURRENCIES: Currency[] = [
  { code: 'INR', symbol: '₹', rateFromINR: 1, minAmount: MIN_DONATION_AMOUNT },
  { code: 'USD', symbol: '$', rateFromINR: 0.012, minAmount: Math.ceil(MIN_DONATION_AMOUNT * 0.012) },
  { code: 'EUR', symbol: '€', rateFromINR: 0.011, minAmount: Math.ceil(MIN_DONATION_AMOUNT * 0.011) },
  { code: 'AED', symbol: 'د.إ', rateFromINR: 0.044, minAmount: Math.ceil(MIN_DONATION_AMOUNT * 0.044) }
];

export const CAMPAIGN_METRICS = {
  raisedINR: 335795,
  targetINR: 1250000,
  donorsCount: 485,
  daysLeft: 12,
  percentAchieved: 27
};

export const PRODUCTS_LIST: ProductItem[] = [
  {
    id: "prod-dry-grass",
    name: "Dry Grass",
    unitPrice: 416,
    unitLabel: "Set",
    fundedUnits: 142,
    targetUnits: 500,
    image: CAMPAIGN_ASSETS.products.dryGrass,
    description: "High-fiber dried nutritious fodder bundle aiding rumen digestion in recovering cows.",
    badge: "Most Requested"
  },
  {
    id: "prod-green-grass",
    name: "Fresh Green Grass",
    unitPrice: 416,
    unitLabel: "Set",
    fundedUnits: 88,
    targetUnits: 350,
    image: CAMPAIGN_ASSETS.products.greenGrass,
    description: "Moisture-rich fresh green forage vital for lactation, vitamin intake, and gut healing.",
    badge: "Daily Essential"
  },
  {
    id: "prod-cow-food",
    name: "Cow Food 50 KG High-Protein Feed",
    unitPrice: 1317,
    unitLabel: "Bag",
    fundedUnits: 53,
    targetUnits: 200,
    image: CAMPAIGN_ASSETS.products.cowFood,
    description: "Fortified grains, calcium, mineral supplements, and digestible nutrients for rapid post-trauma weight gain."
  },
  {
    id: "prod-medical-kit",
    name: "Medical Trauma Kit",
    unitPrice: 416,
    unitLabel: "Kit",
    fundedUnits: 119,
    targetUnits: 250,
    image: CAMPAIGN_ASSETS.products.medicalKit,
    description: "Antiseptics, maggot spray, wound bandages, sterile surgical gauze, painkillers, and saline IV drips."
  },
  {
    id: "prod-rescue-equip",
    name: "Rescue Equipment & Stretcher Setup",
    unitPrice: 3100,
    unitLabel: "Set",
    fundedUnits: 12,
    targetUnits: 30,
    image: CAMPAIGN_ASSETS.products.rescueEquip,
    description: "Heavy-duty lifting canvas belts, hydraulic vehicle harness, and emergency immobilization straps for roadside extractions."
  }
];

export const FINANCIAL_ALLOCATIONS: FinancialAllocation[] = [
  {
    id: "fin-1",
    material: "Dry Fodder & Nutritious Hay Bales (500 Bundles)",
    requiredQty: "500 Sets",
    unitCost: 416,
    totalAllocation: 208000,
    status: "Urgent Awaiting Funds",
    statusColor: "amber"
  },
  {
    id: "fin-2",
    material: "Fresh Green Chari / Lucerne Forage",
    requiredQty: "350 Sets",
    unitCost: 416,
    totalAllocation: 145600,
    status: "Partially Procured",
    statusColor: "blue"
  },
  {
    id: "fin-3",
    material: "High-Protein Nutritional Cattle Mash (50 KG Sacks)",
    requiredQty: "80 Bags",
    unitCost: 1317,
    totalAllocation: 105360,
    status: "Urgent Awaiting Funds",
    statusColor: "amber"
  },
  {
    id: "fin-4",
    material: "Trauma Dressing, Maggot Oil & Antibiotics",
    requiredQty: "150 Kits",
    unitCost: 416,
    totalAllocation: 62400,
    status: "Fully Disbursed",
    statusColor: "emerald"
  },
  {
    id: "fin-5",
    material: "Hydraulic Stretcher Belts & Van Winch Rigging",
    requiredQty: "15 Sets",
    unitCost: 3009,
    totalAllocation: 45140,
    status: "Awaiting Delivery",
    statusColor: "purple"
  }
];

export const INITIAL_DONORS: Donor[] = [
  {
    id: "d-1",
    name: "Suresh & Anita Sharma",
    amount: 51000,
    timeAgo: "2 hours ago",
    panNumberMasked: "AAAAA***5E",
    note: "Praying for full recovery of Gaumata. Har Har Mahadev.",
    isTop: true,
    isRecent: true
  },
  {
    id: "d-2",
    name: "Vikram Singhania",
    amount: 25000,
    timeAgo: "3 hours ago",
    panNumberMasked: "ABVPS***9K",
    note: "Thank you Punyakart team for your selfless rescue work in Uttarakhand.",
    isTop: true,
    isRecent: true
  },
  {
    id: "d-3",
    name: "Pooja Deshmukh",
    amount: 15000,
    timeAgo: "4 hours ago",
    panNumberMasked: "AXCPD***1L",
    note: "Sponsoring 10 medical trauma kits.",
    isTop: true
  },
  {
    id: "d-4",
    name: "Rameshwar K. Patel",
    amount: 11000,
    timeAgo: "5 hours ago",
    panNumberMasked: "BKPPP***3M",
    note: "In memory of my late mother Smt. Kamladevi.",
    isTop: true
  },
  {
    id: "d-5",
    name: "Ananya Roy",
    amount: 3000,
    timeAgo: "14 minutes ago",
    panNumberMasked: "ABCPR***7F",
    note: "May all innocent souls find peace and healing.",
    isRecent: true
  },
  {
    id: "d-6",
    name: "Anonymous Devotee",
    amount: 5000,
    timeAgo: "28 minutes ago",
    note: "Gauseva Paramo Dharma.",
    isRecent: true
  },
  {
    id: "d-7",
    name: "Karthik Venkatesh",
    amount: 2000,
    timeAgo: "42 minutes ago",
    panNumberMasked: "AYYKV***2P",
    isRecent: true
  },
  {
    id: "d-8",
    name: "Meenakshi Sundaram",
    amount: 1000,
    timeAgo: "1 hour ago",
    isRecent: true
  }
];

export const CAMPAIGN_UPDATES: CampaignUpdate[] = [
  {
    id: "up-1",
    date: "Today • 08:30 AM",
    tag: "Medical Milestone",
    title: "Sterile dressing applied & temperature stabilized",
    location: "Punyakart Rescue Sanctuary, Rishikesh",
    description: "Veterinary doctors removed 350+ necrotic maggots and completed deep antiseptic flush. The Gaumata took her first sips of clean electrolyte water and fresh tender green grass.",
    image: CAMPAIGN_ASSETS.stories.story2
  },
  {
    id: "up-2",
    date: "Yesterday • 04:15 PM",
    tag: "Emergency Transport",
    title: "Successful hydraulic stretcher transport from highway edge",
    location: "Dehradun-Haridwar Bypass, KM 14",
    description: "Our rapid response ambulance arrived within 28 minutes of local caller distress notification. Using reinforced lifting slings, the cow was safely hoisted onto the vehicle without spinal distortion.",
    image: CAMPAIGN_ASSETS.stories.story1
  }
];

export const FAQS: FaqItem[] = [
  {
    id: "faq-1",
    question: "How will my donation be utilized for these cows?",
    answer: "Every rupee goes directly towards verified procurement of feed (dry hay bales, green fodder, protein cattle mash), trauma surgery, veterinary medicines, anti-maggot dressings, and continuous shelter care. An itemized expense report is publicly updated."
  },
  {
    id: "faq-2",
    question: "Do I get an instant 80G Tax Exemption Certificate?",
    answer: "Yes! Punyakart Foundation is registered under Section 80G of the Indian Income Tax Act (Reg No: AADTP2149NF20214). Upon completing your donation, your 80G Certificate with official seal and QR verification is instantly issued for 50% tax deduction."
  },
  {
    id: "faq-3",
    question: "Can I donate through UPI (PhonePe, Google Pay, Paytm)?",
    answer: "Yes, our checkout supports all major UPI apps, dynamic QR scan, RuPay, Visa, MasterCard, and NetBanking through high-security 256-bit encrypted gateways."
  },
  {
    id: "faq-4",
    question: "Can I visit the Gaushala / Sanctuary in person?",
    answer: "Absolutely! We welcome donors, animal lovers, and families to visit our sanctuary in Rishikesh-Dehradun belt anytime between 9:00 AM to 5:00 PM to meet the rescued Gaumatas and witness the ongoing care firsthand."
  },
  {
    id: "faq-5",
    question: "What is the Monthly Hero sponsorship program?",
    answer: "The Monthly Hero initiative allows kind devotees to sponsor one or more recovering cows on an ongoing monthly basis (₹1,500/month per cow). You receive personalized monthly video updates on your sponsored cow's health and recovery."
  }
];

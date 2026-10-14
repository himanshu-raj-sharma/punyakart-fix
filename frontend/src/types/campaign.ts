export interface ProductItem {
  id: string;
  name: string;
  unitPrice: number;
  unitLabel: string;
  fundedUnits: number;
  targetUnits: number;
  image: string;
  description: string;
  badge?: string;
}

export interface DonationCartItem {
  product: ProductItem;
  quantity: number;
}

export interface Currency {
  code: 'INR' | 'USD' | 'EUR' | 'AED';
  symbol: string;
  rateFromINR: number;
  minAmount: number;
}

export interface Donor {
  id: string;
  name: string;
  amount: number;
  timeAgo: string;
  panNumberMasked?: string;
  avatarBg?: string;
  note?: string;
  isTop?: boolean;
  isRecent?: boolean;
}

export interface FinancialAllocation {
  id: string;
  material: string;
  requiredQty: string;
  unitCost: number;
  totalAllocation: number;
  status: 'Urgent Awaiting Funds' | 'Partially Procured' | 'Fully Disbursed' | 'Awaiting Delivery';
  statusColor: 'amber' | 'blue' | 'emerald' | 'purple';
}

export interface CampaignUpdate {
  id: string;
  date: string;
  title: string;
  tag: string;
  description: string;
  image?: string;
  location: string;
}

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

export interface TaxReceiptData {
  receiptNumber: string;
  donorName: string;
  email: string;
  phone: string;
  panNumber: string;
  amount: number;
  currency: string;
  paymentMode: string;
  paymentDate: string;
  transactionRef: string;
  is80GEligible: boolean;
}

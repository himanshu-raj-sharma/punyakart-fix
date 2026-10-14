import { StoredDonation } from './types';
import { normalizeLookup } from './db/certificateLookup';
import logger from './logger';

export type RazorpayPaymentSnapshot = {
  id: string;
  order_id?: string;
  amount: number | string;
  status?: string;
  captured?: boolean | string;
  email?: string;
  contact?: string | number;
  notes?: Record<string, string | number | undefined>;
  description?: string;
  created_at?: number;
  vpa?: string | null;
  acquirer_data?: {
    rrn?: string;
    bank_transaction_id?: string;
    upi_transaction_id?: string;
  };
};

export type RazorpayClientLike = {
  payments: {
    fetch: (id: string) => Promise<RazorpayPaymentSnapshot>;
    all: (params: { count: number; skip: number }) => Promise<{ items?: RazorpayPaymentSnapshot[] }>;
  };
  orders: {
    fetch: (id: string) => Promise<{ notes?: Record<string, string | number> }>;
    fetchPayments: (id: string) => Promise<{ items?: RazorpayPaymentSnapshot[] }>;
  };
};

export type GatewayPaymentFinder = {
  findCapturedPayment(query: string): Promise<RazorpayPaymentSnapshot | null>;
};

function digits(value: string | undefined): string {
  return (value || '').replace(/\D/g, '');
}

function last10(value: string | undefined): string {
  const d = digits(value);
  return d.length >= 10 ? d.slice(-10) : d;
}

function compact(value: string | undefined): string {
  return normalizeLookup(value || '').replace(/[^a-z0-9]/g, '');
}

function noteMap(notes?: Record<string, string | number | undefined>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(notes || {})) {
    if (value !== undefined && value !== null && String(value).trim()) {
      out[key] = String(value);
    }
  }
  return out;
}

export function isCapturedPayment(payment: RazorpayPaymentSnapshot): boolean {
  return payment.status === 'captured';
}

function extractIds(query: string): { paymentIds: string[]; orderIds: string[] } {
  return {
    paymentIds: query.match(/pay_[A-Za-z0-9]+/g) || [],
    orderIds: query.match(/order_[A-Za-z0-9]+/g) || [],
  };
}

export function paymentMatchesQuery(payment: RazorpayPaymentSnapshot, query: string): boolean {
  if (!isCapturedPayment(payment)) return false;

  const tokens = [
    normalizeLookup(query),
    ...normalizeLookup(query).split(/[\s,;/|]+/).filter((part) => part.length >= 2),
  ];
  const queryDigits = last10(query);
  const notes = noteMap(payment.notes);
  const fields = [
    payment.id,
    payment.order_id,
    payment.email,
    String(payment.contact || ''),
    payment.vpa || '',
    payment.description,
    payment.acquirer_data?.rrn,
    payment.acquirer_data?.bank_transaction_id,
    payment.acquirer_data?.upi_transaction_id,
    ...Object.values(notes),
  ]
    .filter(Boolean)
    .map((value) => normalizeLookup(String(value)));

  const compactFields = fields.map((value) => compact(value));

  if (queryDigits.length === 10 && last10(String(payment.contact || notes.phone || '')) === queryDigits) {
    return true;
  }

  return tokens.some((token) => {
    if (fields.includes(token)) return true;
    const compactToken = compact(token);
    if (compactToken.length >= 8 && compactFields.some((field) => field.includes(compactToken) || compactToken.includes(field))) {
      return true;
    }
    const name = normalizeLookup(notes.fullName || notes.name || notes.donor_name || '');
    return token.length >= 4 && Boolean(name) && (name === token || name.includes(token));
  });
}

function shouldScanRecentPayments(query: string): boolean {
  const normalized = normalizeLookup(query);
  if (!normalized) return false;
  if (/^pkf[\s-]/.test(normalized) || /^txn/.test(normalized) || /^don-/.test(normalized)) return false;
  if (query.includes('@')) return true;
  if (digits(query).length >= 10) return true;
  if (/^[a-z][a-z.'\s-]+$/i.test(query.trim()) && query.trim().length >= 4) return true;
  if (/^[A-Z]{5}\d{4}[A-Z]$/i.test(query.trim())) return true;
  return compact(query).length >= 8;
}

async function mergeOrderNotes(
  razorpay: RazorpayClientLike,
  payment: RazorpayPaymentSnapshot,
): Promise<RazorpayPaymentSnapshot> {
  if (!payment.order_id) return payment;
  try {
    const order = await razorpay.orders.fetch(payment.order_id);
    return {
      ...payment,
      notes: { ...noteMap(order.notes), ...noteMap(payment.notes) },
    };
  } catch {
    return payment;
  }
}

export function mapRazorpayPaymentToDonation(payment: RazorpayPaymentSnapshot): StoredDonation {
  const notes = noteMap(payment.notes);
  const created = payment.created_at ? new Date(payment.created_at * 1000) : new Date();
  const suffix = compact(payment.id).replace(/^pay/, '').slice(-8).toUpperCase() || '00000000';
  const donationId = notes.donation_id || `DON-RZP-${payment.id}`;
  const phone = String(payment.contact || notes.phone || '');
  const email = String(payment.email || notes.email || '').toLowerCase();

  return {
    id: donationId,
    amount: Math.round(Number(payment.amount) / 100),
    type: 'one-time',
    causeTitle: notes.cause || notes.causeTitle || payment.description || 'Online Donation',
    fullName: notes.fullName || notes.name || notes.donor_name || (email ? email.split('@')[0] : 'Donor'),
    email: email || 'donor@punyakart.com',
    phone: phone || '0000000000',
    address: notes.address || '',
    panNumber: (notes.pan || notes.panNumber || '').toUpperCase(),
    want80G: true,
    paymentMethod: 'razorpay',
    fundRaiser: notes.fundRaiser || notes.fund_raiser || undefined,
    timestamp: created.toISOString(),
    terminal: 'Razorpay',
    source:
      notes.source === 'campaign' || notes.source === 'manual'
        ? notes.source
        : notes.source === 'chennai_airport'
          ? 'chennai_airport'
          : undefined,
    receiptNumber: `PKF-${created.getFullYear()}-${suffix}`,
    transactionId: payment.id,
    status: 'verified',
    verifiedAt: created.toISOString(),
    paymentRef: payment.id,
    razorpayOrderId: payment.order_id,
  };
}

export function createRazorpayPaymentFinder(razorpay: RazorpayClientLike): GatewayPaymentFinder {
  return {
    async findCapturedPayment(query: string) {
      const { paymentIds, orderIds } = extractIds(query);

      for (const paymentId of paymentIds) {
        try {
          const payment = await mergeOrderNotes(razorpay, await razorpay.payments.fetch(paymentId));
          if (isCapturedPayment(payment)) return payment;
        } catch (err) {
          logger.warn({ err, paymentId }, 'Razorpay payment fetch failed');
        }
      }

      for (const orderId of orderIds) {
        try {
          const result = await razorpay.orders.fetchPayments(orderId);
          const captured = (result.items || []).find(isCapturedPayment);
          if (captured) return mergeOrderNotes(razorpay, captured);
        } catch (err) {
          logger.warn({ err, orderId }, 'Razorpay order payments fetch failed');
        }
      }

      if (!shouldScanRecentPayments(query)) return null;

      try {
        for (let skip = 0; skip < 400; skip += 100) {
          const page = await razorpay.payments.all({ count: 100, skip });
          const items = page.items || [];
          const match = items.find((payment) => paymentMatchesQuery(payment, query));
          if (match) return mergeOrderNotes(razorpay, match);
          if (items.length < 100) break;
        }
      } catch (err) {
        logger.warn({ err }, 'Razorpay payment list failed');
      }

      return null;
    },
  };
}

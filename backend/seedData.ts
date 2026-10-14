import { StoredSubscription } from './types';

export const initialSubscriptions: StoredSubscription[] = [
  {
    id: 'SUB-801',
    donorName: 'Dr. Radhika M.',
    email: 'dr.radhika@example.com',
    phone: '9840122334',
    amount: 2000,
    frequency: 'MONTHLY',
    causeTitle: 'Help to Feed 20 Animals',
    startDate: '2026-08-25',
    nextBillingDate: '2026-09-25',
    status: 'ACTIVE',
    paymentMethod: 'razorpay',
    panNumber: 'PQRSK5678G',
  },
];
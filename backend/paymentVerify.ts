import { BusinessError } from './errors';
import { StoredDonation } from './types';

export interface GatewayPaymentSnapshot {
  id: string;
  order_id?: string;
  amount: number;
  status: string;
  captured?: boolean;
}

export function assertPaymentMatchesDonation(
  donation: StoredDonation,
  payment: GatewayPaymentSnapshot,
  razorpayOrderId: string,
): void {
  if (!donation.razorpayOrderId || donation.razorpayOrderId !== razorpayOrderId) {
    throw new BusinessError('Payment order does not match this donation.', 'VALIDATION_ERROR');
  }
  if (payment.order_id && payment.order_id !== razorpayOrderId) {
    throw new BusinessError('Payment does not belong to the stated order.', 'VALIDATION_ERROR');
  }
  const captured = payment.status === 'captured' || payment.captured === true;
  if (!captured) {
    throw new BusinessError('Payment is not captured yet.', 'VALIDATION_ERROR');
  }
  if (Number(payment.amount) !== donation.amount * 100) {
    throw new BusinessError('Paid amount does not match this donation.', 'VALIDATION_ERROR');
  }
}

export function assertSubscriptionPaymentMatchesDonation(
  donation: StoredDonation,
  payment: GatewayPaymentSnapshot,
  razorpaySubscriptionId: string,
): void {
  if (!donation.razorpaySubscriptionId || donation.razorpaySubscriptionId !== razorpaySubscriptionId) {
    throw new BusinessError('Payment subscription does not match this donation.', 'VALIDATION_ERROR');
  }
  const captured = payment.status === 'captured' || payment.captured === true;
  if (!captured) {
    throw new BusinessError('Payment is not captured yet.', 'VALIDATION_ERROR');
  }
  if (Number(payment.amount) !== donation.amount * 100) {
    throw new BusinessError('Paid amount does not match this donation.', 'VALIDATION_ERROR');
  }
}

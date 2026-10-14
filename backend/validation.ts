import { BusinessError } from './errors';
import { DonationInput } from './types';
import { getDonationAmountError, isValidDonationAmount, normalizeDonationSource } from '../frontend/src/constants/donation';
export { normalizeDonationSource } from '../frontend/src/constants/donation';

const PAN_PATTERN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateDonationInput(input: DonationInput): void {
  // Guard against completely missing/non-object body
  if (!input || typeof input !== 'object') {
    throw new BusinessError('Request body is missing or not valid JSON.', 'VALIDATION_ERROR');
  }

  const details: Record<string, string> = {};
  const source = normalizeDonationSource(input.source);
  if (!isValidDonationAmount(input.amount, source)) {
    details.amount = getDonationAmountError(source);
  }
  if (!['one-time', 'monthly'].includes(input.type)) details.type = 'Donation type is invalid.';
  if (!input.causeTitle?.trim()) details.causeTitle = 'Donation purpose is required.';
  if (!input.fullName?.trim()) details.fullName = 'Donor name is required.';
  if (!input.phone?.trim() || input.phone.replace(/\D/g, '').length < 10) details.phone = 'A valid mobile number is required.';
  if (!input.address?.trim()) details.address = 'Postal address is required for the donation record.';
  if (input.email && !EMAIL_PATTERN.test(input.email.trim())) details.email = 'Email address is invalid.';
  if (input.panNumber && !PAN_PATTERN.test(input.panNumber.trim().toUpperCase())) details.panNumber = 'PAN number is invalid.';
  if (Object.keys(details).length > 0) throw new BusinessError('Donation details are invalid.', 'VALIDATION_ERROR', details);
  input.source = source;
}

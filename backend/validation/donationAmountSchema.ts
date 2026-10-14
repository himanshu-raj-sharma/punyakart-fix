import { z } from 'zod';
import { DONATION_AMOUNT_ERROR, MAX_DONATION_AMOUNT, MIN_DONATION_AMOUNT } from '../../frontend/src/constants/donation';

/** For new donations and editable donation offers, never historical paid records. */
export const donationAmountSchema = z.number({ error: DONATION_AMOUNT_ERROR })
  .finite(DONATION_AMOUNT_ERROR)
  .int(DONATION_AMOUNT_ERROR)
  .min(MIN_DONATION_AMOUNT, DONATION_AMOUNT_ERROR)
  .max(MAX_DONATION_AMOUNT, DONATION_AMOUNT_ERROR);

import { isValidDonationAmount } from '../constants/donation';

/** Parse native whole-unit input strictly, then validate the payable INR amount. */
export function parseDonationCurrencyAmount(value: string, rateFromINR: number, source = 'crowd_funding'): number | null {
  if (!/^\d+$/.test(value.trim()) || !Number.isFinite(rateFromINR) || rateFromINR <= 0) return null;
  const nativeAmount = Number(value.trim());
  if (!Number.isSafeInteger(nativeAmount) || nativeAmount <= 0) return null;
  const inrAmount = Math.round(nativeAmount / rateFromINR);
  return isValidDonationAmount(inrAmount, source) ? inrAmount : null;
}

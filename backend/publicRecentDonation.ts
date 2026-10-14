import type { StoredDonation } from './types.js';

export function toPublicRecentDonation(donation: StoredDonation) {
  const parts = donation.fullName.trim().split(/\s+/);
  const name = donation.dedication?.isAnonymous === true ? 'Anonymous Donor'
    : parts.length >= 2 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : parts[0];
  return {
    id: donation.id,
    name,
    amount: donation.amount,
    date: donation.verifiedAt || donation.timestamp,
  };
}

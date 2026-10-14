import { BusinessError } from './errors.js';
import { validateDonationPayload } from './validation/donationSchema.js';

interface CampaignLookup {
  findById(id: string): Promise<{ id: string; title: string; is_active: boolean } | null>;
}

/** Run before saving a donation or creating any gateway order/subscription. */
export async function validateActiveCampaignDonation(input: unknown, campaigns: CampaignLookup) {
  const donation = validateDonationPayload(input);
  if (!donation.campaignId) return donation;
  const campaign = await campaigns.findById(donation.campaignId);
  if (!campaign || campaign.is_active !== true) {
    throw new BusinessError('This campaign is not available for donations.', 'NOT_FOUND');
  }
  return { ...donation, campaignId: campaign.id, source: `campaign_${campaign.id}`, causeTitle: campaign.title };
}

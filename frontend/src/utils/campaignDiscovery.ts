import {
  NAVRATRI_CAMPAIGN_ID,
  NAVRATRI_CAMPAIGN_PATH,
  NAVRATRI_DONATION_SOURCE,
} from '../data/navratriCampaign';
import { isValidDonationAmount, MIN_DONATION_AMOUNT } from '../constants/donation';
import { campaignPathForId, canonicalCampaignId } from './campaignRoutes';

export interface CampaignCardItem {
  id: string;
  title: string;
  category: string;
  organizer: string;
  raised?: number;
  target?: number;
  donors?: number;
  image: string;
  hasTaxBenefit: boolean;
  imagePosition?: string;
  donationPresets?: unknown;
  isActive?: boolean;
  isApiConfirmed?: boolean;
}

/** Undefined means preview only; every valid API list (even empty) is authoritative. */
export function mergeDiscoveryCampaigns(
  fallbacks: readonly CampaignCardItem[],
  confirmed?: readonly CampaignCardItem[],
): CampaignCardItem[] {
  if (confirmed === undefined) return fallbacks.map(campaign => ({
    ...campaign, id: canonicalCampaignId(campaign.id), raised: undefined, target: undefined, donors: undefined,
    hasTaxBenefit: false, isActive: false, isApiConfirmed: false,
  }));
  const serverCampaigns = new Map<string, CampaignCardItem>();
  for (const campaign of confirmed) {
    if (campaign.isActive === true && !serverCampaigns.has(campaign.id)) {
      const id = canonicalCampaignId(campaign.id);
      if (!serverCampaigns.has(id)) serverCampaigns.set(id, { ...campaign, id, isApiConfirmed: true });
    }
  }
  return [...serverCampaigns.values()];
}

export function canDonateToCampaignCard(card: CampaignCardItem): boolean {
  return card.isApiConfirmed === true && card.isActive === true;
}

export function parseDiscoveryCampaigns(payload: unknown): CampaignCardItem[] {
  const data = payload as { success?: boolean; campaigns?: Array<Record<string, unknown>> } | null;
  if (data?.success !== true || !Array.isArray(data.campaigns)) throw new Error('Invalid campaign listing');
  return data.campaigns.map(c => {
    if (!c || !['id', 'title', 'category', 'organizer'].every(key => typeof c[key] === 'string' && (c[key] as string).trim())
      || typeof c.is_active !== 'boolean') throw new Error('Invalid campaign listing record');
    const stat = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined;
    return {
      id: canonicalCampaignId(c.id as string), title: c.title as string, category: c.category as string, organizer: c.organizer as string,
      raised: stat(c.raised), target: stat(c.target), donors: stat(c.donors),
      image: typeof c.image === 'string' ? c.image : '', hasTaxBenefit: c.has_tax_benefit === true,
      donationPresets: c.donation_presets, isActive: c.is_active, isApiConfirmed: true,
    };
  });
}

export function getCampaignDonationSelection(card: CampaignCardItem): [title: string, amount: number, campaignId: string] {
  const id = canonicalCampaignId(card.id);
  const presets = Array.isArray(card.donationPresets) ? card.donationPresets : [];
  const firstValidPreset = presets.find((amount) =>
    typeof amount === 'number' && isValidDonationAmount(amount, NAVRATRI_DONATION_SOURCE),
  );
  return [card.title, id === NAVRATRI_CAMPAIGN_ID ? (firstValidPreset ?? MIN_DONATION_AMOUNT) : 1000, id];
}

export function getCampaignDonationSource(campaignId: string): string {
  const id = canonicalCampaignId(campaignId);
  return id === NAVRATRI_CAMPAIGN_ID ? NAVRATRI_DONATION_SOURCE : `campaign_${id}`;
}

/** No progress percentage exists for a campaign with no fixed goal. */
export function getCampaignProgress(raised: number | undefined, target: number | undefined): number | null {
  if (typeof target !== 'number' || !Number.isFinite(target) || target <= 0 || typeof raised !== 'number' || !Number.isFinite(raised) || raised < 0) return null;
  return Math.min(100, Math.max(0, Math.round((raised / target) * 100)));
}

export function isCampaignCardActivation(key: string, isCardTarget: boolean): boolean {
  return isCardTarget && (key === 'Enter' || key === ' ');
}

export function getCampaignShareUrl(campaignId: string, origin = 'https://punyakart.com'): string {
  const url = new URL(
    canonicalCampaignId(campaignId) === NAVRATRI_CAMPAIGN_ID ? NAVRATRI_CAMPAIGN_PATH : campaignPathForId(campaignId),
    origin,
  );
  url.searchParams.set('utm_source', 'whatsapp');
  url.searchParams.set('utm_medium', 'share');
  return url.toString();
}

export function getCampaignWhatsAppUrl(card: Pick<CampaignCardItem, 'id' | 'title'>, origin?: string): string {
  const url = getCampaignShareUrl(card.id, origin);
  const message = canonicalCampaignId(card.id) === NAVRATRI_CAMPAIGN_ID
    ? `Support "${card.title}" on Punyakart Foundation. Campaign details: ${url}`
    : `Please support this noble cause on Punyakart Foundation: "${card.title}". Every donation makes an immediate difference! Check details here: ${url}`;
  return `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
}

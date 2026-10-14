import type { DonationSource } from '../types';
import { canonicalCampaignId } from './campaignRoutes';

/** Display saved provenance without inventing Chennai attribution for missing historical data. */
export function resolveRecordedDonationSource(row: { source?: string; campaignId?: string }): string {
  const value = typeof row.source === 'string' ? row.source.trim() : '';
  if (value) {
    if (value.toLowerCase() === 'chennai_airport') return 'chennai_airport';
    if (value.toLowerCase().startsWith('campaign_')) {
      return `campaign_${canonicalCampaignId(value.slice('campaign_'.length))}`;
    }
    return value;
  }
  const campaignId = typeof row.campaignId === 'string' ? row.campaignId.trim() : '';
  return campaignId ? `campaign_${canonicalCampaignId(campaignId)}` : 'unknown';
}

/** Shared header, footer and sticky-bar attribution follows the visible campaign. */
export function getQuickDonationSource(activePage: string, campaignId?: string): DonationSource {
  switch (activePage) {
    case 'crowd': return 'crowd_funding';
    case 'second-campaign': return 'campaign_c2';
    case 'tuesday-campaign': return 'campaign_c3';
    case 'fourth-campaign': return 'campaign_c4';
    case 'fifth-campaign': return 'campaign_c5';
    case 'birthday-campaign': return 'campaign_c6';
    case 'navratri-campaign': return 'campaign_c7';
    case 'campaign-detail':
      return `campaign_${canonicalCampaignId(!campaignId || campaignId === 'detail' ? 'c1' : campaignId)}`;
    default: return 'chennai_airport';
  }
}

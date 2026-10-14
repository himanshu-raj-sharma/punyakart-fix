import { useEffect, useState } from 'react';
import type { CampaignContent } from '../types/campaignCms';
import { snapshotForSource, startPublicSnapshotPolling, type PublicSnapshot } from '../utils/publicCampaignPolling';
import { canonicalCampaignId } from '../utils/campaignRoutes';

export interface PublicCampaign {
  id: string;
  title?: string;
  category?: string;
  organizer?: string;
  image?: string;
  description?: string;
  is_active?: boolean;
  has_tax_benefit?: boolean;
  hero_title?: string;
  donation_presets?: number[];
  faqs?: Array<{ question: string; answer: string }>;
  content?: CampaignContent;
  raised?: number;
  target?: number;
  donors?: number;
}

export function parsePublicCampaign(payload: unknown, campaignId: string): PublicCampaign {
  const data = payload as { success?: boolean; campaign?: PublicCampaign } | null;
  const expectedId = canonicalCampaignId(campaignId);
  const returnedId = typeof data?.campaign?.id === 'string' ? canonicalCampaignId(data.campaign.id) : '';
  if (data?.success !== true || returnedId !== expectedId || typeof data.campaign.is_active !== 'boolean') {
    throw new Error('Invalid campaign response');
  }
  return data.campaign.id === expectedId ? data.campaign : { ...data.campaign, id: expectedId };
}

export function usePublicCampaign(campaignId: string) {
  const id = canonicalCampaignId(campaignId);
  const source = `/api/campaigns/${encodeURIComponent(id)}`;
  const [state, setState] = useState<PublicSnapshot<PublicCampaign>>({ source, data: null, status: 'loading' });
  useEffect(() => startPublicSnapshotPolling(source, payload => parsePublicCampaign(payload, id), setState), [source, id]);
  const current = snapshotForSource(state, source);
  return { id, campaign: current.data, status: current.status };
}

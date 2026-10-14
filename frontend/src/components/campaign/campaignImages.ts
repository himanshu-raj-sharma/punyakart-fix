import emergencyReliefImg from '../../assets/images/photo-1488521787991-ed7bbaae773c.jpg';
import tuesdaySevaImg from '../../assets/images/regenerated_image_1790524556850.jpg';
import pitrPakshaImg from '../../assets/campaigns/regenerated_image_1789631745062.jpg';
import gauSevaImg from '../../assets/campaigns/gau-seva-campaign.jpg';
import thursdayGauSevaImg from '../../assets/campaigns/thursday-gau-seva-campaign.png';
import birthdayHeroImg from '../../assets/campaigns/c6-hero.jpg';
import { NAVRATRI_CAMPAIGN_ID, NAVRATRI_DEFAULT_CAMPAIGN } from '../../data/navratriCampaign';
import { canonicalCampaignId } from '../../utils/campaignRoutes';

const campaignImageFallbacks: Record<string, string> = {
  c1: emergencyReliefImg,
  c2: pitrPakshaImg,
  c3: tuesdaySevaImg,
  c4: gauSevaImg,
  c5: thursdayGauSevaImg,
  c6: birthdayHeroImg,
  [NAVRATRI_CAMPAIGN_ID]: NAVRATRI_DEFAULT_CAMPAIGN.image,
};

export function resolveCampaignImage(campaignId: string, image?: string): string {
  campaignId = canonicalCampaignId(campaignId);
  if (campaignId === 'c6' && !image?.trim()) {
    return campaignImageFallbacks.c6;
  }
  if (campaignId === NAVRATRI_CAMPAIGN_ID) {
    return !image?.trim() || image.trim() === '/navratri-seva.svg'
      ? campaignImageFallbacks[NAVRATRI_CAMPAIGN_ID]
      : image;
  }
  if (campaignId === 'c4' && (!image || image === '/hero-cow-new.jpg' || image === '/campaign-images/gau-seva-campaign.png' || image === '/campaign-images/gau-seva-campaign.jpg')) {
    return campaignImageFallbacks.c4;
  }
  if (image && !image.startsWith('/campaign-')) return image;
  return campaignImageFallbacks[campaignId] || '';
}

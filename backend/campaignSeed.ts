import type { CreateCampaignInput, MongoCampaignRepository } from './db/MongoCampaignRepository.js';
import { NAVRATRI_DEFAULT_CAMPAIGN } from '../frontend/src/data/navratriCampaign.js';

const DEFAULT_CAMPAIGNS: CreateCampaignInput[] = [
  {
    id: 'c1',
    title: 'Support Emergency Rescue & Relief Operations Across India',
    category: 'All Causes',
    organizer: 'Punyakart Foundation',
    target: 100000,
    image: '/disaster-relief.jpeg',
    description: 'Help provide urgent rescue, medical care, food, and shelter to vulnerable lives.',
    sort_order: 1,
    has_tax_benefit: true,
    is_active: true,
    donation_presets: [500, 1000, 2500, 5000],
    faqs: [],
  },
  {
    id: 'c2',
    title: 'Let this Pitr Paksha be a time of remembrance, gratitude and compassion.',
    category: 'Faith',
    organizer: 'Punyakart Foundation',
    target: 1250000,
    image: '/campaign-images/gau-seva-campaign.jpg',
    description: 'Support food, shelter, rescue, and medical treatment for abandoned and injured animals.',
    sort_order: 2,
    has_tax_benefit: true,
    is_active: true,
    donation_presets: [1000, 2000, 5000, 10000],
    faqs: [],
  },
  {
    id: 'c3',
    title: 'This Tuesday, Turn Your Faith Into Seva',
    category: 'Animals',
    organizer: 'Punyakart Foundation',
    target: 150000,
    image: '/hero-cow-new.jpg',
    description: 'Turn devotion into practical seva through fodder, food, rescue, and medical support.',
    sort_order: 3,
    has_tax_benefit: true,
    is_active: true,
    donation_presets: [501, 1001, 2100, 5100],
    faqs: [],
  },
  {
    id: 'c4',
    title: '1,400+ Lives Depend on Your Kindness — Donate Today',
    category: 'Animals',
    organizer: 'Punyakart Foundation',
    target: 500000,
    image: '/hero-cow-new.jpg',
    description: 'Punyakart Foundation is dedicated to the care and protection of 1,400+ Gau Mata. Every day, we receive 10+ calls for accident cases, involving animals who are injured, helpless, and in urgent need of medical attention.',
    sort_order: 4,
    has_tax_benefit: true,
    is_active: true,
    donation_presets: [501, 1001, 2100, 5100],
    faqs: [],
  },
  {
    id: 'c5',
    title: 'This Thursday, Let’s Feed 1,400+ Gaumata',
    category: 'Animals',
    organizer: 'Punyakart Foundation',
    target: 500000,
    image: '/campaign-images/thursday-gau-seva-campaign.png',
    description: 'Support food, fodder, vegetables, and medical care for 1,400+ Gau Mata.',
    sort_order: 5,
    has_tax_benefit: true,
    donation_presets: [501, 1001, 2100, 5100],
    faqs: [],
  },
  {
    id: 'c6',
    title: 'Celebrate Your Special Day by Sharing Happiness',
    category: 'Children',
    organizer: 'Punyakart Foundation',
    target: 500000,
    image: '',
    description: 'Turn your birthday, anniversary, graduation, or special occasion into meals, joy, and celebration for underprivileged children living in slum communities.',
    sort_order: 6,
    has_tax_benefit: true,
    is_active: true,
    donation_presets: [501, 1001, 2501, 5001, 10001],
    faqs: [],
  },
  {
    id: NAVRATRI_DEFAULT_CAMPAIGN.id,
    title: NAVRATRI_DEFAULT_CAMPAIGN.title,
    category: NAVRATRI_DEFAULT_CAMPAIGN.category,
    organizer: NAVRATRI_DEFAULT_CAMPAIGN.organizer,
    target: NAVRATRI_DEFAULT_CAMPAIGN.target,
    image: NAVRATRI_DEFAULT_CAMPAIGN.image,
    description: NAVRATRI_DEFAULT_CAMPAIGN.description,
    sort_order: NAVRATRI_DEFAULT_CAMPAIGN.sort_order,
    has_tax_benefit: NAVRATRI_DEFAULT_CAMPAIGN.has_tax_benefit,
    is_active: NAVRATRI_DEFAULT_CAMPAIGN.is_active,
    donation_presets: NAVRATRI_DEFAULT_CAMPAIGN.donation_presets,
    content: NAVRATRI_DEFAULT_CAMPAIGN.content,
    faqs: NAVRATRI_DEFAULT_CAMPAIGN.faqs,
  },
];

export async function seedDefaultCampaignsIfEmpty(
  campaignRepo: MongoCampaignRepository,
): Promise<void> {
  const existing = await campaignRepo.listWithStats(false);
  const existingIds = new Set(existing.map((campaign) => campaign.id));
  for (const campaign of DEFAULT_CAMPAIGNS) {
    if (!existingIds.has(campaign.id)) {
      await campaignRepo.create(campaign);
    }
  }
}

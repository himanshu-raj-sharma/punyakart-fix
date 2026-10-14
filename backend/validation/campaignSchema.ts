import { z } from 'zod';
import { donationAmountSchema } from './donationAmountSchema';

const urlField = z.string().trim().max(2_000).refine(
  (value) => /^https?:\/\/\S+$/i.test(value) || /^\/(?!\/)[A-Za-z0-9/_\-.%]+$/.test(value),
  'Use an http(s) URL or a safe site-relative path.',
);
const contentCardSchema = z.object({
  id: z.string().trim().min(1).max(80),
  price: donationAmountSchema,
  unit: z.string().trim().min(1).max(40),
  title: z.string().trim().min(1).max(160),
  subtitle: z.string().trim().max(500),
  image: urlField,
  icon: z.string().trim().max(20).optional(),
}).strict();
const aboutCardSchema = z.object({
  id: z.string().trim().min(1).max(80),
  image: urlField,
  line1: z.string().trim().max(120),
  line2: z.string().trim().max(120),
  line3: z.string().trim().max(120),
  supportAmount: donationAmountSchema,
}).strict();
const recoveryStorySchema = z.object({
  id: z.string().trim().min(1).max(80),
  title: z.string().trim().max(160),
  subtitle: z.string().trim().max(160),
  statusBadge: z.string().trim().max(100),
  beforeImg: urlField,
  afterImg: urlField,
  description: z.string().trim().max(1_000),
  supportAmount: donationAmountSchema,
}).strict();
const contentSchema = z.object({
  hero_title: z.string().trim().max(240).optional(),
  hero_subtitle: z.string().trim().max(5_000).optional(),
  contribution_heading: z.string().trim().max(160).optional(),
  contribution_subtitle: z.string().trim().max(500).optional(),
  contribution_cards: z.array(contentCardSchema).max(12).optional(),
  impact_eyebrow: z.string().trim().max(100).optional(),
  impact_title: z.string().trim().max(240).optional(),
  impact_description: z.string().trim().max(1_000).optional(),
  progress_percent: z.number().finite().min(0).max(100).optional(),
  impact_goal_label: z.string().trim().max(80).optional(),
  impact_raised_label: z.string().trim().max(80).optional(),
  impact_donors_label: z.string().trim().max(80).optional(),
  about_eyebrow: z.string().trim().max(100).optional(),
  about_title: z.string().trim().max(160).optional(),
  about_banner_title: z.string().trim().max(240).optional(),
  about_banner_description: z.string().trim().max(2_000).optional(),
  seva_sankalp_text: z.string().trim().max(2_000).optional(),
  about_cards: z.array(aboutCardSchema).max(12).optional(),
  about_closing_text: z.string().trim().max(500).optional(),
  recovery_eyebrow: z.string().trim().max(100).optional(),
  recovery_title: z.string().trim().max(200).optional(),
  recovery_description: z.string().trim().max(1_000).optional(),
  recovery_stories: z.array(recoveryStorySchema).max(12).optional(),
  allocation_eyebrow: z.string().trim().max(100).optional(),
  allocation_title: z.string().trim().max(200).optional(),
  allocation_rows: z.array(z.object({
    amount: z.string().trim().max(80),
    purpose: z.string().trim().max(240),
  }).strict()).max(20).optional(),
  donor_wall_title: z.string().trim().max(200).optional(),
  donor_wall_description: z.string().trim().max(500).optional(),
  donor_wall_badge: z.string().trim().max(160).optional(),
  faq_title: z.string().trim().max(160).optional(),
  faq_quote_title: z.string().trim().max(160).optional(),
  faq_quote_description: z.string().trim().max(500).optional(),
  section_visibility: z.object({
    contribution: z.boolean().optional(),
    impact: z.boolean().optional(),
    about: z.boolean().optional(),
    recovery: z.boolean().optional(),
    allocation: z.boolean().optional(),
    donor_wall: z.boolean().optional(),
    faq: z.boolean().optional(),
  }).strict().optional(),
}).strict();

const campaignFields = {
  title: z.string().trim().min(2).max(160),
  category: z.string().trim().min(2).max(80),
  organizer: z.string().trim().min(2).max(160),
  target: z.number().finite().int().min(0).max(1_000_000_000),
  image: z.union([urlField, z.string().trim().length(0)]),
  description: z.string().trim().max(5_000),
  sort_order: z.number().finite().int().min(0).max(100_000),
  has_tax_benefit: z.boolean(),
  is_active: z.boolean(),
  content: contentSchema,
  donation_presets: z.array(donationAmountSchema).max(12),
  faqs: z.array(z.object({
    question: z.string().trim().min(1).max(500),
    answer: z.string().trim().max(2_000),
  }).strict()).max(20),
};

export const createCampaignSchema = z.object({
  ...campaignFields,
  image: campaignFields.image.optional().default(''),
  description: campaignFields.description.optional().default(''),
  sort_order: campaignFields.sort_order.optional().default(0),
  has_tax_benefit: campaignFields.has_tax_benefit.optional().default(true),
  is_active: campaignFields.is_active.optional().default(true),
  content: campaignFields.content.optional(),
  donation_presets: campaignFields.donation_presets.optional(),
  faqs: campaignFields.faqs.optional(),
}).strict();

export const updateCampaignSchema = z.object({
  ...campaignFields,
}).partial().strict();

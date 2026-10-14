export interface CampaignContributionCard {
  id: string;
  price: number;
  unit: string;
  title: string;
  subtitle: string;
  image: string;
  icon?: string;
}

export interface CampaignAboutCard {
  id: string;
  image: string;
  line1: string;
  line2: string;
  line3: string;
  supportAmount: number;
}

export interface CampaignRecoveryStory {
  id: string;
  title: string;
  subtitle: string;
  statusBadge: string;
  beforeImg: string;
  afterImg: string;
  description: string;
  supportAmount: number;
}

export interface CampaignAllocationRow {
  amount: string;
  purpose: string;
}

export interface CampaignContent {
  hero_title?: string;
  hero_subtitle?: string;
  contribution_heading?: string;
  contribution_subtitle?: string;
  contribution_cards?: CampaignContributionCard[];
  impact_eyebrow?: string;
  impact_title?: string;
  impact_description?: string;
  progress_percent?: number;
  impact_goal_label?: string;
  impact_raised_label?: string;
  impact_donors_label?: string;
  about_eyebrow?: string;
  about_title?: string;
  about_banner_title?: string;
  about_banner_description?: string;
  seva_sankalp_text?: string;
  about_cards?: CampaignAboutCard[];
  about_closing_text?: string;
  recovery_eyebrow?: string;
  recovery_title?: string;
  recovery_description?: string;
  recovery_stories?: CampaignRecoveryStory[];
  allocation_eyebrow?: string;
  allocation_title?: string;
  allocation_rows?: CampaignAllocationRow[];
  donor_wall_title?: string;
  donor_wall_description?: string;
  donor_wall_badge?: string;
  faq_title?: string;
  faq_quote_title?: string;
  faq_quote_description?: string;
  section_visibility?: Partial<Record<
    'contribution' | 'impact' | 'about' | 'recovery' | 'allocation' | 'donor_wall' | 'faq',
    boolean
  >>;
}

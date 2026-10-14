import { canonicalCampaignId } from '../utils/campaignRoutes';

export interface ContributionTier {
  amount: string;
  purpose: string;
}

const AMOUNTS = ['₹200', '₹501', '₹1,001', '₹2,501', '₹5,001', 'Custom Amount'] as const;
type Purposes = readonly [string, string, string, string, string, string];

const ANIMAL_PURPOSES: Purposes = [
  'Animal Food & Care',
  'Fodder & Daily Nutrition',
  'Medicines & Treatment',
  'Special Care & Feeding',
  'Larger Seva Contribution',
  'Seva as per your श्रद्धा',
];

const BIRTHDAY_PURPOSES: Purposes = [
  'Birthday Meal Support',
  'Cake & Celebration Support',
  'Meals & Birthday Treats',
  'Children’s Birthday Celebration Care',
  'Larger Birthday Celebration Contribution',
  'Birthday Support as per your श्रद्धा',
];

const EMERGENCY_PURPOSES: Purposes = [
  'Emergency Essentials',
  'Food & Relief Supplies',
  'Rescue & Medical Support',
  'Recovery & Rehabilitation Support',
  'Larger Emergency Relief Contribution',
  'Relief Support as per your श्रद्धा',
];

const GENERIC_PURPOSES: Purposes = [
  'Essential Care Support',
  'Daily Needs & Supplies',
  'Care & Wellbeing Support',
  'Continued Support & Assistance',
  'Larger Campaign Contribution',
  'Support as per your श्रद्धा',
];

const CATEGORY_PURPOSES: Record<string, Purposes> = {
  animals: ANIMAL_PURPOSES,
  children: [
    'Children’s Essential Care',
    'Meals & Daily Nutrition',
    'Learning & Wellbeing Support',
    'Continued Child Care Support',
    'Larger Child Welfare Contribution',
    'Child Care as per your श्रद्धा',
  ],
  elderly: [
    'Elderly Essential Care',
    'Meals & Daily Comfort',
    'Medicines & Health Support',
    'Continued Elder Care Assistance',
    'Larger Elder Welfare Contribution',
    'Elder Care as per your श्रद्धा',
  ],
  education: [
    'Learning Essentials',
    'Books & Study Materials',
    'Classroom Learning Support',
    'Continued Education Assistance',
    'Larger Education Contribution',
    'Education Support as per your श्रद्धा',
  ],
  faith: [
    'Community Seva Essentials',
    'Food & Prasad Support',
    'Devotional Service Support',
    'Continued Community Seva',
    'Larger Faith & Seva Contribution',
    'Seva as per your श्रद्धा',
  ],
  women: [
    'Women’s Essential Care',
    'Nutrition & Hygiene Support',
    'Health & Wellbeing Assistance',
    'Skills & Livelihood Support',
    'Larger Women’s Welfare Contribution',
    'Women’s Support as per your श्रद्धा',
  ],
  'disaster relief': EMERGENCY_PURPOSES,
  'specially abled': [
    'Essential Care & Comfort',
    'Daily Living Support',
    'Therapy & Health Assistance',
    'Accessibility & Mobility Support',
    'Larger Inclusive Care Contribution',
    'Inclusive Care as per your श्रद्धा',
  ],
};

/** Suggested allocation labels only; these do not set donation limits or impact guarantees. */
export function getContributionTiers(campaignId?: string, category?: string): ContributionTier[] {
  // Preserve the original animal table only when no campaign context is supplied.
  const id = campaignId === undefined && category === undefined
    ? 'c2'
    : campaignId ? canonicalCampaignId(campaignId) : undefined;
  let purposes: Purposes;

  if (id && ['c2', 'c3', 'c4', 'c5', 'c7'].includes(id)) {
    purposes = ANIMAL_PURPOSES;
  } else if (id === 'c6') {
    purposes = BIRTHDAY_PURPOSES;
  } else if (id === 'c1') {
    purposes = EMERGENCY_PURPOSES;
  } else {
    const categoryKey = category?.trim().toLowerCase() ?? '';
    purposes = Object.prototype.hasOwnProperty.call(CATEGORY_PURPOSES, categoryKey)
      ? CATEGORY_PURPOSES[categoryKey]
      : GENERIC_PURPOSES;
  }

  return AMOUNTS.map((amount, index) => ({ amount, purpose: purposes[index] }));
}

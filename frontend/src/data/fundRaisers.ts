/** Chennai Airport / landing-page fund raisers (dropdown). */
export const LANDING_FUND_RAISERS = [
  'Divya Sri',
  'Reetika Hajong',
  'Gagan Kumar',
  'Rakhi Malakar',
  'Praveen',
  'Basona Singha',
  'Harikrishnan K',
  'Mukesh B',
  'Niharika Debnath',
  'Vishal M',
  'Mominul Hussain',
  'Ashish Bhargava',
] as const;

export type LandingFundRaiser = (typeof LANDING_FUND_RAISERS)[number];

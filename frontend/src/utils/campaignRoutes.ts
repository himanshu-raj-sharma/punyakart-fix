export interface CampaignRoute {
  id: string;
  slug: string;
  aliases: readonly string[];
}

/** Stable public slugs. Campaign IDs remain the immutable database keys. */
export const CAMPAIGN_ROUTES: readonly CampaignRoute[] = [
  { id: 'c1', slug: 'rescue-relief', aliases: ['c1', 'detail'] },
  { id: 'c2', slug: 'pitru-paksha-seva', aliases: ['c2', 'second', 'education'] },
  { id: 'c3', slug: 'tuesday-seva', aliases: ['c3', 'tuesday'] },
  { id: 'c4', slug: 'gau-seva', aliases: ['c4'] },
  { id: 'c5', slug: 'thursday-gau-seva', aliases: ['c5'] },
  { id: 'c6', slug: 'birthday-seva', aliases: ['c6', 'birthday'] },
  { id: 'c7', slug: 'navratri', aliases: ['c7', 'navratri'] },
];

const byId = new Map(CAMPAIGN_ROUTES.map((route) => [route.id, route]));
const bySegment = new Map(
  CAMPAIGN_ROUTES.flatMap((route) => [
    [route.slug, route.id],
    ...route.aliases.map((alias) => [alias, route.id] as const),
  ]),
);

export function resolveCampaignRouteSegment(segment: string): string {
  let decoded: string;
  try {
    decoded = decodeURIComponent(segment).trim();
  } catch {
    return segment.trim();
  }
  return bySegment.get(decoded.toLowerCase()) || decoded;
}

/** Normalize route, API, and historical attribution aliases to immutable IDs. */
export function canonicalCampaignId(campaignId: string): string {
  const value = campaignId.trim();
  if (!value) return value;
  const resolved = resolveCampaignRouteSegment(value);
  return byId.has(resolved) ? resolved : value;
}

export function campaignPathForId(campaignId: string): string {
  const canonicalId = canonicalCampaignId(campaignId);
  const route = byId.get(canonicalId);
  return `/campaigns/${encodeURIComponent(route?.slug || canonicalId)}`;
}

export function campaignIdForSlug(slug: string): string | undefined {
  const value = resolveCampaignRouteSegment(slug);
  return byId.has(value) ? value : undefined;
}

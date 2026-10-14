import type { AdminTab } from '../admin/adminTypes';
import { campaignIdForSlug, campaignPathForId, resolveCampaignRouteSegment } from './campaignRoutes';

export type ActivePage = 'landing' | 'crowd' | 'campaign-detail' | 'second-campaign' | 'tuesday-campaign' | 'fourth-campaign' | 'fifth-campaign' | 'birthday-campaign' | 'navratri-campaign' | 'admin' | 'privacy' | 'terms' | 'refund' | 'my-donations' | 'blogs' | 'thank-you';

export function normalizePathname(pathname: string): string {
  let path = pathname.replace(/\/+$/, '') || '/';
  if (path === '/crowd-funding' || path.startsWith('/crowd-funding/')) {
    path = `/campaigns${path.slice('/crowd-funding'.length)}`;
  }
  const segment = path.match(/^\/campaigns\/([^/]+)$/)?.[1];
  const id = segment ? campaignIdForSlug(segment) : undefined;
  return id ? campaignPathForId(id) : path;
}

export function parseAppRoute(pathname: string): { activePage: ActivePage; campaignId: string; adminTab: AdminTab } {
  const path = normalizePathname(pathname);
  const within = (base: string) => path === base || path.startsWith(`${base}/`);
  let adminTab: AdminTab = 'statistics';
  for (const tab of ['blogs', 'campaigns', 'donors', 'certificates', 'receipt', 'manual', 'staff', 'autopay'] as const) {
    if (within(`/admin/${tab}`)) adminTab = tab;
  }
  if (within('/admin/subscriptions')) adminTab = 'autopay';

  const segment = path.match(/^\/campaigns\/([^/]+)$/)?.[1];
  const campaignSegment = path.startsWith('/campaigns/') ? path.slice('/campaigns/'.length) : '';
  const campaignId = campaignSegment ? resolveCampaignRouteSegment(campaignSegment) : '';
  const campaignPages: Record<string, ActivePage> = {
    c2: 'second-campaign', c3: 'tuesday-campaign', c4: 'fourth-campaign',
    c5: 'fifth-campaign', c6: 'birthday-campaign', c7: 'navratri-campaign',
  };
  let activePage: ActivePage = 'landing';
  if (within('/admin')) activePage = 'admin';
  else if (campaignSegment) activePage = segment && Object.prototype.hasOwnProperty.call(campaignPages, campaignId) ? campaignPages[campaignId] : 'campaign-detail';
  else if (path === '/campaigns') activePage = 'crowd';
  else if (path === '/blogs' || /^\/blogs\/[^/]+$/.test(path)) activePage = 'blogs';
  else {
    for (const page of ['thank-you', 'my-donations', 'privacy', 'terms', 'refund'] as const) {
      if (within(`/${page}`)) activePage = page;
    }
  }
  return { activePage, campaignId, adminTab };
}

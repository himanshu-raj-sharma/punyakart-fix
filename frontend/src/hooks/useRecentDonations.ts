import { useEffect, useState } from 'react';
import { publicFeedForSource, startPublicDonationPolling, type PublicDonationFeed } from '../utils/publicDonations';

export function useRecentDonations(source: string, limit = 10): PublicDonationFeed {
  const [feed, setFeed] = useState<PublicDonationFeed>({ source, donations: [], status: 'loading' });
  useEffect(() => startPublicDonationPolling(source, limit, setFeed), [source, limit]);
  // Effects run after render. Never let even that first render show the previous route's donors.
  return publicFeedForSource(feed, source);
}

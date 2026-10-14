import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizePathname, parseAppRoute } from '../frontend/src/utils/appRoutes';
import { blogSlugForPathname } from '../frontend/src/pages/BlogPage';
import { canonicalTarget } from '../frontend/src/navigation';

test('frontend route parsing normalizes legacy aliases and trailing slashes without prefix collisions', () => {
  assert.equal(normalizePathname('/campaigns/c2/'), '/campaigns/pitru-paksha-seva');
  assert.equal(normalizePathname('/campaigns/tuesday/'), '/campaigns/tuesday-seva');
  assert.equal(normalizePathname('/crowd-funding/c3'), '/campaigns/tuesday-seva');
  assert.equal(parseAppRoute('/campaigns/c3/').activePage, 'tuesday-campaign');
  assert.equal(parseAppRoute('/campaigns/c3foo').activePage, 'campaign-detail');
  assert.equal(parseAppRoute('/campaigns/tuesdayly').activePage, 'campaign-detail');
  assert.equal(parseAppRoute('/campaigns/c3/extra').activePage, 'campaign-detail');
  assert.equal(parseAppRoute('/campaigns/c3/extra').campaignId, 'c3/extra');
  assert.equal(parseAppRoute('/blogs').activePage, 'blogs');
  assert.equal(parseAppRoute('/blogs/archive').activePage, 'blogs');
  assert.equal(parseAppRoute('/blogspot').activePage, 'landing');
  assert.equal(canonicalTarget(new URL('https://punyakart.example/campaigns/c2/?utm_source=share#details')), '/campaigns/pitru-paksha-seva?utm_source=share#details');
  assert.equal(canonicalTarget(new URL('https://punyakart.example/crowd-funding/c2/?utm_source=share#details')), '/campaigns/pitru-paksha-seva?utm_source=share#details');
});

test('blog route matching distinguishes the list from one exact article path', () => {
  assert.equal(blogSlugForPathname('/blogs'), undefined);
  assert.equal(blogSlugForPathname('/blogs/seva-story'), 'seva-story');
  assert.equal(blogSlugForPathname('/blogs/seva-story/'), 'seva-story');
  assert.equal(blogSlugForPathname('/blogs/seva-story/other'), undefined);
});

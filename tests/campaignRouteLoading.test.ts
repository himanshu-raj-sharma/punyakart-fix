import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

test('campaign pages are eager-loaded so a missing lazy route chunk cannot blank them', async () => {
  const app = await readFile(new URL('../frontend/src/App.tsx', import.meta.url), 'utf8');
  for (const page of ['CrowdFundingPage', 'LegacyCrowdFundingPage', 'SecondCampaignPage', 'TuesdayCampaignPage', 'CampaignDetailPage']) {
    assert.match(app, new RegExp(`import \\{ ${page} \\} from ['"]\\.\\/pages\\/${page}['"]`));
    assert.doesNotMatch(app, new RegExp(`lazy\\(\\(\\) => import\\(['"]\\.\\/pages\\/${page}`));
  }
  const boundary = await readFile(new URL('../frontend/src/components/RouteErrorBoundary.tsx', import.meta.url), 'utf8');
  assert.match(boundary, /This campaign page could not load/);
});

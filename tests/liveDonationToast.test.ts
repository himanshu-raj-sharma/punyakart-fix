import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import ts from 'typescript';

const source = (path: string) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('live donation popup uses only real campaign donations and polls the campaign feed', async () => {
  const component = await source('frontend/src/components/campaign/LiveDonationToast.tsx');
  // Detailed parsing, serial polling, cleanup, source-switch and rotation behavior
  // is exercised with fake transport/timers in publicDonations.test.ts.
  assert.match(component, /useRecentDonations\(source, 12\)/);
  assert.match(component, /startDonationRotation\(donations.length/);
  assert.doesNotMatch(component, /LIVE_DONATIONS|Rameshwar Sharma|Pooja Agarwal|Dr\. Arvind Patel/);
  assert.doesNotMatch(component, /recentDonorsSample/);
});

test('compact campaign notification stays in shared sticky chrome while floating styling remains available', async () => {
  const [component, chrome, app] = await Promise.all([
    source('frontend/src/components/campaign/LiveDonationToast.tsx'),
    source('frontend/src/components/campaign/CampaignPageChrome.tsx'),
    source('frontend/src/App.tsx'),
  ]);

  assert.match(component, /data-presentation=\{isCompact \? 'compact' : 'floating'\}/);
  assert.match(component, /compact\?: boolean/);
  assert.match(component, /key=\{isCompact \? 'compact' : current\.id\}/);
  assert.match(component, /\(isCompact \|\| isVisible\)/);
  assert.match(component, /inert=\{isCompact && !isVisible\}/);
  assert.match(component, /startDonationRotation\(donations\.length/);
  assert.match(component, /max-w-\[34rem\]/);
  assert.doesNotMatch(component, /w-full max-w-4xl/);
  assert.match(chrome, /sticky top-\[var\(--site-header-height\)\] z-40/);
  assert.match(chrome, /max-w-\[1200px\]/);
  assert.doesNotMatch(chrome, /fixed/);
  assert.match(chrome, /compact/);
  assert.match(chrome, /Share2/);
  assert.match(chrome, /navigate\('\/campaigns'\)/);

  const mainStart = app.indexOf('<main ');
  const chromeStart = app.indexOf('<CampaignPageChrome');
  const routeBoundaryStart = app.indexOf('<RouteErrorBoundary', mainStart);
  assert.ok(mainStart >= 0 && chromeStart > mainStart && routeBoundaryStart > chromeStart,
    'shared campaign chrome must be inside the header-padded main and before route content');
});

test('the shared chrome is mounted once for every public campaign route configuration', async () => {
  const [app, chrome, tuesday] = await Promise.all([
    source('frontend/src/App.tsx'),
    source('frontend/src/components/campaign/CampaignPageChrome.tsx'),
    source('frontend/src/pages/TuesdayCampaignPage.tsx'),
  ]);
  assert.match(app, /import \{ CampaignPageChrome \}/);
  assert.match(app, /<CampaignPageChrome/);
  assert.equal((app.match(/<CampaignPageChrome\b/g) || []).length, 1);
  for (const page of ['second-campaign', 'tuesday-campaign', 'fourth-campaign', 'fifth-campaign', 'birthday-campaign', 'navratri-campaign', 'campaign-detail']) {
    assert.match(app, new RegExp(`['"]${page}['"]`));
  }
  assert.match(chrome, /source=\{source\}/);
  assert.match(chrome, /onDonateClick=\{onDonateClick\}/);
  assert.match(app, /onDonateClick=\{handleQuickDonate\}/);

  assert.doesNotMatch(tuesday, /Top Breadcrumb & Share Navigation Bar/);
  assert.doesNotMatch(tuesday, /sticky top-\[var\(--site-header-height\)\]/);
  assert.doesNotMatch(tuesday, /Share2|copiedLink|handleShare/);

  const parsed = ts.createSourceFile('App.tsx', app, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let chromeCount = 0;
  const visit = (node: ts.Node) => {
    if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(parsed) === 'CampaignPageChrome') {
      chromeCount += 1;
      let ancestor: ts.Node | undefined = node.parent;
      let insideMain = false;
      while (ancestor) {
        if (ts.isJsxElement(ancestor) && ancestor.openingElement.tagName.getText(parsed) === 'main') insideMain = true;
        ancestor = ancestor.parent;
      }
      assert.equal(insideMain, true);
    }
    ts.forEachChild(node, visit);
  };
  visit(parsed);
  assert.equal(chromeCount, 1);
});

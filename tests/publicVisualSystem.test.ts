import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';

const pageNames = [
  'CrowdFundingPage.tsx',
  'CampaignDetailPage.tsx',
  'SecondCampaignPage.tsx',
  'LegacyCrowdFundingPage.tsx',
  'BlogPage.tsx',
  'LegalPage.tsx',
  'ThankYouPage.tsx',
  'MyDonationsPage.tsx',
] as const;

async function readPage(name: (typeof pageNames)[number]): Promise<string> {
  return readFile(new URL(`../frontend/src/pages/${name}`, import.meta.url), 'utf8');
}

test('public visual tokens define one warm light surface and mobile-safe page boundaries', async () => {
  const css = await readFile(new URL('../frontend/src/index.css', import.meta.url), 'utf8');

  for (const token of [
    '--public-surface: #FFF8F1',
    '--public-card: #FFFFFF',
    '--public-border: #F3DED0',
    '--public-muted-surface: #FFF1E6',
  ]) assert.match(css, new RegExp(token.replace(/[#:]/g, '\\$&')));
  assert.match(css, /\.public-page\s*\{[\s\S]*overflow-x:\s*clip/);
  assert.match(css, /\.public-page button,[\s\S]*\.public-page a\s*\{[\s\S]*max-width:\s*100%/);
  assert.match(css, /\.public-page \.grid\s*\{[\s\S]*min-width:\s*0/);
});

test('all scoped public pages opt into the shared root surface', async () => {
  for (const name of pageNames) {
    const source = await readPage(name);
    assert.match(source, /className="[^"]*public-page/, name);
  }
  const app = await readFile(new URL('../frontend/src/App.tsx', import.meta.url), 'utf8');
  assert.match(app, /bg-\[var\(--public-surface\)\]/);
});

test('public pages remove mixed neutral roots and preserve narrow-phone grid safeguards', async () => {
  for (const name of pageNames) {
    const source = await readPage(name);
    assert.doesNotMatch(source, /(?:bg-slate-50|bg-slate-100|#F4F7FA|#FAF7F2)/, name);
  }

  const second = await readPage('SecondCampaignPage.tsx');
  const legacy = await readPage('LegacyCrowdFundingPage.tsx');
  assert.match(second, /grid-cols-2 min-\[360px\]:grid-cols-4/);
  assert.match(legacy, /grid-cols-2 min-\[360px\]:grid-cols-4/);
  assert.match(legacy, /overflow-x-auto[^\n]*snap-x/);
  assert.match(legacy, /min-w-0/);
});

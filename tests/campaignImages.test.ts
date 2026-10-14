import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';
import { build } from 'esbuild';

// Exercise the real resolver and bundled image bytes without starting a server.
const bundle = await build({
  entryPoints: [fileURLToPath(new URL('../frontend/src/components/campaign/campaignImages.ts', import.meta.url))],
  bundle: true, write: false, platform: 'node', format: 'cjs',
  loader: { '.jpg': 'dataurl', '.png': 'dataurl' },
});
const compiled = { exports: {} as { resolveCampaignImage: (id: string, image?: string) => string } };
runInNewContext(bundle.outputFiles[0].text, { module: compiled, exports: compiled.exports });
const { resolveCampaignImage } = compiled.exports;

test('API birthday record with an empty image resolves to the existing birthday banner', async () => {
  const expected = await readFile(new URL('../frontend/src/assets/campaigns/c6-hero.jpg', import.meta.url));
  for (const image of [undefined, '', '   ', '/campaign-images/c6-hero.jpg']) {
    const resolved = resolveCampaignImage('c6', image);
    assert.match(resolved, /^data:image\/jpeg;base64,/);
    assert.deepEqual(Buffer.from(resolved.split(',')[1], 'base64'), expected);
  }
});

test('birthday custom CMS image and neighboring campaign fallbacks are preserved', () => {
  assert.equal(resolveCampaignImage('c6', '/media/custom-birthday.jpg'), '/media/custom-birthday.jpg');
  assert.equal(resolveCampaignImage('c6', 'https://example.com/birthday.jpg'), 'https://example.com/birthday.jpg');
  for (const id of ['c1', 'c2', 'c3', 'c4', 'c5']) assert.match(resolveCampaignImage(id, ''), /^data:image\//);
  assert.equal(resolveCampaignImage('c7', ''), '/navratri-hero.jpg');
  assert.equal(resolveCampaignImage('navratri', ''), '/navratri-hero.jpg');
});

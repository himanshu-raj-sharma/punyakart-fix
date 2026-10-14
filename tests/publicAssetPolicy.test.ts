import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { isPrivateBuildPath, PUBLIC_POLL_LIMITS } from '../backend/publicAssetPolicy';

test('server bundles and maps cannot be served as public assets, including encoded paths', () => {
  for (const path of ['/server.cjs', '/migrate.cjs', '/server.cjs.map', '/assets/index.js.map',
    '/SERVER.CJS', '/server%2ecjs', '/%2eenv', '/media/private.key', '/package.json', '/bad%']) {
    assert.equal(isPrivateBuildPath(path), true, path);
  }
  for (const path of ['/assets/index-123.js', '/assets/index.css', '/navratri-hero.jpg',
    '/media/banner.png', '/campaigns/navratri', '/api/donations/initiate', '/robots.txt']) {
    assert.equal(isPrivateBuildPath(path), false, path);
  }
});

test('normal wall/popup and checkout polling fit each rate window without a five-minute lockout', () => {
  const recent = PUBLIC_POLL_LIMITS.recent;
  const status = PUBLIC_POLL_LIMITS.status;
  assert.ok(Math.ceil(recent.windowMs / 15000) * 2 + 2 < recent.max);
  assert.ok(Math.ceil(status.windowMs / 2500) + 1 < status.max);
});

test('private-asset guard precedes static serving and only authenticated polls reconcile payments', async () => {
  const server = await readFile(new URL('../server.ts', import.meta.url), 'utf8');
  assert.ok(server.indexOf('if (isPrivateBuildPath(req.path))') < server.indexOf('app.use(express.static(distPath))'));
  assert.match(server, /if \(authed\) \{\s*await syncPendingPaymentForDonation/);
  assert.match(server, /\.\.\.PUBLIC_POLL_LIMITS.recent/);
  assert.match(server, /\.\.\.PUBLIC_POLL_LIMITS.status/);
});

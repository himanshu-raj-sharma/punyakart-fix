import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { validateDonationPayload } from '../backend/validation/donationSchema.js';

const server = () => readFile(new URL('../server.ts', import.meta.url), 'utf8');

test('admin rate limiting is mounted before admin routes and not duplicated late', async () => {
  const source = await server();
  const mount = source.indexOf("app.use('/api/admin', adminLimiter)");
  const firstAdminRoute = source.indexOf("app.get('/api/admin/meta-capi/status'");
  assert.ok(mount >= 0 && mount < firstAdminRoute);
  assert.equal((source.match(/app\.use\('\/api\/admin', adminLimiter\)/g) || []).length, 1);
});

test('large JSON parsing is restricted to media uploads', async () => {
  const source = await server();
  const media = source.indexOf("app.use('/api/admin/media', express.json({ limit: '70mb' }))");
  const ordinary = source.indexOf("app.use(express.json({ limit: '2mb' }))");
  assert.ok(media >= 0 && ordinary > media);
});

test('browser Razorpay verification requires the initiating checkout token', async () => {
  const source = await server();
  const start = source.indexOf("app.post('/api/donations/verify-razorpay'");
  const end = source.indexOf("app.post('/api/donations/:id/fail'", start);
  const route = source.slice(start, end);
  assert.match(route, /assertClientToken\(donation, String\(req\.body\?\.clientToken/);
  assert.match(route, /payments\.fetch\(razorpay_payment_id\)/);
});

test('sitemap lists canonical campaign URLs', async () => {
  const source = await server();
  assert.match(source, /\/campaigns\/rescue-relief/);
  assert.match(source, /\/campaigns\/pitru-paksha-seva/);
  assert.match(source, /\/campaigns\/tuesday-seva/);
  assert.match(source, /\/campaigns\/birthday-seva/);
  assert.doesNotMatch(source, /'\/campaigns\/second'/);
  assert.doesNotMatch(source, /'\/campaigns\/tuesday'/);
});

test('public donation validation bounds free-text fields before persistence', () => {
  const base = {
    amount: 200, type: 'one-time', causeTitle: 'Cause', fullName: 'Valid Donor',
    email: 'donor@example.invalid', phone: '9876543210', address: 'Valid address',
    panNumber: '', want80G: true, paymentMethod: 'razorpay', source: 'campaign_c2',
  } as const;
  assert.throws(() => validateDonationPayload({ ...base, causeTitle: 'x'.repeat(241) }));
  assert.throws(() => validateDonationPayload({ ...base, address: 'x'.repeat(301) }));
  assert.throws(() => validateDonationPayload({ ...base, dedication: { prayerMessage: 'x'.repeat(1_001) } }));
});

test('admin manual verification cannot promote an unverified Razorpay attempt', async () => {
  const source = await server();
  const start = source.indexOf("app.post('/api/admin/donations/:id/verify'");
  const end = source.indexOf("app.get('/api/admin/fundraisers'", start);
  const route = source.slice(start, end);
  assert.ok(start >= 0 && end > start);
  assert.match(route, /current\.paymentMethod === 'razorpay'/);
  assert.match(route, /!\['verified', 'completed'\]\.includes\(current\.status\)/);
  assert.match(route, /captured INR payment/);
});

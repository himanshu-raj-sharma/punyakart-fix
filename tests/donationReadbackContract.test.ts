import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DonationService } from '../backend/donationService';
import type { DonationRepository } from '../backend/db/DonationRepository';
import type { SubscriptionService } from '../backend/subscriptionService';
import type { StoredDonation } from '../backend/types';
import { toPublicRecentDonation } from '../backend/publicRecentDonation';
import { parsePublicDonations } from '../frontend/src/utils/publicDonations';
import { toAdminDonation } from '../backend/adminDonation';
import { validateDonationPayload } from '../backend/validation/donationSchema';

const input = { amount: 501, type: 'one-time', causeTitle: 'Tuesday Seva', campaignId: 'c3',
  source: 'campaign_c3', fullName: 'Example Donor', email: 'fixture@example.com', phone: '9876543210',
  address: 'Synthetic test address', paymentMethod: 'razorpay' };

test('saved verified donation produces the same public name and amount for walls/popup and correct admin identity', async () => {
  const rows = new Map<string, StoredDonation>();
  const repository = {
    async initiate(row: Omit<StoredDonation, 'status'>) {
      const saved = { ...row, status: 'initiated' as const }; rows.set(row.id, saved); return saved;
    },
    async findById(id: string) { return rows.get(id) || null; },
    async allocateReceiptNumber() { return 'PKF-2026-27-000001'; },
    async updateStatus(id: string, status: StoredDonation['status'], patch: Partial<StoredDonation>) {
      const saved = { ...rows.get(id)!, ...patch, status }; rows.set(id, saved); return saved;
    },
    async listRecent(limit: number, source: string) {
      return [...rows.values()].filter((row) => row.status === 'verified' && row.source === source).slice(0, limit);
    },
  } as unknown as DonationRepository;
  const service = new DonationService(repository, {} as SubscriptionService, undefined, async () => {});
  for (const isAnonymous of [false, true]) {
    const created = await service.initiate({ ...input, dedication: { isAnonymous } });
    await service.verify(created.id, `pay_Test${isAnonymous ? 'Anon' : 'Named'}`);
    const saved = (await service.findById(created.id))!;
    const publicRows = (await service.listRecent(12, 'campaign_c3')).map(toPublicRecentDonation);
    const visible = parsePublicDonations({ success: true, donations: publicRows }).find((row) => row.id === saved.id)!;
    assert.equal(visible.name, isAnonymous ? 'Anonymous Donor' : 'Example D.');
    assert.equal(visible.amount, 501);
    assert.equal(visible.date, saved.verifiedAt);
    assert.equal('fullName' in visible, false);
    assert.equal('phone' in visible, false);
    const admin = toAdminDonation(saved);
    assert.equal(admin.source, 'campaign_c3');
    assert.equal(admin.fullName, input.fullName);
    assert.equal(admin.amount, visible.amount);
  }
});

test('whitespace cannot satisfy donor identity/address validation and padded valid input normalizes', () => {
  for (const field of ['fullName', 'address', 'causeTitle']) {
    assert.throws(() => validateDonationPayload({ ...input, [field]: '     ' }));
  }
  const saved = validateDonationPayload({ ...input, fullName: ' Example Donor ', email: ' fixture@example.com ' });
  assert.equal(saved.fullName, 'Example Donor');
  assert.equal(saved.email, 'fixture@example.com');
});

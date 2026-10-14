import 'dotenv/config';

import assert from 'node:assert/strict';
import { getMongoDb, closeMongo } from '../backend/db/mongo';
import { BusinessError } from '../backend/errors';
import { createBackendServices } from '../backend';

const TEST_DATABASE_NAME = 'punyakart_test';

async function resetTestDatabase(): Promise<void> {
  const db = await getMongoDb();

  const collections = [
    'donations',
    'subscriptions',
    'certificate_downloads',
    'receipt_downloads',
    'audit_logs',
    'campaigns',
    'counters',
  ];

  for (const collectionName of collections) {
    await db.collection(collectionName).deleteMany({});
  }
}

async function runTests() {
  const originalDatabaseName = process.env.PUNYAKART_DB_NAME;

  if (!process.env.DATABASE_URL) {
    throw new Error(
      'DATABASE_URL must be configured before running backend tests.',
    );
  }

  process.env.PUNYAKART_DB_NAME = TEST_DATABASE_NAME;

  try {
    await resetTestDatabase();

    const {
      donations,
      subscriptions,
      certificateDownloads,
    } = await createBackendServices();

    const list = await donations.listRecent();
    assert.equal(list.length, 0);

    const oneTime = await donations.initiate({
      amount: 500,
      type: 'one-time',
      causeTitle: 'Emergency Rescue Kits',
      fullName: 'Test Donor',
      email: 'test@example.com',
      phone: '9876543210',
      address: 'Dehradun',
      want80G: true,
      panNumber: 'ABCDE1234F',
      paymentMethod: 'razorpay',
    });

    const status = await donations.getStatus(oneTime.id);
    assert.equal(status.status, 'initiated');
    assert.equal(oneTime.source, 'chennai_airport');

    await donations.attachRazorpayOrder(oneTime.id, 'order_test_123');

    const verifiedOneTime = await donations.verify(
      oneTime.id,
      'pay_test_123',
    );

    assert.equal(verifiedOneTime.status, 'verified');
    assert.ok(verifiedOneTime.receiptNumber);
    assert.match(
      verifiedOneTime.receiptNumber,
      /^PKF-\d{4}-\d{2}-\d{6}$/,
    );

    const second = await donations.initiate({
      amount: 750,
      type: 'one-time',
      causeTitle: 'Medical Aid',
      fullName: 'Second Donor',
      email: 'second@example.com',
      phone: '9876543211',
      address: 'Dehradun',
      want80G: true,
      panNumber: 'ABCDE1234G',
      paymentMethod: 'razorpay',
    });

    const verifiedSecond = await donations.verify(
      second.id,
      'pay_test_second',
    );

    assert.notEqual(
      verifiedSecond.receiptNumber,
      verifiedOneTime.receiptNumber,
    );

    const firstSeq = Number(
      verifiedOneTime.receiptNumber!.slice(-6),
    );

    const secondSeq = Number(
      verifiedSecond.receiptNumber!.slice(-6),
    );

    assert.equal(secondSeq, firstSeq + 1);

    const crowd = await donations.initiate({
      amount: 1000,
      type: 'one-time',
      causeTitle: 'Crowd Flood Relief',
      fullName: 'Crowd Donor',
      email: 'crowd@example.com',
      phone: '9876543212',
      address: 'Chennai',
      want80G: true,
      panNumber: 'ABCDE1234F',
      paymentMethod: 'razorpay',
      source: 'campaign',
    });

    assert.equal(crowd.source, 'campaign');

    await donations.verify(crowd.id, 'pay_crowd_1');

    const airportRecent = await donations.listRecent(
      10,
      'chennai_airport',
    );

    const crowdRecent = await donations.listRecent(
      10,
      'campaign',
    );

    assert.ok(
      airportRecent.some((d) => d.id === verifiedOneTime.id),
    );

    assert.ok(
      crowdRecent.some((d) => d.id === crowd.id),
    );

    assert.ok(
      !airportRecent.some((d) => d.id === crowd.id),
    );

    assert.ok(
      !crowdRecent.some((d) => d.id === verifiedOneTime.id),
    );

    const certByPayRef = await donations.findForCertificate(
      'pay_test_123',
    );

    assert.equal(certByPayRef.donation.id, oneTime.id);

    const subscriptionCountBeforeMonthly =
      (await subscriptions.list()).length;

    await assert.rejects(
      async () =>
        await donations.findForCertificate('missing-record'),
      (error: unknown) =>
        error instanceof BusinessError &&
        error.code === 'VALIDATION_ERROR',
    );

    await assert.rejects(
      async () =>
        await donations.findForCertificate('+91 98765 43210'),
      (error: unknown) =>
        error instanceof BusinessError &&
        error.code === 'VALIDATION_ERROR',
    );

    const cert = await donations.findForCertificate(
      verifiedOneTime.receiptNumber!,
    );

    assert.equal(cert.donation.fullName, 'Test Donor');

    const monthly = await donations.initiate({
      amount: 2000,
      type: 'monthly',
      causeTitle: 'Monthly Animal Care',
      fullName: 'Monthly Donor',
      email: 'monthly@example.com',
      phone: '9123456789',
      address: 'Dehradun',
      want80G: true,
      panNumber: 'ABCDE1234F',
      paymentMethod: 'razorpay',
    });

    const verifiedMonthly = await donations.verify(
      monthly.id,
      'pay_test_456',
    );

    assert.equal(verifiedMonthly.type, 'monthly');

    assert.equal(
      (await subscriptions.list()).length,
      subscriptionCountBeforeMonthly,
    );

    await assert.rejects(
      async () =>
        await donations.initiate({
          amount: -20,
          type: 'one-time',
          causeTitle: 'Emergency Rescue Kits',
          fullName: 'Test Donor',
          email: 'test@example.com',
          phone: '9876543210',
          address: 'Dehradun',
          want80G: true,
          panNumber: 'ABCDE1234F',
          paymentMethod: 'razorpay',
        }),
      (error: unknown) =>
        error instanceof BusinessError &&
        error.code === 'VALIDATION_ERROR',
    );

    await assert.rejects(
      async () =>
        await donations.initiate({
          amount: 0,
          type: 'one-time',
          causeTitle: 'Animal Rescue',
          fullName: 'Crowd Donor',
          email: 'crowd@example.com',
          phone: '+91 9876543212',
          address: 'Dehradun',
          want80G: true,
          panNumber: 'ABCDE1234F',
          paymentMethod: 'razorpay',
        }),
      (error: unknown) =>
        error instanceof BusinessError &&
        error.code === 'VALIDATION_ERROR',
    );

    const minimumDonationInput = {
      amount: 500,
      type: 'one-time',
      causeTitle: 'Animal Rescue',
      fullName: 'Crowd Donor',
      email: 'crowd@example.com',
      phone: '+91 9876543212',
      address: 'Dehradun',
      want80G: true,
      panNumber: 'ABCDE1234F',
      paymentMethod: 'razorpay',
    };
    const minimumDonation = await donations.initiate(minimumDonationInput);

    assert.equal(minimumDonation.amount, 500);
    assert.equal(minimumDonation.source, 'chennai_airport');
    assert.equal(minimumDonation.phone, '9876543212');

    for (const source of [undefined, '', '   ', 'chennai_airport', ' CHENNAI_AIRPORT ']) {
      await assert.rejects(
        () => donations.initiate({ ...minimumDonationInput, source, amount: 199 }),
        (error: unknown) => error instanceof BusinessError && error.code === 'VALIDATION_ERROR',
      );
    }

    for (const source of ['crowd_funding', 'campaign', 'campaign_AnimalCare', 'manual']) {
      await assert.rejects(
        () => donations.initiate({ ...minimumDonationInput, source, amount: 199 }),
        (error: unknown) => error instanceof BusinessError && error.code === 'VALIDATION_ERROR',
      );
      const campaignMinimum = await donations.initiate({
        ...minimumDonationInput,
        source: ` ${source} `,
        amount: 200,
      });
      assert.equal(campaignMinimum.amount, 200);
      assert.equal(campaignMinimum.source, source);
    }

    const disasterSmall = await donations.initiate({
      amount: 249,
      type: 'one-time',
      causeTitle: 'Disaster Management',
      source: 'crowd_funding',
      fullName: 'Disaster Donor',
      email: 'disaster@example.com',
      phone: '9876543211',
      address: 'Dehradun',
      want80G: true,
      panNumber: 'ABCDE1234F',
      paymentMethod: 'razorpay',
    });

    assert.equal(disasterSmall.amount, 249);
    assert.equal(
      disasterSmall.causeTitle,
      'Disaster Management',
    );

    await assert.rejects(
      async () =>
        await donations.findForCertificate(
          'DON-missing-record',
        ),
      (error: unknown) =>
        error instanceof BusinessError &&
        error.code === 'NOT_FOUND',
    );

    const testDonorByPhone =
      await donations.searchMatches('+91 98765 43210');

    assert.equal(testDonorByPhone[0].id, oneTime.id);

    const withoutPan = await donations.initiate({
      amount: 500,
      type: 'one-time',
      causeTitle: 'Feeding Program',
      fullName: 'No Pan Donor',
      email: 'nopan@example.com',
      phone: '9876501234',
      address: 'Dehradun',
      want80G: true,
      paymentMethod: 'razorpay',
    });

    assert.equal(withoutPan.panNumber, '');

    const failed = await donations.initiate({
      amount: 500,
      type: 'one-time',
      causeTitle: 'Test',
      fullName: 'Fail Donor',
      email: 'fail@example.com',
      phone: '9988776655',
      address: 'Dehradun',
      want80G: true,
      panNumber: 'ABCDE1234F',
      paymentMethod: 'razorpay',
    });

    const marked = await donations.markFailed(
      failed.id,
      'cancelled',
    );

    assert.equal(marked.status, 'failed');

    const raised = await donations.initiate({
      amount: 1200,
      type: 'one-time',
      causeTitle: 'Feeding Program',
      fullName: 'Raised Donor',
      email: 'raised@example.com',
      phone: '9876509999',
      address: 'Dehradun',
      want80G: true,
      paymentMethod: 'razorpay',
      fundRaiser: '  Priya   Sharma  ',
    });

    assert.equal(raised.fundRaiser, 'Priya Sharma');

    const verifiedRaised = await donations.verify(
      raised.id,
      'pay_priya',
    );

    assert.ok(verifiedRaised.receiptNumber);

    const report = await donations.summarizeFundRaisers();

    const priya = report.fundRaisers.find(
      (row) => row.name === 'Priya Sharma',
    );

    assert.ok(priya);
    assert.equal(priya.donationCount, 1);
    assert.equal(priya.totalAmount, 1200);
    assert.ok(report.unassigned.donationCount >= 1);

    const allDonors = await donations.listAll();

    assert.ok(allDonors.length >= 2);

    const searchByName =
      await donations.searchMatches('Raised Donor');

    assert.equal(
      searchByName[0].fullName,
      'Raised Donor',
    );

    const searchByPhone =
      await donations.searchMatches('9876509999');

    assert.equal(searchByPhone[0].id, raised.id);

    const searchByReceipt =
      await donations.searchMatches(
        verifiedRaised.receiptNumber,
      );

    assert.equal(
      searchByReceipt[0]?.id,
      raised.id,
    );

    const searchByReceiptCompact =
      await donations.searchMatches(
        verifiedRaised.receiptNumber!.replace(/-/g, ''),
      );

    assert.equal(
      searchByReceiptCompact[0]?.id,
      raised.id,
    );

    const issued = await donations.issueCertificate(
      raised.id,
    );

    assert.ok(issued.receiptNumber);

    const pending = await donations.initiate({
      amount: 500,
      type: 'one-time',
      causeTitle: 'Feeding Program',
      fullName: 'Pending Cert Donor',
      email: 'pending.cert@example.com',
      phone: '9876501111',
      address: 'Dehradun',
      want80G: true,
      paymentMethod: 'razorpay',
    });

    const issuedPending =
      await donations.issueCertificate(pending.id);

    assert.equal(issuedPending.status, 'verified');
    assert.ok(issuedPending.receiptNumber);

    const manual =
      await donations.createManualVerified({
        amount: 2500,
        fullName: 'Cash Donor',
        email: 'cash@example.com',
        phone: '+91 9123456780',
        address: 'Govind Garh, Dehradun',
        panNumber: 'ABCDE1234F',
        causeTitle: 'Emergency Treatment',
        transactionId: 'TXN-CASH-001',
        paymentMethod: 'cash',
        issuedBy: 'Admin Staff',
        fundRaiser: 'Field Volunteer',
      });

    assert.equal(manual.status, 'verified');
    assert.equal(manual.phone, '9123456780');
    assert.equal(manual.paymentMethod, 'cash');
    assert.equal(manual.issuedBy, 'Admin Staff');
    assert.equal(manual.source, 'manual');
    assert.ok(manual.receiptNumber);

    const download =
      await certificateDownloads.record(
        manual,
        'admin-create',
      );

    assert.equal(download.fullName, 'Cash Donor');

    assert.equal(
      (await certificateDownloads.list()).length,
      1,
    );

    const downloadAgain =
      await certificateDownloads.record(
        manual,
        'admin-download',
      );

    assert.equal(
      (await certificateDownloads.list()).length,
      1,
    );

    assert.equal(downloadAgain.downloadCount, 2);
    assert.equal(
      downloadAgain.source,
      'admin-download',
    );

    const latestDownloads =
      await certificateDownloads.latestByDonationId();

    assert.equal(
      latestDownloads.get(manual.id)?.downloadCount,
      2,
    );

    const razorpayDonations =
      await createBackendServices({
        gatewayLookup: {
          async findCapturedPayment(query: string) {
            if (!query.includes('pay_liveTest99')) {
              return null;
            }

            return {
              id: 'pay_liveTest99',
              order_id: 'order_liveTest99',
              amount: 150000,
              status: 'captured',
              captured: true,
              email: 'live.donor@example.com',
              contact: '9998887776',
              notes: {
                fullName: 'Live Razorpay Donor',
                cause: 'Animal Feed',
              },
              created_at: 1756650000,
              acquirer_data: {
                rrn: '123456789012',
              },
            };
          },
        },
      });

    const imported =
      await razorpayDonations.donations.findForCertificate(
        'pay_liveTest99',
      );

    assert.equal(
      imported.donation.fullName,
      'Live Razorpay Donor',
    );

    assert.equal(
      imported.donation.paymentRef,
      'pay_liveTest99',
    );

    assert.equal(
      imported.donation.status,
      'verified',
    );

    const importedAgain =
      await razorpayDonations.donations.findForCertificate(
        'pay_liveTest99',
      );

    assert.equal(
      importedAgain.donation.id,
      imported.donation.id,
    );

    await assert.rejects(
      async () =>
        await razorpayDonations.donations.findForCertificate(
          'live.donor@example.com',
        ),
      (error: unknown) =>
        error instanceof BusinessError &&
        error.code === 'VALIDATION_ERROR',
    );

    const {
      assertPaymentMatchesDonation,
    } = await import('../backend/paymentVerify');

    const sample = await donations.findById(oneTime.id);

    assert.ok(sample);

    assert.throws(
      () =>
        assertPaymentMatchesDonation(
          sample,
          {
            id: 'pay_other',
            order_id: 'order_other',
            amount: 50000,
            status: 'captured',
          },
          'order_other',
        ),
      (error: unknown) =>
        error instanceof BusinessError &&
        error.code === 'VALIDATION_ERROR',
    );

    assert.throws(
      () =>
        assertPaymentMatchesDonation(
          {
            ...sample,
            razorpayOrderId: 'order_test_123',
          },
          {
            id: 'pay_test_123',
            order_id: 'order_test_123',
            amount: 100,
            status: 'captured',
          },
          'order_test_123',
        ),
      (error: unknown) =>
        error instanceof BusinessError &&
        error.code === 'VALIDATION_ERROR',
    );

    const {
      assertProductionConfig,
    } = await import('../backend/productionConfig');

    assert.doesNotThrow(() =>
      assertProductionConfig({
        NODE_ENV: 'development',
      } as NodeJS.ProcessEnv),
    );

    assert.throws(
      () =>
        assertProductionConfig({
          NODE_ENV: 'production',
          ADMIN_API_KEY:
            'punyakart-admin-change-me-before-prod',
          RAZORPAY_KEY_ID: 'rzp_live_ok',
          RAZORPAY_KEY_SECRET: 'secret',
        } as NodeJS.ProcessEnv),
    );

    assert.doesNotThrow(() =>
      assertProductionConfig({
        NODE_ENV: 'production',
        ADMIN_API_KEY: 'a'.repeat(32),
        DONOR_JWT_SECRET: 'd'.repeat(32),
        RAZORPAY_KEY_ID: 'rzp_live_ok',
        RAZORPAY_KEY_SECRET: 'secret',
      } as NodeJS.ProcessEnv),
    );

    console.log(
      'Backend MongoDB business logic checks passed.',
    );
  } finally {
    await resetTestDatabase();

    if (originalDatabaseName) {
      process.env.PUNYAKART_DB_NAME =
        originalDatabaseName;
    } else {
      delete process.env.PUNYAKART_DB_NAME;
    }

    await closeMongo();
  }
}

runTests().catch(async (err) => {
  console.error(err);
  await closeMongo();
  process.exit(1);
});

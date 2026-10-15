import express from 'express';

import cors from 'cors';

import path from 'node:path';
import fs from 'node:fs/promises';

import { createServer as createViteServer } from 'vite';

import { rateLimit } from 'express-rate-limit';

import { createBackendServices } from './backend/index.js';
import { getMongoDb } from './backend/db/mongo.js';
import { CONTENT_SECURITY_POLICY } from './backend/contentSecurityPolicy.js';
import { isPrivateBuildPath, PUBLIC_POLL_LIMITS } from './backend/publicAssetPolicy.js';

import { BusinessError } from './backend/errors.js';

import type { Request, Response, NextFunction } from 'express';

import logger from './backend/logger.js';

import { randomUUID } from 'node:crypto';

import dotenv from 'dotenv';

import Razorpay from 'razorpay';

import crypto from 'node:crypto';

import { getNotificationReadiness, getCertificateDetails } from './backend/notifications/index.js';


import { signDonorToken, donorAuthMiddleware } from './backend/donorAuth.js';

import type { DonorRequest } from './backend/donorAuth.js';

import { build80GCertificatePdf } from './backend/notifications/certificatePdf.js';

import { buildDonationReceiptPdf } from './backend/notifications/donationReceiptPdf.js';

import { isCertificateEligible } from './backend/db/certificateLookup.js';
import { createDocumentHandlers } from './backend/documentRoutes.js';

import { timingSafeEqualHex, timingSafeEqualText } from './backend/security.js';

import { assertPaymentMatchesDonation, assertSubscriptionPaymentMatchesDonation } from './backend/paymentVerify.js';

import { withoutClientToken } from './backend/donationService.js';
import { validateActiveCampaignDonation } from './backend/campaignDonationGuard.js';
import { canonicalCampaignId } from './backend/campaignAttribution.js';
import { toPublicRecentDonation } from './backend/publicRecentDonation.js';
import { toAdminDonation } from './backend/adminDonation.js';
import { createMetaConversionsService } from './backend/metaConversions.js';
import { captureMetaAttribution, capturedPaymentSnapshot, reportCapturedConversion, verifyCapturedDonation } from './backend/metaPaymentTracking.js';

import { assertProductionConfig, productionWarnings } from './backend/productionConfig.js';

import { getRazorpayMonthlyPlanId } from './backend/razorpayMonthlyPlans.js';

import { MongoCampaignRepository } from './backend/db/MongoCampaignRepository.js';
import { seedDefaultCampaignsIfEmpty } from './backend/campaignSeed.js';

import type { CampaignWithStats } from './backend/db/MongoCampaignRepository.js';
import { createCampaignSchema, updateCampaignSchema } from './backend/validation/campaignSchema.js';
import { MongoBlogRepository } from './backend/db/MongoBlogRepository.js';
import { createBlogSchema, updateBlogSchema } from './backend/validation/blogSchema.js';

dotenv.config({
  override: process.env.NODE_ENV !== 'production',
});




function requireRazorpayCredentials() {

  const keyId = process.env.RAZORPAY_KEY_ID?.trim();

  const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();

  if (

    !keyId ||

    !keySecret ||

    keyId.includes('your_') ||

    keySecret.includes('your_') ||

    keyId.includes('dummy') ||

    keySecret.includes('dummy')

  ) {

    return null;

  }

  return { keyId, keySecret };

}



const razorpayCreds = requireRazorpayCredentials();

const razorpay = razorpayCreds

  ? new Razorpay({ key_id: razorpayCreds.keyId, key_secret: razorpayCreds.keySecret })

  : null;



const metaConversions = createMetaConversionsService();
const app = express();

const PORT = process.env.PORT || 3000;

app.set('trust proxy', 1);



const allowedOrigins = (process.env.CORS_ORIGINS || '')

  .split(',')

  .map((o) => o.trim())

  .filter(Boolean);



if (process.env.NODE_ENV === 'production' && allowedOrigins.length === 0) {

  allowedOrigins.push('https\://punyakart.com', 'https\://www.punyakart.com');

}



app.use(

  cors({

    origin: allowedOrigins.length > 0 ? allowedOrigins : true,

  }),

);



app.use((_req, res, next) => {

  res.setHeader('X-Content-Type-Options', 'nosniff');

  res.setHeader('X-Frame-Options', 'DENY');

  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  if (process.env.NODE_ENV === 'production') {

    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

  }

  res.setHeader('Content-Security-Policy', CONTENT_SECURITY_POLICY);

  next();

});



// Raw body needed for Razorpay webhook signature verification

app.use(

  '/api/webhooks/razorpay',

  express.json({

    verify: (req, _res, buf) => {

      (req as Request & { rawBody?: Buffer }).rawBody = buf;

    },

  }),

);

// Base64 increases binary payloads by roughly one third. This accommodates the
// documented 50 MB video limit without silently rejecting valid uploads.
// Media is sent as base64 and is the only JSON route allowed to accept large bodies.
app.use('/api/admin/media', express.json({ limit: '70mb' }));

// Keep all ordinary API bodies small. This follows the media parser so uploads
// are not rejected by the smaller global parser first.
app.use(express.json({ limit: '2mb' }));



app.use((req, res, next) => {

  req.headers['x-request-id'] = req.headers['x-request-id'] || randomUUID();

  res.setHeader('X-Request-Id', req.headers['x-request-id'] as string);

  next();

});


// ---------------------------------------------------------------------------
// Hostinger startup compatibility
// ---------------------------------------------------------------------------
// Hostinger's Node.js runner expects the process to call listen() within a
// few seconds. Do not wait for MongoDB, index creation, or other backend
// initialization before opening the HTTP port.
const distPath = path.join(process.cwd(), 'dist');
const runningFromBundle = /server\.cjs$/.test(process.argv[1] || '');
const serveBuiltSite = process.env.NODE_ENV === 'production' || runningFromBundle;
let appReady = false;

// Keep the health endpoint available while backend initialization is running.
app.get('/health', (_req, res) => {
  res.status(appReady ? 200 : 503).json({
    status: appReady ? 'ok' : 'starting',
    timestamp: new Date().toISOString(),
    razorpayConfigured: Boolean(razorpay),
    metaCapiConfigured: metaConversions.enabled,
    notifications: getNotificationReadiness(),
  });
});

if (serveBuiltSite) {
  app.use((req, res, next) => {
    if (isPrivateBuildPath(req.path)) {
      res.status(404).end();
      return;
    }
    next();
  });
  app.use(express.static(distPath));
  app.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      next();
      return;
    }
    if (
      req.path.startsWith('/api') ||
      req.path === '/health' ||
      req.path === '/robots.txt' ||
      req.path === '/sitemap.xml'
    ) {
      next();
      return;
    }
    if (path.extname(req.path)) {
      next();
      return;
    }
    res.sendFile(path.join(distPath, 'index.html'));
  });
} else {
  createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  }).then((vite) => {
    app.use(vite.middlewares);
  }).catch((err) => {
    logger.error({ err }, 'Failed to initialize Vite development middleware');
  });
}

const httpServer = app.listen(PORT as any, () => {
  logger.info(`Punyakart Foundation Server listening on port ${PORT}`);
  if (!razorpay) {
    logger.warn('Razorpay keys missing or placeholder — payment initiation disabled');
  }
});

httpServer.on('close', () => {
  appReady = false;
});

httpServer.on('error', (err) => {
  logger.fatal({ err }, 'HTTP server failed to start');
  process.exit(1);
});




const initiateLimiter = rateLimit({

  windowMs: 15 * 60 * 1000,

  max: 10,

  message: { error: 'Too many requests.', code: 'RATE_LIMITED' },

});



const certificateLimiter = rateLimit({

  windowMs: 15 * 60 * 1000,

  max: 80,

  message: { error: 'Too many requests.', code: 'RATE_LIMITED' },

});



const recentLimiter = rateLimit({
  ...PUBLIC_POLL_LIMITS.recent,

  message: { error: 'Too many requests.', code: 'RATE_LIMITED' },

});



const verifyLimiter = rateLimit({

  windowMs: 15 * 60 * 1000,

  max: 30,

  message: { error: 'Too many requests.', code: 'RATE_LIMITED' },

});



const adminLimiter = rateLimit({

  windowMs: 15 * 60 * 1000,

  // Successful authenticated panel polls must not burn the budget (refresh hits /api/admin often).

  // Only failed / error responses count — protects brute-force on the admin key.

  max: 80,

  skipSuccessfulRequests: true,

  message: { error: 'Too many requests. Wait a few minutes and try again.', code: 'RATE_LIMITED' },

});

// Must be mounted before admin routes; mounting it after route registration does
// not protect those already-matched handlers from brute-force traffic.
app.use('/api/admin', adminLimiter);



const statusLimiter = rateLimit({
  ...PUBLIC_POLL_LIMITS.status,

  message: { error: 'Too many requests.', code: 'RATE_LIMITED' },

});



const donorOtpLimiter = rateLimit({

  windowMs: 15 * 60 * 1000,

  max: 10,

  message: { error: 'Too many OTP requests. Please wait.', code: 'RATE_LIMITED' },

});



const donorApiLimiter = rateLimit({

  windowMs: 15 * 60 * 1000,

  max: 60,

  message: { error: 'Too many requests.', code: 'RATE_LIMITED' },

});



const adminAuth = (req: Request, res: Response, next: NextFunction) => {

  const authHeader = req.headers.authorization;

  const adminKey = process.env.ADMIN_API_KEY;



  if (!adminKey) {

    logger.warn('Admin API key not configured');

    res.status(500).json({ error: 'Server configuration error', code: 'INTERNAL_ERROR' });

    return;

  }



  const provided = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : '';

  if (!timingSafeEqualText(adminKey, provided)) {

    res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });

    return;

  }

  next();

};



function sendPdf(res: Response, pdf: Buffer, filename: string) {

  res.setHeader('Cache-Control', 'no-store');

  res.setHeader('Content-Type', 'application/pdf');

  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  res.send(pdf);

}



async function syncPendingPaymentForDonation(

  donations: Awaited<ReturnType<typeof createBackendServices>>['donations'],

  donationId: string,

) {

  if (!razorpay) return;

  const donation = await donations.findById(donationId);

  if (!donation || !['initiated', 'pending_verification', 'failed'].includes(donation.status)) return;



  try {

    if (donation.razorpayQrId) {

      const payments = await razorpay.qrCode.fetchAllPayments(donation.razorpayQrId);

      const items = (payments as { items?: Array<{ id: string; status: string; amount?: number }> }).items || [];

      const captured = items.find((payment) => capturedPaymentSnapshot(payment));

      if (captured) {

        const amount = Number(captured.amount);

        if (!Number.isSafeInteger(amount) || amount !== donation.amount * 100) {

          logger.warn({ donationId, amount, expected: donation.amount * 100 }, 'QR payment amount mismatch');

        } else {

          await verifyCapturedDonation(donations, metaConversions, donation, captured);

          return;

        }

      }

    }



    if (donation.razorpayOrderId) {

      const payments = await razorpay.orders.fetchPayments(donation.razorpayOrderId);

      const items = (payments as { items?: Array<{ id: string; status: string; amount?: number }> }).items || [];

      const captured = items.find((payment) => capturedPaymentSnapshot(payment));

      if (captured) {

        const amount = Number(captured.amount);

        if (!Number.isSafeInteger(amount) || amount !== donation.amount * 100) {

          logger.warn({ donationId, amount, expected: donation.amount * 100 }, 'Order payment amount mismatch');

          return;

        }

        await verifyCapturedDonation(donations, metaConversions, donation, captured);

      }

    }

  } catch (err) {

    logger.warn({ err, donationId }, 'Pending payment sync failed');

  }

}



let paymentReconciliationRunning = false;

/**
 * Recover captured payments when the donor closes the browser before the
 * checkout callback completes or a Razorpay webhook delivery is missed.
 * The repositories persist lastReconciliationAt so one old order does not
 * monopolize every scheduler run.
 */
async function reconcilePendingPayments(
  donations: Awaited<ReturnType<typeof createBackendServices>>['donations'],
): Promise<void> {
  if (!razorpay || paymentReconciliationRunning) return;
  paymentReconciliationRunning = true;
  try {
    const cutoff = new Date(Date.now() - 60_000);
    const candidates = await donations.listPendingForReconciliation(25, cutoff);
    for (const candidate of candidates) {
      await donations.markReconciliationAttempt(candidate.id, new Date());
      await syncPendingPaymentForDonation(donations, candidate.id);
    }
    if (candidates.length > 0) {
      logger.info({ examined: candidates.length }, 'Pending Razorpay payment reconciliation sweep completed');
    }
  } catch (err) {
    logger.error({ err }, 'Pending Razorpay payment reconciliation sweep failed');
  } finally {
    paymentReconciliationRunning = false;
  }
}

async function startServer() {

  assertProductionConfig();

  for (const warning of productionWarnings()) {

    logger.warn(warning);

  }



  const { donations, subscriptions, certificateDownloads, receiptDownloads, audit } = await createBackendServices();

  const paymentReconciliationTimer = setInterval(() => {
    void reconcilePendingPayments(donations);
  }, 60_000);
  paymentReconciliationTimer.unref?.();
  httpServer.once('close', () => clearInterval(paymentReconciliationTimer));
  void reconcilePendingPayments(donations);

  const documentHandlers = createDocumentHandlers({
    donations, certificateDownloads, receiptDownloads, getCertificateDetails,
    buildCertificatePdf: build80GCertificatePdf, buildReceiptPdf: buildDonationReceiptPdf, sendPdf,
  });

  const stopMetaConversions = metaConversions.start();
  httpServer.once('close', stopMetaConversions);
  logger.info({ metaCapi: await metaConversions.getDiagnostics() }, 'Meta CAPI configuration (no credentials)');

  app.get('/api/admin/meta-capi/status', adminAuth, async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({ success: true, metaCapi: await metaConversions.getDiagnostics() });
    } catch {
      next(new BusinessError('Meta diagnostics unavailable.', 'PERSISTENCE_ERROR'));
    }
  });



  // Campaign repository — backed by the environment-specific MongoDB database.

  const campaignRepo = new MongoCampaignRepository();
  // This is an idempotent ensure: it only creates missing built-in campaign IDs,
  // including Navratri, and never overwrites CMS edits or donation statistics.
  await seedDefaultCampaignsIfEmpty(campaignRepo);
  const blogRepo = new MongoBlogRepository();



  // ─── Public Campaigns API ─────────────────────────────────────────────────



  app.get('/api/campaigns', recentLimiter, async (_req: Request, res: Response, next: NextFunction) => {

    try {

      if (!campaignRepo) {

        res.json({ success: true, campaigns: [] });

        return;

      }

      const campaigns: CampaignWithStats[] = await campaignRepo.listWithStats(true);

      res.json({ success: true, campaigns });

    } catch (err) {

      next(err);

    }

  });



  app.get('/api/campaigns/:id', recentLimiter, async (req: Request, res: Response, next: NextFunction) => {

    try {

      if (!campaignRepo) {

        res.status(404).json({ error: 'Campaign not found', code: 'NOT_FOUND' });

        return;

      }

       const campaign = await campaignRepo.findByIdWithStats(canonicalCampaignId(req.params.id));

      if (!campaign || !campaign.is_active) {

        res.status(404).json({ error: 'Campaign not found', code: 'NOT_FOUND' });

        return;

      }

      res.json({ success: true, campaign });

    } catch (err) {

      next(err);

    }

  });



app.get('/api/blogs', recentLimiter, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({ success: true, blogs: await blogRepo.list(true) });
  } catch (err) {
    next(err);
  }
});

app.get('/api/blogs/:id', recentLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const blog = await blogRepo.findBySlugOrId(req.params.id, true);
    if (!blog) {
      res.status(404).json({ error: 'Blog not found', code: 'NOT_FOUND' });
      return;
    }
    res.json({ success: true, blog });
  } catch (err) {
    next(err);
  }
});

// ─── Admin Campaigns API ──────────────────────────────────────────────────



  app.get('/api/admin/campaigns', adminAuth, async (_req: Request, res: Response, next: NextFunction) => {

    try {

      if (!campaignRepo) {

        res.json({ success: true, campaigns: [] });

        return;

      }

      const campaigns = await campaignRepo.listWithStats(false); // include inactive

      res.json({ success: true, campaigns });

    } catch (err) {

      next(err);

    }

  });



  app.post('/api/admin/campaigns', adminAuth, async (req: Request, res: Response, next: NextFunction) => {

    try {

      if (!campaignRepo) {

        res.status(503).json({ error: 'Campaign management requires database access', code: 'INTERNAL_ERROR' });

        return;

      }

      const parsed = createCampaignSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          error: 'Campaign details are invalid.',
          code: 'VALIDATION_ERROR',
          details: parsed.error.flatten().fieldErrors,
        });

        return;
      }
      const campaign = await campaignRepo.create(parsed.data);

      await audit.record('admin_campaign_create', undefined, { campaignId: campaign.id, title: campaign.title });

      res.json({ success: true, campaign });

    } catch (err) {

      next(err);

    }

  });

  // ── Duplicate campaign ──

  app.post('/api/admin/campaigns/:id/duplicate', adminAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!campaignRepo) {
        res.status(503).json({ error: 'Campaign management requires database access', code: 'INTERNAL_ERROR' });
        return;
      }
       const source = await campaignRepo.findByIdWithStats(canonicalCampaignId(req.params.id));
      if (!source) {
        res.status(404).json({ error: 'Campaign not found', code: 'NOT_FOUND' });
        return;
      }
      const copy = await campaignRepo.create({
        title: `${source.title} Copy`,
        category: source.category,
        organizer: source.organizer,
        target: source.target,
        image: source.image,
        description: source.description,
        sort_order: source.sort_order + 1,
        has_tax_benefit: source.has_tax_benefit,
        is_active: false,
        content: source.content,
        donation_presets: source.donation_presets,
        faqs: source.faqs,
      });
      await audit.record('admin_campaign_duplicate', undefined, { sourceId: source.id, campaignId: copy.id });
      res.json({ success: true, campaign: copy });
    } catch (err) {
      next(err);
    }
  });

  // ── Media upload ──

  app.post('/api/admin/media', adminAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { mimeType, data } = req.body as { mimeType?: string; data?: string };
      const allowed = new Set(['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm']);
      if (!mimeType || !allowed.has(mimeType) || typeof data !== 'string') {
        res.status(400).json({ error: 'Upload an accepted JPG, PNG, WebP, MP4, or WebM file.', code: 'VALIDATION_ERROR' });
        return;
      }
      const raw = data.replace(/^data:[^;]+;base64,/, '');
      const buffer = Buffer.from(raw, 'base64');
      const limit = mimeType.startsWith('image/') ? 5 * 1024 * 1024 : 50 * 1024 * 1024;
      if (!buffer.length || buffer.length > limit) {
        res.status(413).json({ error: `File is too large. Images: 5 MB, videos: 50 MB.`, code: 'FILE_TOO_LARGE' });
        return;
      }
      const extension = mimeType.split('/')[1] === 'jpeg' ? 'jpg' : mimeType.split('/')[1];
      const filename = `${randomUUID()}.${extension}`;
      const mediaRoot = process.env.NODE_ENV === 'production'
        ? path.join(process.cwd(), 'dist', 'media')
        : path.join(process.cwd(), 'frontend', 'public', 'media');
      await fs.mkdir(mediaRoot, { recursive: true });
      await fs.writeFile(path.join(mediaRoot, filename), buffer, { flag: 'wx' });
      res.json({ success: true, url: `/media/${filename}`, mimeType, size: buffer.length });
    } catch (err) {
      next(err);
    }
  });

  app.put('/api/admin/campaigns/:id', adminAuth, async (req: Request, res: Response, next: NextFunction) => {

    try {

      if (!campaignRepo) {

        res.status(503).json({ error: 'Campaign management requires database access', code: 'INTERNAL_ERROR' });

        return;

      }

      const parsed = updateCampaignSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          error: 'Campaign details are invalid.',
          code: 'VALIDATION_ERROR',
          details: parsed.error.flatten().fieldErrors,
        });
        return;
      }
       const campaign = await campaignRepo.update(canonicalCampaignId(req.params.id), parsed.data);

      if (!campaign) {

        res.status(404).json({ error: 'Campaign not found', code: 'NOT_FOUND' });

        return;

      }

      await audit.record('admin_campaign_update', undefined, { campaignId: campaign.id, title: campaign.title });

      res.json({ success: true, campaign });

    } catch (err) {

      next(err);

    }

  });



app.get('/api/admin/blogs', adminAuth, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({ success: true, blogs: await blogRepo.list(false) });
  } catch (err) {
    next(err);
  }
});

app.post('/api/admin/blogs', adminAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = createBlogSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Blog details are invalid.', code: 'VALIDATION_ERROR', details: parsed.error.flatten().fieldErrors });
      return;
    }
    const blog = await blogRepo.create(parsed.data);
    await audit.record('admin_blog_create', undefined, { blogId: blog.id, title: blog.title });
    res.json({ success: true, blog });
  } catch (err) {
    next(err);
  }
});

app.put('/api/admin/blogs/:id', adminAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = updateBlogSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Blog details are invalid.', code: 'VALIDATION_ERROR', details: parsed.error.flatten().fieldErrors });
      return;
    }
    const blog = await blogRepo.update(req.params.id, parsed.data);
    if (!blog) {
      res.status(404).json({ error: 'Blog not found', code: 'NOT_FOUND' });
      return;
    }
    await audit.record('admin_blog_update', undefined, { blogId: blog.id, title: blog.title });
    res.json({ success: true, blog });
  } catch (err) {
    next(err);
  }
});

app.delete('/api/admin/blogs/:id', adminAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!await blogRepo.delete(req.params.id)) {
      res.status(404).json({ error: 'Blog not found', code: 'NOT_FOUND' });
      return;
    }
    await audit.record('admin_blog_delete', undefined, { blogId: req.params.id });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

app.delete('/api/admin/campaigns/:id', adminAuth, async (req: Request, res: Response, next: NextFunction) => {

    try {

      if (!campaignRepo) {

        res.status(503).json({ error: 'Campaign management requires database access', code: 'INTERNAL_ERROR' });

        return;

      }

      // Soft-delete by default; pass ?hard=1 for permanent deletion

      if (String(req.query.hard || '') === '1') {

        await campaignRepo.delete(canonicalCampaignId(req.params.id));

        await audit.record('admin_campaign_delete', undefined, { campaignId: req.params.id });

      } else {

        await campaignRepo.deactivate(canonicalCampaignId(req.params.id));

        await audit.record('admin_campaign_deactivate', undefined, { campaignId: req.params.id });

      }

      res.json({ success: true });

    } catch (err) {

      next(err);

    }

  });





  app.get('/robots.txt', (_req, res) => {

res.type('text/plain').send(
  'User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\nSitemap: https://punyakart.com/sitemap.xml\n',
);

});

app.get('/sitemap.xml', (_req, res) => {
const siteUrl = (process.env.PUBLIC_SITE_URL || 'https://punyakart.com').replace(/\/+$/, '');
const routes = [
  '/',
  '/campaigns',
  '/campaigns/rescue-relief',
  '/campaigns/pitru-paksha-seva',
  '/campaigns/navratri',
  '/campaigns/tuesday-seva',
  '/campaigns/gau-seva',
  '/campaigns/thursday-gau-seva',
  '/campaigns/birthday-seva',
  '/blogs',
  '/my-donations',
  '/privacy',
  '/terms',
  '/refund',
];
const urls = routes.map((route) => `  <url><loc>${siteUrl}${route}</loc></url>`).join('\n');
res.type('application/xml').send(
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`,
);
});



  app.get('/api/public/ngo', (_req, res) => {

    res.json({ success: true, certificate: getCertificateDetails() });

  });



  // ── Donor Auth Routes ──────────────────────────────────────────────



  app.post('/api/donor/login', donorOtpLimiter, async (req: Request, res: Response) => {

    try {

      const phone = String(req.body?.phone || '').trim();

      const secretId = String(req.body?.secretId || '').trim();



      if (!phone || !secretId) {

        res.status(400).json({ error: 'Phone and Donation Identifier are required.', code: 'VALIDATION_ERROR' });

        return;

      }



      const isValid = await donations.verifyDonorSecret(phone, secretId);

      if (!isValid) {

        res.status(401).json({ error: 'No matching verified donation found for this combination.', code: 'INVALID_CREDENTIALS' });

        return;

      }



      const token = signDonorToken(phone);



      // Find the donor's name from their most recent donation

      const donorDonations = await donations.findByPhone(phone);

      const name = donorDonations.length > 0 ? donorDonations[0].fullName : '';



      res.json({

        success: true,

        token,

        donor: {

          name,

          phone,

        },

      });

    } catch (err) {

      logger.error({ err }, 'donor login failed');

      res.status(500).json({ error: 'Failed to authenticate.', code: 'INTERNAL_ERROR' });

    }

  });



  app.get('/api/donor/donations', donorApiLimiter, donorAuthMiddleware as never, async (req: Request, res: Response) => {

    try {

      const phone = (req as DonorRequest).donorPhone;

      if (!phone) {

        res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });

        return;

      }



      const allDonations = await donations.findByPhone(phone);

      const safeDonations = allDonations.map((d) => ({

        id: d.id,

        amount: d.amount,

        type: d.type,

        causeTitle: d.causeTitle,

        fullName: d.fullName,

        email: d.email,

        phone: d.phone,

        panNumber: d.panNumber || '',

        timestamp: d.timestamp,

        receiptNumber: d.receiptNumber || '',

        transactionId: d.transactionId || '',

        paymentMethod: d.paymentMethod,

        status: d.status,

        want80G: d.want80G,

        source: d.source || 'chennai_airport',

        autoPay: Boolean(d.autoPay),

      }));



      res.json({ success: true, donations: safeDonations });

    } catch (err) {

      logger.error({ err }, 'donor donations fetch failed');

      res.status(500).json({ error: 'Failed to fetch donations.', code: 'INTERNAL_ERROR' });

    }

  });



  app.post('/api/donations/initiate', initiateLimiter, async (req: Request, res: Response, next: NextFunction) => {

    try {

      if (!razorpay || !razorpayCreds) {

        res.status(503).json({

          error: 'Payment gateway is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.',

          code: 'GATEWAY_NOT_CONFIGURED',

        });

        return;

      }



      if (req.body?.consentDpdP !== true) {

        res.status(400).json({

          error: 'Please accept the privacy notice to continue.',

          code: 'VALIDATION_ERROR',

          details: { consentDpdP: 'Consent is required' },

        });

        return;

      }



      const initiatedAt = new Date();
      const metaAttribution = captureMetaAttribution(
        req.body?.metaTracking, process.env.PUBLIC_SITE_URL, req.get('user-agent'), initiatedAt, req.ip,
      );
      const campaignInput = await validateActiveCampaignDonation(req.body, campaignRepo);
      req.body = { ...req.body, ...campaignInput };
      const donation = await donations.initiate(req.body, initiatedAt, metaAttribution);

      const wantsAutoPay = donation.type === 'monthly' && Boolean(donation.autoPay);



      if (wantsAutoPay) {

        const planId = getRazorpayMonthlyPlanId(donation.amount);

        if (!planId) {

          await donations.markFailed(

            donation.id,

            'Auto Pay is only available for preset monthly amounts',

          ).catch(() => undefined);

          throw new BusinessError(

            'Auto Pay is only available for preset monthly amounts (₹500–₹22,000). Uncheck Auto Pay or choose a preset amount.',

            'VALIDATION_ERROR',

            { amount: 'No Razorpay plan for this custom amount' },

          );

        }



        let subscription;

        try {
          subscription = await razorpay.subscriptions.create({

            plan_id: planId,

            total_count: 120,

            customer_notify: 1,

            notes: {

              donation_id: donation.id,

              cause: donation.causeTitle.slice(0, 100),

              source: donation.source || 'chennai_airport',

              auto_pay: '1',

            },

          });
        } catch (err) {
          await donations.markFailed(
            donation.id,
            'Razorpay subscription creation failed',
          ).catch((markFailedError) => {
            logger.warn(
              { err: markFailedError, donationId: donation.id },
              'Failed to mark donation failed after Razorpay subscription creation error',
            );
          });
          throw err;
        }



        await donations.attachRazorpaySubscription(donation.id, subscription.id);



        res.status(201).json({

          success: true,

          message: 'Auto Pay subscription initiated.',

          donation: {

            id: donation.id,

            amount: donation.amount,

            type: donation.type,

            causeTitle: donation.causeTitle,

            fullName: donation.fullName,

            autoPay: true,

          },

          clientToken: donation.clientToken,

          razorpaySubscriptionId: subscription.id,

          razorpayKeyId: razorpayCreds.keyId,

          autoPay: true,

          qrImageUrl: null,

        });

        return;

      }



      let order;

      try {
        order = await razorpay.orders.create({

          amount: donation.amount * 100,

          currency: 'INR',

          receipt: donation.id.slice(0, 40),

          notes: {

            donation_id: donation.id,

            cause: donation.causeTitle,

            source: donation.source || 'chennai_airport',

          },

        });
      } catch (err) {
        await donations.markFailed(
          donation.id,
          'Razorpay order creation failed',
        ).catch((markFailedError) => {
          logger.warn(
            { err: markFailedError, donationId: donation.id },
            'Failed to mark donation failed after Razorpay order creation error',
          );
        });
        throw err;
      }



      await donations.attachRazorpayOrder(donation.id, order.id);



      res.status(201).json({

        success: true,

        message: 'Donation initiated.',

        donation: {

          id: donation.id,

          amount: donation.amount,

          type: donation.type,

          causeTitle: donation.causeTitle,

          fullName: donation.fullName,

        },

        clientToken: donation.clientToken,

        razorpayOrderId: order.id,

        razorpayKeyId: razorpayCreds.keyId,

        autoPay: false,

      });

    } catch (err) {

      next(err);

    }

  });



  app.post('/api/donations/verify-razorpay', verifyLimiter, async (req: Request, res: Response, next: NextFunction) => {

    try {

      if (!razorpayCreds) {

        res.status(503).json({ error: 'Payment gateway is not configured.', code: 'GATEWAY_NOT_CONFIGURED' });

        return;

      }



      const {

        razorpay_order_id,

        razorpay_payment_id,

        razorpay_signature,

        razorpay_subscription_id,

        donation_id,

      } = req.body;



      if (!razorpay_payment_id || !razorpay_signature || !donation_id) {

        res.status(400).json({ error: 'Missing payment verification fields', code: 'VALIDATION_ERROR' });

        return;

      }



      const donation = await donations.findById(donation_id);

      if (!donation) {

        res.status(404).json({ error: 'Donation not found', code: 'NOT_FOUND' });

        return;

      }



      donations.assertClientToken(donation, String(req.body?.clientToken || ''));

      const payment = await razorpay!.payments.fetch(razorpay_payment_id);

      if (!capturedPaymentSnapshot(payment)) {
        throw new BusinessError('A captured INR payment is required.', 'VALIDATION_ERROR');
      }



      if (razorpay_subscription_id) {

        const body = `${razorpay_payment_id}|${razorpay_subscription_id}`;

        const expectedSignature = crypto

          .createHmac('sha256', razorpayCreds.keySecret)

          .update(body)

          .digest('hex');



        if (!timingSafeEqualHex(expectedSignature, String(razorpay_signature))) {

          await donations.markFailed(donation_id, 'Invalid subscription payment signature').catch(() => undefined);

          res.status(400).json({ error: 'Invalid payment signature', code: 'VALIDATION_ERROR' });

          return;

        }



        assertSubscriptionPaymentMatchesDonation(

          donation,

          {

            id: String(payment.id),

            order_id: String(payment.order_id || ''),

            amount: Number(payment.amount),

            status: String(payment.status),

            captured: Boolean(payment.captured),

          },

          String(razorpay_subscription_id),

        );



        const result = await verifyCapturedDonation(donations, metaConversions, donation, payment);

        res.json({ success: true, donation: { ...withoutClientToken(result), clientToken: String(req.body?.clientToken || '') } });

        return;

      }



      if (!razorpay_order_id) {

        res.status(400).json({ error: 'Missing payment verification fields', code: 'VALIDATION_ERROR' });

        return;

      }



      const body = `${razorpay_order_id}|${razorpay_payment_id}`;

      const expectedSignature = crypto

        .createHmac('sha256', razorpayCreds.keySecret)

        .update(body)

        .digest('hex');



      if (!timingSafeEqualHex(expectedSignature, String(razorpay_signature))) {

        await donations.markFailed(donation_id, 'Invalid payment signature').catch(() => undefined);

        res.status(400).json({ error: 'Invalid payment signature', code: 'VALIDATION_ERROR' });

        return;

      }



      assertPaymentMatchesDonation(

        donation,

        {

          id: String(payment.id),

          order_id: String(payment.order_id || ''),

          amount: Number(payment.amount),

          status: String(payment.status),

          captured: Boolean(payment.captured),

        },

        razorpay_order_id,

      );



      const result = await verifyCapturedDonation(donations, metaConversions, donation, payment);

      res.json({ success: true, donation: { ...withoutClientToken(result), clientToken: String(req.body?.clientToken || '') } });

    } catch (err) {

      next(err);

    }

  });



  app.post('/api/donations/:id/fail', verifyLimiter, async (req: Request, res: Response, next: NextFunction) => {

    try {

      const existing = await donations.findById(req.params.id);

      if (!existing) {

        res.status(404).json({ error: 'Donation not found', code: 'NOT_FOUND' });

        return;

      }

      donations.assertClientToken(existing, String(req.body?.clientToken || ''));

      const reason = String(req.body?.reason || 'Payment failed or cancelled');

      const result = await donations.markFailed(req.params.id, reason);

      res.json({ success: true, donation: { id: result.id, status: result.status } });

    } catch (err) {

      next(err);

    }

  });



  app.get('/api/donations/recent', recentLimiter, async (req: Request, res: Response, next: NextFunction) => {

    try {

      res.setHeader('Cache-Control', 'no-store');

      const limit = Math.min(Number(req.query.limit) || 30, 100);

      const source = String(req.query.source || '').trim() || undefined;

      const recent = await donations.listRecent(limit, source);



      const safeData = recent.map(toPublicRecentDonation);



      res.json({ success: true, donations: safeData });

    } catch (err) {

      next(err);

    }

  });



  app.get('/api/donations/certificate', certificateLimiter, documentHandlers.certificate);

  app.post('/api/donations/certificate/verify', certificateLimiter, documentHandlers.verify);

  /** Receipt references are not secrets; login or successful donor-details verification is required. */
  app.post('/api/donations/receipt/lookup', certificateLimiter, documentHandlers.receiptLookup);



  app.post('/api/webhooks/razorpay', async (req: Request, res: Response) => {

    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET?.trim();

    if (!webhookSecret) {

      logger.warn('RAZORPAY_WEBHOOK_SECRET not set; rejecting webhook');

      res.status(503).json({ error: 'Webhook not configured' });

      return;

    }



    const signature = req.headers['x-razorpay-signature'];

    const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;

    if (!signature || !rawBody) {

      res.status(400).json({ error: 'Missing signature' });

      return;

    }



    const expected = crypto.createHmac('sha256', webhookSecret).update(rawBody).digest('hex');

    if (!timingSafeEqualHex(expected, String(signature))) {

      res.status(400).json({ error: 'Invalid webhook signature' });

      return;

    }



    try {

      const event = req.body;

      const eventName = event?.event as string | undefined;



      if (eventName === 'payment.captured') {

        const payment = event.payload?.payment?.entity;

        const orderId = payment?.order_id as string | undefined;

        const paymentId = payment?.id as string | undefined;

        const qrCodeId = payment?.qr_code as string | undefined;

        const donationId = payment?.notes?.donation_id as string | undefined;

        const paidAmount = Number(payment?.amount);



        const existing =

          (orderId ? await donations.findByRazorpayOrderId(orderId) : null) ||

          (donationId ? await donations.findById(donationId) : null) ||

          (qrCodeId ? await donations.findByRazorpayQrId(qrCodeId) : null);



        if (existing && (!Number.isSafeInteger(paidAmount) || paidAmount !== existing.amount * 100)) {

          logger.warn({ donationId: existing.id, paidAmount, expected: existing.amount * 100 }, 'Webhook amount mismatch');

        } else if (paymentId && capturedPaymentSnapshot(payment)) {

          const verified = existing
            ? await verifyCapturedDonation(donations, metaConversions, existing, payment)
            : null;



          if (verified) {

            logger.info(

              { orderId, donationId: verified.id, paymentId, qrCodeId },

              'Webhook verified donation',

            );

          } else {

            logger.warn(

              { orderId, donationId, qrCodeId, paymentId },

              'Webhook captured payment but no matching donation',

            );

          }

        }

      }



      if (eventName === 'payment.failed') {

        const payment = event.payload?.payment?.entity;

        const orderId = payment?.order_id as string | undefined;

        const reason = payment?.error_description || 'Payment failed';

        if (orderId) {

          const recorded = await donations.recordPaymentFailureByRazorpayOrder(orderId, reason);

          logger.info(
            { orderId, reason, donationId: recorded?.id },
            'Webhook recorded a failed payment attempt; Razorpay order remains reconcilable',
          );

        }

      }



      if (eventName === 'payment.refunded' || eventName === 'refund.processed') {

        const payment = event.payload?.payment?.entity || event.payload?.refund?.entity;

        const orderId = payment?.order_id as string | undefined;

        const paymentId = (payment?.payment_id || payment?.id) as string | undefined;

        if (orderId) {

          const refunded = await donations.refundByRazorpayOrder(orderId);

          logger.info({ orderId, donationId: refunded?.id }, 'Webhook marked donation refunded');

        } else if (paymentId) {

          const refunded = await donations.refundByPaymentRef(paymentId);

          logger.info({ paymentId, donationId: refunded?.id }, 'Webhook marked donation refunded by payment');

        }

      }



      if (eventName === 'subscription.charged') {

        const payment = event.payload?.payment?.entity;

        const subscription = event.payload?.subscription?.entity;

        const paymentId = payment?.id as string | undefined;

        const subscriptionId = (subscription?.id || payment?.notes?.subscription_id) as string | undefined;

        const paidAmount = Number(payment?.amount);

        const donationIdFromNotes = (subscription?.notes?.donation_id || payment?.notes?.donation_id) as

          | string

          | undefined;



        if (paymentId && subscriptionId && capturedPaymentSnapshot(payment)) {

          const seed =

            (await donations.findByRazorpaySubscriptionId(subscriptionId)) ||

            (donationIdFromNotes ? await donations.findById(donationIdFromNotes) : null);



          let verified: Awaited<ReturnType<typeof donations.verify>> | null = null;

          if (seed && (seed.razorpaySubscriptionId !== subscriptionId || paidAmount !== seed.amount * 100)) {
            logger.warn({ donationId: seed.id }, 'Ignoring subscription charge with mismatched binding or amount');
            res.json({ status: 'ok' });
            return;
          }

          if (seed && ['initiated', 'pending_verification', 'failed'].includes(seed.status)) {

            verified = await verifyCapturedDonation(donations, metaConversions, seed, payment);

            logger.info(

              { subscriptionId, donationId: verified.id, paymentId },

              'Webhook verified Auto Pay authorization donation',

            );

          } else {

            verified = await donations.recordSubscriptionCharge({

              razorpaySubscriptionId: subscriptionId,

              paymentId,

              amountPaise: paidAmount,

            });

            if (verified) {

              logger.info(

                { subscriptionId, donationId: verified.id, paymentId },

                'Webhook recorded recurring Auto Pay charge',

              );

            } else {

              logger.warn(

                { subscriptionId, paymentId, donationIdFromNotes },

                'Webhook subscription.charged with no matching subscription',

              );

            }

          }

          await reportCapturedConversion(metaConversions, verified, payment);

        }

      }



      if (

        eventName === 'subscription.cancelled' ||

        eventName === 'subscription.completed' ||

        eventName === 'subscription.halted'

      ) {

        const subscription = event.payload?.subscription?.entity;

        const subscriptionId = subscription?.id as string | undefined;

        if (subscriptionId) {

          const cancelled = await subscriptions.markCancelled(subscriptionId);

          logger.info(

            { subscriptionId, localId: cancelled?.id, eventName },

            'Webhook updated Auto Pay subscription status',

          );

        }

      }



      res.json({ status: 'ok' });

    } catch (err) {

      logger.error({ err }, 'Webhook processing error');

      res.status(500).json({ error: 'Webhook processing failed' });

    }

  });



  app.get('/api/donations/:id/status', statusLimiter, async (req: Request, res: Response, next: NextFunction) => {

    try {

      res.setHeader('Cache-Control', 'no-store');

      let donation = await donations.findById(req.params.id);

      if (!donation) {

        res.status(404).json({ error: 'Donation not found', code: 'NOT_FOUND' });

        return;

      }

      let authed = false;

      try {

        donations.assertClientToken(donation, String(req.query.token || ''));

        authed = true;

      } catch {

        authed = false;

      }

      // Only the donation's holder may trigger gateway reconciliation from polling.
      if (authed) {
        await syncPendingPaymentForDonation(donations, req.params.id);
        donation = await donations.findById(req.params.id) || donation;
      }

      res.json({

        success: true,

        status: donation.status,

        donation: authed && donation.status === 'verified' ? withoutClientToken(donation) : undefined,

      });

    } catch (err) {

      next(err);

    }

  });



  app.post('/api/admin/donations/:id/verify', adminAuth, async (req: Request, res: Response, next: NextFunction) => {

    try {

      const paymentRef = req.body.paymentRef || 'manual_verification';

      const result = await donations.verify(req.params.id, paymentRef);

      await audit.record('admin_manual_verify', result.id, { paymentRef });

      logger.info({ id: req.params.id }, 'Donation manually verified');

      res.json({ success: true, donation: withoutClientToken(result) });

    } catch (err) {

      next(err);

    }

  });



  app.get('/api/admin/fundraisers', adminAuth, async (_req: Request, res: Response, next: NextFunction) => {

    try {

      const report = await donations.summarizeFundRaisers();

      res.json({ success: true, ...report });

    } catch (err) {

      next(err);

    }

  });



  app.get('/api/admin/donations', adminAuth, async (req: Request, res: Response, next: NextFunction) => {

    try {

      const eligibleOnly = String(req.query.eligible || '') === '1';

      const source = String(req.query.source || '').trim() || undefined;

      const records = eligibleOnly

        ? await donations.listEligible(source)

        : await donations.listAll(source);

      const downloads = await certificateDownloads.latestByDonationId();

      const receiptMap = await receiptDownloads.latestByDonationId();

      res.json({

        success: true,

        donations: records.map((row) => toAdminDonation(row, downloads, receiptMap)),

      });

    } catch (err) {

      next(err);

    }

  });



  app.get('/api/admin/payment-attempts', adminAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rawLimit = Number(req.query.limit || 200);
      const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(500, Math.floor(rawLimit))) : 200;
      const attempts = await donations.listPaymentAttempts(limit);
      const db = await getMongoDb();
      const summarizeCollection = async (name: string) => {
        const collection = db.collection(name);
        const statuses = ['verified', 'completed', 'refunded', 'initiated', 'pending_verification', 'failed'];
        const rows = await Promise.all(statuses.map(async (status) => {
          const filter = { status };
          const [count, newest, oldest] = await Promise.all([
            collection.countDocuments(filter),
            collection.find(filter, { projection: { timestamp: 1 } }).sort({ timestamp: -1 }).limit(1).next(),
            collection.find(filter, { projection: { timestamp: 1 } }).sort({ timestamp: 1 }).limit(1).next(),
          ]);
          return {
            status,
            count,
            newestTimestamp: typeof newest?.timestamp === 'string' ? newest.timestamp : '',
            oldestTimestamp: typeof oldest?.timestamp === 'string' ? oldest.timestamp : '',
          };
        }));
        const otherCount = await collection.countDocuments({ status: { $nin: statuses } });
        if (otherCount) rows.push({
          status: 'other',
          count: otherCount,
          newestTimestamp: '',
          oldestTimestamp: '',
        });
        return {
          total: rows.reduce((sum, row) => sum + row.count, 0),
          byStatus: rows.filter((row) => row.count > 0),
        };
      };
      const attemptCollectionExists = (await db.listCollections({ name: 'payment_attempts' }, { nameOnly: true }).toArray()).length > 0;
      const [donationSummary, attemptSummary] = await Promise.all([
        summarizeCollection('donations'),
        attemptCollectionExists ? summarizeCollection('payment_attempts') : Promise.resolve({ total: 0, byStatus: [] as Array<{ status: string; count: number; newestTimestamp: string; oldestTimestamp: string }> }),
      ]);
      let databaseHost = 'unknown';
      try {
        databaseHost = new URL(String(process.env.DATABASE_URL || '')).hostname || 'unknown';
      } catch {
        // Never return or log the connection string itself.
      }
      res.json({
        success: true,
        diagnostics: {
          checkedAt: new Date().toISOString(),
          databaseName: db.databaseName,
          databaseHost,
          donations: donationSummary,
          paymentAttempts: { collectionExists: attemptCollectionExists, ...attemptSummary },
        },
        attempts: attempts.map((row) => ({
          id: row.id,
          fullName: row.fullName,
          email: row.email,
          phone: row.phone,
          amount: row.amount,
          causeTitle: row.causeTitle,
          source: row.source || '',
          campaignId: row.campaignId || '',
          status: row.status,
          timestamp: row.timestamp,
          razorpayOrderId: row.razorpayOrderId || '',
          razorpaySubscriptionId: row.razorpaySubscriptionId || '',
          failureReason: row.failureReason || '',
        })),
      });
    } catch (err) {
      next(err);
    }
  });

  app.get('/api/admin/donations/search', adminAuth, async (req: Request, res: Response, next: NextFunction) => {

    try {

      const query = String(req.query.q || '').trim();

      const records = await donations.searchMatches(query);

      const downloads = await certificateDownloads.latestByDonationId();

      const receiptMap = await receiptDownloads.latestByDonationId();

      res.json({

        success: true,

        donations: records.map((row) => toAdminDonation(row, downloads, receiptMap)),

      });

    } catch (err) {

      next(err);

    }

  });



  app.get('/api/admin/certificates', adminAuth, async (_req: Request, res: Response, next: NextFunction) => {

    try {

      const downloads = await certificateDownloads.list();

      const latest = await certificateDownloads.latestByDonationId();

      const eligible = await donations.listEligible();



      const fromDonations = eligible

        .filter((row) => Boolean((row.receiptNumber || '').trim()))

        .map((row) => {

          const download = latest.get(row.id);

          return {

            id: download?.id || `ISSUE-${row.id}`,

            donationId: row.id,

            fullName: row.fullName,

            email: row.email,

            phone: row.phone,

            amount: row.amount,

            receiptNumber: row.receiptNumber || download?.receiptNumber || '',

            transactionId: row.transactionId || row.paymentRef || download?.transactionId || '',

            panNumber: row.panNumber || download?.panNumber || '',

            downloadedAt: download?.downloadedAt || row.verifiedAt || row.timestamp,

            source: download?.source || ('issued' as const),

            downloadCount: download?.downloadCount || 0,

          };

        });



      const covered = new Set(fromDonations.map((row) => row.donationId));

      const orphanDownloads = downloads.filter((row) => !covered.has(row.donationId));

      const certificates = [...fromDonations, ...orphanDownloads].sort((a, b) =>

        String(b.downloadedAt || '').localeCompare(String(a.downloadedAt || '')),

      );



      res.json({ success: true, certificates });

    } catch (err) {

      next(err);

    }

  });



  app.get('/api/admin/donations/:id/certificate.pdf', adminAuth, async (req: Request, res: Response, next: NextFunction) => {

    try {

      const existing = await donations.findById(req.params.id);

      if (!existing) {

        res.status(404).json({ error: 'Donation not found', code: 'NOT_FOUND' });

        return;

      }

      if (!isCertificateEligible(existing.status)) {

        res.status(409).json({

          error: 'Donation is not verified. Use Create 80G to issue a certificate.',

          code: 'VALIDATION_ERROR',

        });

        return;

      }

      const donation = existing.receiptNumber ? existing : await donations.issueCertificate(existing.id);

      const pdf = await build80GCertificatePdf(donation, getCertificateDetails());

      await certificateDownloads.recordSafe(donation, 'admin-download');

      await audit.record('admin_certificate_download', donation.id, { receiptNumber: donation.receiptNumber });

      sendPdf(res, pdf, `${donation.receiptNumber || donation.id}-80G.pdf`);

    } catch (err) {

      next(err);

    }

  });



  app.get('/api/admin/donations/:id/receipt.pdf', adminAuth, async (req: Request, res: Response, next: NextFunction) => {

    try {

      const existing = await donations.findById(req.params.id);

      if (!existing) {

        res.status(404).json({ error: 'Donation not found', code: 'NOT_FOUND' });

        return;

      }

      if (!isCertificateEligible(existing.status)) {

        res.status(409).json({

          error: 'Donation is not verified. Issue or verify the donation before downloading a receipt.',

          code: 'VALIDATION_ERROR',

        });

        return;

      }

      const donation = existing.receiptNumber ? existing : await donations.issueCertificate(existing.id);

      const pdf = await buildDonationReceiptPdf(donation, getCertificateDetails());

      await receiptDownloads.recordSafe(donation, 'receipt-admin-download');

      await audit.record('admin_receipt_download', donation.id, { receiptNumber: donation.receiptNumber });

      sendPdf(res, pdf, `${donation.receiptNumber || donation.id}-receipt.pdf`);

    } catch (err) {

      next(err);

    }

  });



  app.post('/api/admin/donations/:id/issue-certificate', adminAuth, async (req: Request, res: Response, next: NextFunction) => {

    try {

      const donation = await donations.issueCertificate(req.params.id);

      const pdf = await build80GCertificatePdf(donation, getCertificateDetails());

      await certificateDownloads.recordSafe(donation, 'admin-issue');

      await audit.record('admin_issue_certificate', donation.id, { receiptNumber: donation.receiptNumber });

      sendPdf(res, pdf, `${donation.receiptNumber || donation.id}-80G.pdf`);

    } catch (err) {

      next(err);

    }

  });



  app.post('/api/admin/certificates/create', adminAuth, async (req: Request, res: Response, next: NextFunction) => {

    try {

      if (req.body?.confirmManualIssue !== true) {

        res.status(400).json({

          error: 'Set confirmManualIssue to true to issue an 80G without a gateway payment.',

          code: 'VALIDATION_ERROR',

        });

        return;

      }

      const donation = await donations.createManualVerified(req.body);

      const pdf = await buildDonationReceiptPdf(donation, getCertificateDetails());

      await receiptDownloads.recordSafe(donation, 'receipt-admin-create');

      await audit.record('admin_create_certificate', donation.id, { receiptNumber: donation.receiptNumber });

      sendPdf(res, pdf, `${donation.receiptNumber || donation.id}-receipt.pdf`);

    } catch (err) {

      next(err);

    }

  });



  app.post('/api/donations/certificate-download', certificateLimiter, documentHandlers.certificateDownload);

  app.post('/api/donations/certificate.pdf', certificateLimiter, documentHandlers.certificatePdf);

  app.post('/api/donations/receipt.pdf', certificateLimiter, documentHandlers.receiptPdf);



  app.post('/api/admin/audit', adminAuth, async (req: Request, res: Response, next: NextFunction) => {

    try {

      await audit.record(String(req.body?.event || 'admin_export'), undefined, req.body?.meta);

      res.json({ success: true });

    } catch (err) {

      next(err);

    }

  });



  app.get('/api/admin/audit', adminAuth, async (_req: Request, res: Response, next: NextFunction) => {

    try {

      res.json({ success: true, audit: await audit.list() });

    } catch (err) {

      next(err);

    }

  });



  app.get('/api/subscriptions', adminAuth, async (_req: Request, res: Response, next: NextFunction) => {

    try {

      const list = await subscriptions.list();

      res.json({ success: true, subscriptions: list });

    } catch (err) {

      next(err);

    }

  });



  app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {

    if (err instanceof BusinessError) {

      const status =

        err.code === 'NOT_FOUND' ? 404 :

        err.code === 'DUPLICATE_RECORD' ? 409 :

        err.code === 'UNAUTHORIZED' ? 401 :

        err.code === 'VALIDATION_ERROR' ? 400 : 500;



      logger.warn({ err, requestId: req.headers['x-request-id'] }, 'Business logic error');

      res.status(status).json({ error: err.message, code: err.code, details: err.details });

      return;

    }

    const errorMsg = err instanceof Error ? err.message : String(err);

    const errorStack = err instanceof Error ? err.stack : undefined;

    logger.error(`Server Error: ${errorMsg}\n${errorStack || ''}`);

res.status(500).json({
  error: process.env.NODE_ENV === 'production' ? 'Internal server error.' : errorMsg,
  ...(process.env.NODE_ENV === 'production' ? {} : { stack: errorStack }),
  code: 'INTERNAL_ERROR',
});

  });



  
  appReady = true;
  logger.info('Punyakart backend initialization completed');

}



process.on('uncaughtException', (err) => {

  logger.fatal({ err }, 'Uncaught exception');

  process.exit(1);

});



process.on('unhandledRejection', (reason, promise) => {

  logger.fatal({ reason, promise }, 'Unhandled rejection');

  process.exit(1);

});



startServer().catch((err) => {

  logger.fatal({ err }, 'Failed to start server');

  process.exit(1);

});

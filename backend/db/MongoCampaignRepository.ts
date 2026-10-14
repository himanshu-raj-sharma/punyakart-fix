import { randomUUID } from 'node:crypto';
import type { Collection, Db, Document } from 'mongodb';
import { getMongoDb } from './mongo.js';
import logger from '../logger.js';
import type { CampaignContent } from '../../frontend/src/types/campaignCms.js';
import { campaignAttributionExpression } from '../campaignAttribution.js';

const NAVRATRI_CANONICAL_ID = 'c7';
const NAVRATRI_LEGACY_ID = 'navratri';

function physicalCampaignIds(id: string): string[] {
  const canonical = canonicalStoredCampaignId(id);
  return canonical === NAVRATRI_CANONICAL_ID
    ? [NAVRATRI_CANONICAL_ID, NAVRATRI_LEGACY_ID]
    : [canonical];
}

function canonicalStoredCampaignId(id: string): string {
  const value = id.trim();
  return value.toLowerCase() === NAVRATRI_LEGACY_ID ? NAVRATRI_CANONICAL_ID : value;
}

export interface CampaignRow {
  id: string;
  title: string;
  category: string;
  organizer: string;
  target: number;
  image: string;
  description: string;
  sort_order: number;
  has_tax_benefit: boolean;
  is_active: boolean;
  content?: CampaignContent;
  donation_presets?: number[];
  faqs?: Array<{ question: string; answer: string }>;
  created_at: string;
  updated_at: string;
}

export interface CampaignWithStats extends CampaignRow {
  raised: number;
  donors: number;
}

export interface CreateCampaignInput {
  id?: string;
  title: string;
  category: string;
  organizer: string;
  target: number;
  image: string;
  description?: string;
  sort_order?: number;
  has_tax_benefit?: boolean;
  is_active?: boolean;
  content?: CampaignContent;
  donation_presets?: number[];
  faqs?: Array<{ question: string; answer: string }>;
}

export interface UpdateCampaignInput {
  title?: string;
  category?: string;
  organizer?: string;
  target?: number;
  image?: string;
  description?: string;
  sort_order?: number;
  has_tax_benefit?: boolean;
  is_active?: boolean;
  content?: CampaignContent;
  donation_presets?: number[];
  faqs?: Array<{ question: string; answer: string }>;
}

interface CampaignDocument extends CampaignRow {
  _id?: string;
}

interface DonationDocument {
  id?: string;
  amount?: number;
  campaignId?: string;
  source?: string;
  causeTitle?: string;
  status?: string;
}

export class MongoCampaignRepository {
  private readonly databasePromise: Promise<Db>;

  private campaigns: Collection<CampaignDocument> | null = null;
  private donations: Collection<DonationDocument> | null = null;

  private indexesReady: Promise<void> | null = null;

  constructor() {
    this.databasePromise = getMongoDb();
  }

  private async getCollections(): Promise<{
    campaigns: Collection<CampaignDocument>;
    donations: Collection<DonationDocument>;
  }> {
    if (this.campaigns && this.donations) {
      return {
        campaigns: this.campaigns,
        donations: this.donations,
      };
    }

    const db = await this.databasePromise;

    this.campaigns = db.collection<CampaignDocument>('campaigns');
    this.donations = db.collection<DonationDocument>('donations');

    return {
      campaigns: this.campaigns,
      donations: this.donations,
    };
  }

  /** Resolve an API ID to one physical row, preferring c7 on a legacy conflict. */
  private async resolvePhysicalId(id: string): Promise<string | null> {
    const { campaigns } = await this.getCollections();
    const rows = await campaigns.find({ id: { $in: physicalCampaignIds(id) } }).toArray();
    const row = rows.sort((a, b) => (
      String(a.id) === NAVRATRI_CANONICAL_ID ? -1
        : String(b.id) === NAVRATRI_CANONICAL_ID ? 1
          : 0
    ))[0];
    return row ? String(row.id) : null;
  }

  private async ensureIndexes(): Promise<void> {
    if (!this.indexesReady) {
      this.indexesReady = (async () => {
        const { campaigns, donations } =
          await this.getCollections();

        await Promise.all([
          campaigns.createIndex(
            { id: 1 },
            { unique: true },
          ),

          campaigns.createIndex({
            is_active: 1,
            sort_order: 1,
            created_at: 1,
          }),

          campaigns.createIndex({
            title: 1,
          }),

          donations.createIndex({
            id: 1,
          }),

          donations.createIndex({
            status: 1,
          }),

          donations.createIndex({
            causeTitle: 1,
          }),

          donations.createIndex({
            campaignId: 1,
          }),
        ]);
      })().catch((error) => {
        this.indexesReady = null;
        throw error;
      });
    }

    await this.indexesReady;
  }

  private mapRow(
    document: CampaignDocument,
  ): CampaignRow {
    return {
      // API consumers receive the canonical identity while the stored row
      // remains unchanged for backwards compatibility.
      id: canonicalStoredCampaignId(String(document.id)),
      title: String(document.title || ''),
      category: String(document.category || ''),
      organizer: String(document.organizer || ''),
      target: Number(document.target || 0),
      image: String(document.image || ''),
      description: String(document.description || ''),
      sort_order: Number(document.sort_order ?? 0),
      has_tax_benefit: Boolean(
        document.has_tax_benefit,
      ),
      is_active: Boolean(document.is_active),
      content: document.content,
      donation_presets: Array.isArray(document.donation_presets) ? document.donation_presets.map(Number) : undefined,
      faqs: Array.isArray(document.faqs) ? document.faqs : undefined,
      created_at: String(document.created_at || ''),
      updated_at: String(document.updated_at || ''),
    };
  }

  /**
   * Returns the MongoDB aggregation stages used to calculate
   * campaign donation statistics.
   *
   * New donations match by immutable campaignId. Historical donations without
    * that field match canonical campaign sources, then known legacy titles.
   * - Ignore case and surrounding whitespace.
   * - Count only verified/completed donations.
   * - Sum their amounts.
   * - Count distinct donors by donation ID.
   */
  private statsStages(): Document[] {
    return [
      {
        $lookup: {
          from: 'donations',
          let: {
            // A legacy physical Navratri row must calculate against the same
            // canonical attribution as a c7 row.
            campaignId: {
              $cond: [{ $eq: [{ $toLower: '$id' }, NAVRATRI_LEGACY_ID] }, NAVRATRI_CANONICAL_ID, '$id'],
            },
          },
          pipeline: [
            {
              $match: {
                status: {
                  $in: [
                    'verified',
                    'completed',
                  ],
                },
              },
            },
            {
              $match: {
                $expr: {
                  $eq: [campaignAttributionExpression(), '$$campaignId'],
                },
              },
            },
          ],
          as: 'matchingDonations',
        },
      },
      {
        $addFields: {
          raised: {
            $sum: {
              $map: {
                input: '$matchingDonations',
                as: 'donation',
                in: {
                  $convert: {
                    input: '$$donation.amount',
                    to: 'double',
                    onError: 0,
                    onNull: 0,
                  },
                },
              },
            },
          },

          donors: {
            $size: {
              $setUnion: [
                [],
                {
                  $map: {
                    input: '$matchingDonations',
                    as: 'donation',
                    in: {
                      $ifNull: [
                        '$$donation.id',
                        '',
                      ],
                    },
                  },
                },
              ],
            },
          },
        },
      },
      {
        $project: {
          matchingDonations: 0,
        },
      },
    ];
  }

  /** List campaigns with real donation statistics. */
  async listWithStats(
    activeOnly = true,
  ): Promise<CampaignWithStats[]> {
    await this.ensureIndexes();

    const { campaigns } =
      await this.getCollections();

    const pipeline: Document[] = [];

    pipeline.push(
      ...this.statsStages(),
      {
        $sort: {
          sort_order: 1,
          created_at: 1,
        },
      },
    );

    const rows =
      await campaigns
        .aggregate<
          CampaignDocument & {
            raised?: number;
            donors?: number;
          }
        >(pipeline)
        .toArray();

    const mapped = rows.map((row) => ({
      physicalId: String(row.id),
      campaign: {
        ...this.mapRow(row),
        raised: Number(row.raised || 0),
        donors: Number(row.donors || 0),
      },
    }));

    // If an operator/import has created both physical IDs, c7 is the
    // deterministic authority. Never expose two API campaigns or merge their
    // independent CMS content/statistics implicitly.
    const result = new Map<string, CampaignWithStats>();
    for (const { physicalId, campaign } of mapped) {
      const previous = result.get(campaign.id);
      if (!previous || physicalId === NAVRATRI_CANONICAL_ID) result.set(campaign.id, campaign);
      if (previous && physicalId === NAVRATRI_CANONICAL_ID) {
        logger.warn({ canonicalId: campaign.id }, 'Both canonical and legacy Navratri campaign rows exist; using c7');
      }
    }
    const resolvedCampaigns = [...result.values()];
    // Filter after conflict resolution so an active legacy row cannot leak
    // through when an authoritative c7 row exists but is inactive.
    return activeOnly ? resolvedCampaigns.filter((campaign) => campaign.is_active) : resolvedCampaigns;
  }

  /** Get a single campaign with statistics by ID. */
  async findById(id: string): Promise<CampaignRow | null> {
    const { campaigns } = await this.getCollections();
    const physicalId = await this.resolvePhysicalId(id);
    const row = physicalId ? await campaigns.findOne({ id: physicalId }) : null;
    return row ? this.mapRow(row) : null;
  }

  async findByIdWithStats(
    id: string,
  ): Promise<CampaignWithStats | null> {
    await this.ensureIndexes();

    const { campaigns } =
      await this.getCollections();

    const pipeline: Document[] = [
      {
        $match: { id: { $in: physicalCampaignIds(id) } },
      },
      ...this.statsStages(),
    ];

    const rows =
      await campaigns
        .aggregate<
          CampaignDocument & {
            raised?: number;
            donors?: number;
          }
        >(pipeline)
        .toArray();

    if (!rows.length) {
      return null;
    }

    const row = rows.sort((a, b) => (String(a.id) === NAVRATRI_CANONICAL_ID ? -1 : String(b.id) === NAVRATRI_CANONICAL_ID ? 1 : 0))[0];

    return {
      ...this.mapRow(row),
      raised: Number(row.raised || 0),
      donors: Number(row.donors || 0),
    };
  }

  /** Create a new campaign. */
  async create(
    input: CreateCampaignInput,
  ): Promise<CampaignWithStats> {
    await this.ensureIndexes();

    const { campaigns } =
      await this.getCollections();

    const id =
      input.id?.trim() ? canonicalStoredCampaignId(input.id) : randomUUID();

    const now =
      new Date().toISOString();

    const campaign: CampaignDocument = {
      id,
      title: input.title.trim(),
      category: input.category.trim(),
      organizer: input.organizer.trim(),
      target: Number(input.target),
      image: input.image.trim(),
      description:
        input.description?.trim() || '',
      sort_order:
        input.sort_order ?? 0,
      has_tax_benefit:
        input.has_tax_benefit !== false,
      is_active:
        input.is_active !== false,
      content:
        input.content,
      donation_presets:
        input.donation_presets,
      faqs:
        input.faqs,
      created_at: now,
      updated_at: now,
    };

    await campaigns.insertOne(campaign);

    logger.info(
      { id },
      'Campaign created',
    );

    const created =
      await this.findByIdWithStats(id);

    if (!created) {
      throw new Error(
        'Campaign not found after create',
      );
    }

    return created;
  }

  /** Update an existing campaign. */
  async update(
    id: string,
    input: UpdateCampaignInput,
  ): Promise<CampaignWithStats | null> {
    await this.ensureIndexes();

    const { campaigns } =
      await this.getCollections();

    const updates: Partial<CampaignDocument> =
      {};

    if (input.title !== undefined) {
      updates.title =
        input.title.trim();
    }

    if (input.category !== undefined) {
      updates.category =
        input.category.trim();
    }

    if (input.organizer !== undefined) {
      updates.organizer =
        input.organizer.trim();
    }

    if (input.target !== undefined) {
      updates.target =
        Number(input.target);
    }

    if (input.image !== undefined) {
      updates.image =
        input.image.trim();
    }

    if (input.description !== undefined) {
      updates.description =
        input.description.trim();
    }

    if (input.sort_order !== undefined) {
      updates.sort_order =
        input.sort_order;
    }

    if (input.has_tax_benefit !== undefined) {
      updates.has_tax_benefit =
        Boolean(input.has_tax_benefit);
    }

    if (input.is_active !== undefined) {
      updates.is_active =
        Boolean(input.is_active);
    }

    if (input.content !== undefined) {
      updates.content = input.content;
    }

    if (input.donation_presets !== undefined) {
      updates.donation_presets = input.donation_presets;
    }

    if (input.faqs !== undefined) {
      updates.faqs = input.faqs;
    }

    if (!Object.keys(updates).length) {
      return this.findByIdWithStats(id);
    }

    updates.updated_at =
      new Date().toISOString();

    const physicalId = await this.resolvePhysicalId(id);
    if (!physicalId) return null;

    const result =
      await campaigns.updateOne(
        { id: physicalId },
        {
          $set: updates,
        },
      );

    if (result.matchedCount === 0) {
      return null;
    }

    logger.info(
      { id },
      'Campaign updated',
    );

    return this.findByIdWithStats(id);
  }

  /** Soft-delete by deactivating the campaign. */
  async deactivate(
    id: string,
  ): Promise<void> {
    await this.ensureIndexes();

    const { campaigns } =
      await this.getCollections();

    const physicalId = await this.resolvePhysicalId(id);
    if (!physicalId) return;

    await campaigns.updateOne(
      { id: physicalId },
      {
        $set: {
          is_active: false,
          updated_at:
            new Date().toISOString(),
        },
      },
    );

    logger.info(
      { id },
      'Campaign deactivated',
    );
  }

  /** Hard delete. Admin-only operation. */
  async delete(
    id: string,
  ): Promise<void> {
    await this.ensureIndexes();

    const { campaigns } =
      await this.getCollections();

    const physicalId = await this.resolvePhysicalId(id);
    if (!physicalId) return;

    await campaigns.deleteOne({ id: physicalId });

    logger.info(
      { id },
      'Campaign deleted',
    );
  }

  /**
   * MongoDB uses a shared application-level connection.
   *
   * The connection is intentionally not closed here because other
   * repositories/services may still be using the same Mongo client.
   */
  async end(): Promise<void> {
    // Intentionally left as a no-op.
  }
}

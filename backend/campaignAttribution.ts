import type { Document } from 'mongodb';

// Only known public route aliases are canonicalized; arbitrary IDs stay exact.
const CAMPAIGN_ALIASES: Record<string, string> = {
  detail: 'c1', 'rescue-relief': 'c1',
  second: 'c2', education: 'c2', 'pitru-paksha-seva': 'c2',
  tuesday: 'c3', 'tuesday-seva': 'c3', 'gau-seva': 'c4',
  'thursday-gau-seva': 'c5', 'birthday-seva': 'c6', birthday: 'c6',
  // Navratri was historically stored as `navratri`; c7 is the canonical
  // public identity. Keep the alias here so old checkout URLs and sources
  // continue to resolve without rewriting donation documents.
  navratri: 'c7',
};

// Historical title-only rows have no stable reference. Limit compatibility to
// known built-in titles, never a mutable CMS title (which could also be copied).
const LEGACY_TITLES: Record<string, string> = {
  'support emergency rescue & relief operations across india': 'c1',
  'let this pitr paksha be a time of remembrance, gratitude and compassion.': 'c2',
  'this tuesday, turn your faith into seva': 'c3',
  '1,400+ lives depend on your kindness — donate today': 'c4',
  'this thursday, let’s feed 1,400+ gaumata': 'c5',
  'celebrate your special day by sharing happiness': 'c6',
  'this navratri, your donation can give a voiceless life a second chance.': 'c7',
};

// Historical checkout sources documented in the admin campaign aliases. These
// are fixed aliases, not a lookup against arbitrary current CMS titles.
const LEGACY_SOURCE_SUFFIXES: Record<string, string> = {
  ...LEGACY_TITLES,
  'crowd funding campaign': 'c1',
  'pitru paksha campaign': 'c2',
  'gau seva campaign': 'c4',
};

export function canonicalCampaignId(id: string): string {
  const value = id.trim();
  const alias = value.toLowerCase();
  return Object.hasOwn(CAMPAIGN_ALIASES, alias) ? CAMPAIGN_ALIASES[alias] : value;
}

export function campaignIdFromSource(source?: string): string | undefined {
  const value = source?.trim() || '';
  if (!value.startsWith('campaign_') || value.length <= 9) return undefined;
  const suffix = value.slice(9).trim();
  const legacy = suffix.toLowerCase();
  return Object.hasOwn(LEGACY_SOURCE_SUFFIXES, legacy)
    ? LEGACY_SOURCE_SUFFIXES[legacy] : canonicalCampaignId(suffix);
}

export interface DonationAttribution {
  campaignId?: string;
  source?: string;
  causeTitle?: string;
}

export function attributedCampaignId(row: DonationAttribution): string | undefined {
  // A saved immutable ID is authoritative, even if the old source disagrees.
  if (row.campaignId?.trim()) {
    const campaignId = row.campaignId.trim();
    // The one historical ID alias is canonicalized; arbitrary/custom IDs
    // remain authoritative and are never inferred from mutable source text.
    return campaignId.toLowerCase() === 'navratri' ? 'c7' : campaignId;
  }
  const source = row.source?.trim() || '';
  const fromSource = campaignIdFromSource(source);
  if (fromSource) return fromSource;
  if (source && source !== 'crowd_funding') return undefined;
  const title = (row.causeTitle || '').trim().toLowerCase();
  return Object.hasOwn(LEGACY_TITLES, title) ? LEGACY_TITLES[title] : undefined;
}

export function resolvedDonationSource(row: DonationAttribution): string {
  const campaignId = attributedCampaignId(row);
  if (campaignId) return `campaign_${campaignId}`;
  const source = row.source?.trim() || '';
  return !source || source.toLowerCase() === 'chennai_airport' ? 'chennai_airport' : source;
}

export function canonicalSourceFilter(source?: string): string {
  const value = source?.trim() || '';
  const campaignId = campaignIdFromSource(value);
  return campaignId ? `campaign_${campaignId}` : value.toLowerCase() === 'chennai_airport' ? 'chennai_airport' : value;
}

const trimmed = (field: string): Document => ({
  $trim: { input: { $convert: { input: field, to: 'string', onError: '', onNull: '' } } },
});

/** Mongo equivalent of attributedCampaignId, shared by stats and recent feeds. */
export function campaignAttributionExpression(): Document {
  return {
    $let: {
      vars: { id: trimmed('$campaignId'), source: trimmed('$source'), title: { $toLower: trimmed('$causeTitle') } },
      in: {
        $switch: {
          branches: [
            {
              // Only the historical Navratri ID is remapped. Other saved
              // campaign IDs remain authoritative immutable identifiers.
              case: { $ne: ['$$id', ''] },
              then: { $cond: [{ $eq: [{ $toLower: '$$id' }, 'navratri'] }, 'c7', '$$id'] },
            },
            {
              case: { $regexMatch: { input: '$$source', regex: '^campaign_.+' } },
              then: { $let: {
                vars: { suffix: { $trim: { input: { $substrCP: ['$$source', 9, { $strLenCP: '$$source' }] } } } },
                in: { $switch: {
                  branches: [
                    ...Object.entries(CAMPAIGN_ALIASES).map(([alias, id]) => ({
                      case: { $eq: [{ $toLower: '$$suffix' }, alias] }, then: id,
                    })),
                    ...Object.entries(LEGACY_SOURCE_SUFFIXES).map(([alias, id]) => ({
                      case: { $eq: [{ $toLower: '$$suffix' }, alias] }, then: id,
                    })),
                  ],
                  default: '$$suffix',
                } },
              } },
            },
            ...Object.entries(LEGACY_TITLES).map(([title, id]) => ({
              case: { $and: [{ $in: ['$$source', ['', 'crowd_funding']] }, { $eq: ['$$title', title] }] }, then: id,
            })),
          ],
          default: '',
        },
      },
    },
  };
}

export function donationSourceMatch(source?: string): Document {
  const wanted = canonicalSourceFilter(source);
  if (!wanted || wanted === 'all') return {};
  const campaignId = campaignIdFromSource(wanted);
  if (campaignId) return { $expr: { $eq: [campaignAttributionExpression(), { $literal: campaignId }] } };
  return {
    $expr: {
      $and: [
        { $eq: [campaignAttributionExpression(), ''] },
        { $eq: [
          { $let: { vars: { source: trimmed('$source') }, in: {
            $cond: [{ $in: [{ $toLower: '$$source' }, ['', 'chennai_airport']] }, 'chennai_airport', '$$source'],
          } } },
          { $literal: wanted },
        ] },
      ],
    },
  };
}

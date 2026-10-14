import { z } from 'zod';

const safeUrl = z.string().trim().max(2_000).refine(
  (value) => value === '' || /^https?:\/\/\S+$/i.test(value) || /^\/[A-Za-z0-9/_\-.%]+$/.test(value),
  'Use an http(s) URL or a safe site-relative path.',
);

const fields = {
  title: z.string().trim().min(2).max(180),
  slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(180),
  subtitle: z.string().trim().max(300),
  excerpt: z.string().trim().max(500),
  content: z.string().trim().min(1).max(30_000),
  author: z.string().trim().max(120),
  tags: z.array(z.string().trim().min(1).max(40)).max(12),
  sections: z.array(z.object({
    heading: z.string().trim().max(180),
    body: z.string().trim().max(10_000),
    image: safeUrl,
  }).strict()).max(20),
  cover_image: safeUrl,
  youtube_url: z.string().trim().max(2_000).refine((value) => value === '' || /^https?:\/\/\S+$/i.test(value) || /^\/media\/[A-Za-z0-9_.-]+$/.test(value), 'Use a valid YouTube URL or uploaded video path.'),
  seo_title: z.string().trim().max(180),
  seo_description: z.string().trim().max(320),
  is_active: z.boolean(),
};

export const createBlogSchema = z.object({
  ...fields,
  slug: fields.slug.optional().default(''),
  subtitle: fields.subtitle.optional().default(''),
  excerpt: fields.excerpt.optional().default(''),
  author: fields.author.optional().default('Punyakart Foundation'),
  tags: fields.tags.optional().default([]),
  sections: fields.sections.optional().default([]),
  cover_image: fields.cover_image.optional().default(''),
  youtube_url: fields.youtube_url.optional().default(''),
  seo_title: fields.seo_title.optional().default(''),
  seo_description: fields.seo_description.optional().default(''),
  is_active: fields.is_active.optional().default(true),
}).strict();

export const updateBlogSchema = z.object(fields).partial().strict();

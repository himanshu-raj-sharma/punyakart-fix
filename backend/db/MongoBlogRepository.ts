import { randomUUID } from 'node:crypto';
import type { Collection, Db } from 'mongodb';
import { getMongoDb } from './mongo.js';

export interface BlogSection {
  heading: string;
  body: string;
  image: string;
}

export interface BlogRow {
  id: string;
  title: string;
  slug: string;
  subtitle: string;
  excerpt: string;
  content: string;
  author: string;
  tags: string[];
  sections: BlogSection[];
  cover_image: string;
  youtube_url: string;
  seo_title: string;
  seo_description: string;
  is_active: boolean;
  published_at: string;
  created_at: string;
  updated_at: string;
}

export type CreateBlogInput = Omit<BlogRow, 'id' | 'published_at' | 'created_at' | 'updated_at'> & {
  slug?: string;
};
export type UpdateBlogInput = Partial<CreateBlogInput>;

export class MongoBlogRepository {
  private readonly databasePromise: Promise<Db>;
  private blogs: Collection<BlogRow> | null = null;

  constructor() {
    this.databasePromise = getMongoDb();
  }

  private async collection(): Promise<Collection<BlogRow>> {
    if (!this.blogs) {
      const db = await this.databasePromise;
      this.blogs = db.collection<BlogRow>('blogs');
      await Promise.all([
        this.blogs.createIndex({ id: 1 }, { unique: true }),
        this.blogs.createIndex({ slug: 1 }, { unique: true, sparse: true }),
        this.blogs.createIndex({ is_active: 1, published_at: -1 }),
      ]);
    }
    return this.blogs;
  }

  async list(activeOnly = true): Promise<BlogRow[]> {
    const blogs = await this.collection();
    return blogs.find(activeOnly ? { is_active: true } : {}).sort({ published_at: -1, created_at: -1 }).toArray();
  }

  async findBySlugOrId(value: string, activeOnly = true): Promise<BlogRow | null> {
    const blogs = await this.collection();
    const visibility = activeOnly ? { is_active: true } : {};
    return blogs.findOne({ $or: [{ slug: value }, { id: value }], ...visibility });
  }

  async create(input: CreateBlogInput): Promise<BlogRow> {
    const blogs = await this.collection();
    const now = new Date().toISOString();
    const row: BlogRow = {
      ...input,
      id: randomUUID(),
      slug: input.slug || this.slugify(input.title),
      published_at: now,
      created_at: now,
      updated_at: now,
    };
    await blogs.insertOne(row);
    return row;
  }

  async update(id: string, input: UpdateBlogInput): Promise<BlogRow | null> {
    const blogs = await this.collection();
    const result = await blogs.findOneAndUpdate(
      { id },
      { $set: { ...input, updated_at: new Date().toISOString() } },
      { returnDocument: 'after' },
    );
    return result;
  }

  async delete(id: string): Promise<boolean> {
    const result = await (await this.collection()).deleteOne({ id });
    return result.deletedCount === 1;
  }

  private slugify(title: string): string {
    return `${title.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'story'}-${randomUUID().slice(0, 8)}`;
  }
}

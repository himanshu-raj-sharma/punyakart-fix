import React, { useEffect, useState } from 'react';
import { ArrowLeft, CalendarDays, Tag } from 'lucide-react';
import { navigate } from '../navigation';

type Blog = {
  id: string; title: string; slug: string; subtitle: string; excerpt: string; content: string;
  author: string; tags: string[]; sections: Array<{ heading: string; body: string; image: string }>;
  cover_image: string; published_at: string;
};

type BlogPageProps = { pathname?: string };

export const blogSlugForPathname = (pathname: string): string | undefined => {
  const normalizedPath = pathname.replace(/\/+$/, '') || '/';
  const match = normalizedPath.match(/^\/blogs\/([^/]+)$/);
  return match ? match[1] : undefined;
};

export const BlogPage: React.FC<BlogPageProps> = ({ pathname = window.location.pathname }) => {
  const slug = blogSlugForPathname(pathname);
  const [blogs, setBlogs] = useState<Blog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    let current = true;
    setBlogs([]);
    setLoading(true);
    void fetch(slug ? `/api/blogs/${encodeURIComponent(slug)}` : '/api/blogs', { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Blog request failed: ${response.status}`);
        return response.json() as Promise<{ blog?: Blog; blogs?: Blog[] }>;
      })
      .then((data) => {
        if (!current) return;
        setBlogs(slug ? (data.blog ? [data.blog] : []) : data.blogs || []);
      })
      .catch((error: unknown) => {
        if (current && !(error instanceof DOMException && error.name === 'AbortError')) setBlogs([]);
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
      controller.abort();
    };
  }, [slug]);

  return (
    <section className="public-page min-h-screen px-4 py-6 sm:px-6 sm:py-8">
      <div className="mx-auto max-w-6xl">
        <button type="button" onClick={() => navigate('/')} className="mb-4 inline-flex min-h-11 items-center gap-2 text-sm font-bold text-[#002D62]">
          <ArrowLeft className="h-4 w-4" /> Back home
        </button>
        <h1 className="text-3xl font-black text-[#002D62] sm:text-5xl">{slug && blogs[0] ? blogs[0].title : 'Stories of seva'}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">Updates, insights, and stories from Punyakart Foundation.</p>
        {loading ? <p className="mt-10 text-sm font-semibold text-slate-500">Loading stories…</p> : blogs.length === 0 ? (
          <p className="public-card mt-8 rounded-2xl border p-6 text-sm text-slate-600">New stories will appear here soon.</p>
        ) : (
          <div className={slug ? 'mt-6 max-w-3xl' : 'mt-6 grid gap-5 md:grid-cols-2'}>
            {blogs.map((blog) => (
              <article key={blog.id} className="public-card overflow-hidden rounded-3xl border shadow-sm">
                {blog.cover_image && <img src={blog.cover_image} alt={`${blog.title} cover`} width={1280} height={720} loading="lazy" className="aspect-[16/9] w-full object-cover" />}
                <div className="p-5 sm:p-7">
                  <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wide text-[#FF6B00]"><CalendarDays className="h-3.5 w-3.5" /> {new Date(blog.published_at).toLocaleDateString('en-IN')}</p>
                  <h2 className="mt-3 text-xl font-black text-slate-900">{blog.title}</h2>
                  {blog.subtitle && <p className="mt-2 text-sm font-semibold text-slate-500">{blog.subtitle}</p>}
                  <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-slate-700">{slug ? blog.content : (blog.excerpt || blog.content)}</p>
                  {slug && blog.sections?.map((section, index) => <section key={`${section.heading}-${index}`} className="mt-8"><h3 className="text-lg font-black text-[#002D62]">{section.heading}</h3>{section.image && <img src={section.image} alt={section.heading || `${blog.title} section image`} width={1280} height={720} loading="lazy" className="mt-3 max-h-96 w-full rounded-2xl object-cover" />}<p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-slate-700">{section.body}</p></section>)}
                  <div className="mt-4 flex flex-wrap gap-2">{blog.tags?.map((tag) => <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2 py-1 text-[10px] font-bold text-orange-800"><Tag className="h-3 w-3" />{tag}</span>)}</div>
                  {!slug && <button type="button" onClick={() => navigate(`/blogs/${blog.slug || blog.id}`)} className="mt-5 text-sm font-black text-[#002D62]">Read article →</button>}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

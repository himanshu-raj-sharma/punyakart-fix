import React, { useState } from 'react';
import { Edit3, Eye, Plus, Power, Save, Trash2, X } from 'lucide-react';
import type { AdminBlog } from '../../admin/adminTypes';
import { fetchAdminJson } from '../../admin/adminApi';

interface BlogTabProps { adminKey: string; blogs: AdminBlog[]; onChanged: () => void; }
type BlogForm = Omit<AdminBlog, 'id' | 'published_at' | 'created_at' | 'updated_at'>;
const emptyForm: BlogForm = {
  title: '', slug: '', subtitle: '', excerpt: '', content: '', author: 'Punyakart Foundation',
  tags: [], sections: [], cover_image: '', youtube_url: '', seo_title: '', seo_description: '', is_active: false,
};
const slugify = (value: string) => value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export const BlogTab: React.FC<BlogTabProps> = ({ adminKey, blogs, onChanged }) => {
  const [editing, setEditing] = useState<AdminBlog | null>(null);
  const [form, setForm] = useState<BlogForm>(emptyForm);
  const [formOpen, setFormOpen] = useState(false);
  const [tagText, setTagText] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const setField = <K extends keyof BlogForm>(field: K, value: BlogForm[K]) => setForm((current) => ({ ...current, [field]: value }));
  const open = (blog?: AdminBlog) => {
    setEditing(blog || null);
    setForm(blog ? { ...blog, sections: blog.sections || [], tags: blog.tags || [] } : emptyForm);
    setTagText(blog?.tags.join(', ') || '');
    setError(''); setFormOpen(true);
  };
  const close = () => { setEditing(null); setForm(emptyForm); setTagText(''); setFormOpen(false); };
  const uploadMedia = async (file: File, kind: 'image' | 'video') => {
    const limit = kind === 'image' ? 5 * 1024 * 1024 : 50 * 1024 * 1024;
    if ((kind === 'image' && !file.type.startsWith('image/')) || (kind === 'video' && !file.type.startsWith('video/'))) {
      throw new Error(`Choose a ${kind} file.`);
    }
    if (file.size > limit) throw new Error(`${kind === 'image' ? 'Images' : 'Videos'} must be within the upload limit.`);
    const data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error('Could not read the file.'));
      reader.readAsDataURL(file);
    });
    const result = await fetchAdminJson<{ url: string }>('/api/admin/media', adminKey, {
      method: 'POST',
      body: JSON.stringify({ mimeType: file.type, data }),
    });
    setField(kind === 'image' ? 'cover_image' : 'youtube_url', result.url);
  };
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); setSaving(true); setError('');
    try {
      const payload = { ...form, slug: form.slug || slugify(form.title), tags: tagText.split(',').map((tag) => tag.trim()).filter(Boolean) };
      await fetchAdminJson(editing ? `/api/admin/blogs/${editing.id}` : '/api/admin/blogs', adminKey, { method: editing ? 'PUT' : 'POST', body: JSON.stringify(payload) });
      close(); onChanged();
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not save article.'); } finally { setSaving(false); }
  };
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3"><div><h2 className="text-xl font-black">Blog editor</h2><p className="text-sm text-slate-500">Create drafts, publish stories, and edit every article section.</p></div><button type="button" onClick={() => open()} className="inline-flex items-center gap-2 rounded-xl bg-[#FF6B00] px-4 py-2 text-sm font-black text-white"><Plus className="h-4 w-4" /> New article</button></div>
      {formOpen && (
        <form onSubmit={save} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between"><h3 className="font-black">{editing ? 'Edit article' : 'Create article'}</h3><button type="button" onClick={close} aria-label="Close editor"><X className="h-4 w-4" /></button></div>
          <div className="grid gap-3 sm:grid-cols-2">
            {(['title', 'slug', 'subtitle', 'author', 'cover_image', 'youtube_url', 'seo_title'] as const).map((field) => <label key={field} className="text-xs font-bold capitalize">{field.replace('_', ' ')}<input required={field === 'title'} value={form[field]} onChange={(event) => setField(field, event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" /></label>)}
          </div>
          <div className="flex flex-wrap gap-4 rounded-xl border border-dashed border-slate-300 p-3 text-xs font-bold">
            <label>Upload cover image<input type="file" accept="image/jpeg,image/png,image/webp" className="mt-1 block font-normal" onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadMedia(file, 'image').catch((err) => setError(err instanceof Error ? err.message : 'Upload failed.')); }} /></label>
            <label>Upload video<input type="file" accept="video/mp4,video/webm" className="mt-1 block font-normal" onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadMedia(file, 'video').catch((err) => setError(err instanceof Error ? err.message : 'Upload failed.')); }} /></label>
            <span className="self-end font-normal text-slate-500">Images up to 5 MB · videos up to 50 MB</span>
          </div>
          <label className="block text-xs font-bold">Excerpt<textarea value={form.excerpt} onChange={(event) => setField('excerpt', event.target.value)} rows={2} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" /></label>
          <label className="block text-xs font-bold">Article content *<textarea required value={form.content} onChange={(event) => setField('content', event.target.value)} rows={10} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm leading-relaxed" /></label>
          <label className="block text-xs font-bold">Tags (comma-separated)<input value={tagText} onChange={(event) => setTagText(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" /></label>
          <div className="flex items-center justify-between gap-3"><label className="inline-flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={form.is_active} onChange={(event) => setField('is_active', event.target.checked)} /> Publish article</label>{error && <p className="text-sm font-semibold text-red-600">{error}</p>}<button disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-[#002D62] px-4 py-2 text-sm font-black text-white"><Save className="h-4 w-4" /> {saving ? 'Saving…' : 'Save article'}</button></div>
        </form>
      )}
      <div className="grid gap-4 md:grid-cols-2">{blogs.map((blog) => <article key={blog.id} className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="font-black">{blog.title}</h3><p className="text-xs text-slate-500">{blog.is_active ? 'Published' : 'Draft'} · {blog.author}</p></div><div className="flex gap-1"><button type="button" onClick={() => open(blog)} aria-label="Edit article"><Edit3 className="h-4 w-4 text-[#002D62]" /></button><button type="button" onClick={async () => { await fetchAdminJson(`/api/admin/blogs/${blog.id}`, adminKey, { method: 'PUT', body: JSON.stringify({ is_active: !blog.is_active }) }); onChanged(); }} aria-label="Toggle publish"><Power className="h-4 w-4 text-[#FF6B00]" /></button><button type="button" onClick={() => window.open(`/blogs/${blog.slug || blog.id}`, '_blank')} aria-label="Preview article"><Eye className="h-4 w-4 text-slate-500" /></button><button type="button" onClick={async () => { if (!window.confirm(`Delete "${blog.title}"?`)) return; await fetchAdminJson(`/api/admin/blogs/${blog.id}`, adminKey, { method: 'DELETE' }); onChanged(); }} aria-label="Delete article"><Trash2 className="h-4 w-4 text-red-600" /></button></div></div>{blog.excerpt && <p className="mt-3 text-sm text-slate-600">{blog.excerpt}</p>}</article>)}</div>
    </div>
  );
};

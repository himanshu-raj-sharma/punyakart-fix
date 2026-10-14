import React, { useMemo, useState } from 'react';
import { AlertCircle, Check, Edit3, Megaphone, Plus, RotateCcw, Trash2, X } from 'lucide-react';
import { AdminCampaign } from '../../admin/adminTypes';
import { fetchAdminJson, formatMoney, formatWhen } from '../../admin/adminApi';
import type { CampaignContent } from '../../types/campaignCms';
import { resolveCampaignImage } from '../campaign/campaignImages';
import { parseCampaignDonationPresets, validateCampaignContentAmounts } from '../../admin/adminCmsSync';
import { MIN_DONATION_AMOUNT, MAX_DONATION_AMOUNT } from '../../constants/donation';

interface CampaignsTabProps {
  adminKey: string;
  campaigns: AdminCampaign[];
  onChanged: () => void;
}

type CampaignForm = {
  title: string;
  category: string;
  organizer: string;
  target: string;
  image: string;
  description: string;
  sort_order: string;
  has_tax_benefit: boolean;
  is_active: boolean;
  content_json: string;
  donation_presets: string;
  faqs_json: string;
};

const emptyForm: CampaignForm = {
  title: '',
  category: '',
  organizer: '',
  target: '',
  image: '',
  description: '',
  sort_order: '0',
  has_tax_benefit: true,
  is_active: true,
  content_json: '{}',
  donation_presets: '501, 1001, 2100, 5100',
  faqs_json: '[]',
};

function toForm(campaign: AdminCampaign): CampaignForm {
  return {
    title: campaign.title,
    category: campaign.category,
    organizer: campaign.organizer,
    target: String(campaign.target),
    image: campaign.image,
    description: campaign.description,
    sort_order: String(campaign.sort_order),
    has_tax_benefit: campaign.has_tax_benefit,
    is_active: campaign.is_active,
    content_json: JSON.stringify(campaign.content || {}, null, 2),
    donation_presets: (campaign.donation_presets || []).join(', '),
    faqs_json: JSON.stringify(campaign.faqs || [], null, 2),
  };
}

export const CampaignsTab: React.FC<CampaignsTabProps> = ({ adminKey, campaigns, onChanged }) => {
  const [editing, setEditing] = useState<AdminCampaign | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<CampaignForm>(emptyForm);
  const [query, setQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return campaigns;
    return campaigns.filter((campaign) =>
      [campaign.title, campaign.category, campaign.organizer, campaign.description]
        .join(' ')
        .toLowerCase()
        .includes(needle),
    );
  }, [campaigns, query]);

  const setField = (field: keyof CampaignForm, value: string | boolean) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setFormOpen(true);
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  const openEdit = (campaign: AdminCampaign) => {
    setEditing(campaign);
    setForm(toForm(campaign));
    setFormOpen(true);
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  const closeForm = () => {
    setEditing(null);
    setFormOpen(false);
    setForm(emptyForm);
    setErrorMsg(null);
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      let content: CampaignContent = {};
      try {
        const parsedContent: unknown = JSON.parse(form.content_json || '{}');
        if (!parsedContent || Array.isArray(parsedContent) || typeof parsedContent !== 'object') {
          throw new Error('Content JSON must be an object.');
        }
        validateCampaignContentAmounts(parsedContent as Record<string, unknown>);
        content = parsedContent as CampaignContent;
      } catch (error) {
        throw new Error(error instanceof Error ? `Content JSON is invalid: ${error.message}` : 'Content JSON is invalid.');
      }
      const payload = {
        title: form.title.trim(),
        category: form.category.trim(),
        organizer: form.organizer.trim(),
        target: Number(form.target),
        image: form.image.trim(),
        description: form.description.trim(),
        sort_order: Number(form.sort_order),
        has_tax_benefit: form.has_tax_benefit,
        is_active: form.is_active,
        content,
        donation_presets: parseCampaignDonationPresets(form.donation_presets),
        faqs: (() => {
          try {
            const value: unknown = JSON.parse(form.faqs_json || '[]');
            if (!Array.isArray(value)) throw new Error('FAQs JSON must be an array.');
            return value;
          } catch (error) {
            throw new Error(error instanceof Error ? `FAQs JSON is invalid: ${error.message}` : 'FAQs JSON is invalid.');
          }
        })(),
      };
      const endpoint = editing ? `/api/admin/campaigns/${encodeURIComponent(editing.id)}` : '/api/admin/campaigns';
      await fetchAdminJson(endpoint, adminKey, {
        method: editing ? 'PUT' : 'POST',
        body: JSON.stringify(payload),
      });
      setSuccessMsg(editing ? 'Campaign updated.' : 'Campaign created.');
      closeForm();
      onChanged();
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : 'Could not save campaign.');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (campaign: AdminCampaign) => {
    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await fetchAdminJson(`/api/admin/campaigns/${encodeURIComponent(campaign.id)}`, adminKey, {
        method: 'PUT',
        body: JSON.stringify({ is_active: !campaign.is_active }),
      });
      setSuccessMsg(campaign.is_active ? 'Campaign deactivated.' : 'Campaign activated.');
      onChanged();
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : 'Could not update campaign status.');
    } finally {
      setSaving(false);
    }
  };

  const duplicate = async (campaign: AdminCampaign) => {
    setSaving(true);
    setErrorMsg(null);
    try {
      await fetchAdminJson(`/api/admin/campaigns/${encodeURIComponent(campaign.id)}/duplicate`, adminKey, { method: 'POST' });
      setSuccessMsg('Campaign duplicated as an inactive draft.');
      onChanged();
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : 'Could not duplicate campaign.');
    } finally {
      setSaving(false);
    }
  };

  const uploadImage = async (file: File) => {
    if (!file.type.startsWith('image/')) throw new Error('Choose an image file.');
    if (file.size > 5 * 1024 * 1024) throw new Error('Images must be 5 MB or smaller.');
    const data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error('Could not read the image.'));
      reader.readAsDataURL(file);
    });
    const result = await fetchAdminJson<{ url: string }>('/api/admin/media', adminKey, {
      method: 'POST',
      body: JSON.stringify({ mimeType: file.type, data }),
    });
    setField('image', result.url);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-2xl bg-orange-50 text-[#FF6B00] border border-orange-200">
            <Megaphone className="w-5 h-5" />
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-dashed border-slate-300 p-3">
            <label className="text-xs font-black text-slate-600">Upload image
              <input type="file" accept="image/jpeg,image/png,image/webp" className="mt-1 block text-xs" onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void uploadImage(file).catch((error) => setErrorMsg(error instanceof Error ? error.message : 'Upload failed.'));
              }} />
            </label>
            {form.image && <img src={resolveCampaignImage(editing?.id || '', form.image)} alt="Campaign preview" className="h-16 w-24 rounded-lg object-cover" />}
          </div>
          <div>
            <h2 className="font-display font-black text-lg text-neutral-900 dark:text-white">Campaign management</h2>
            <p className="text-xs text-neutral-500 mt-0.5">Create, edit, activate, and deactivate campaigns shown by the campaign API.</p>
          </div>
        </div>
        <button type="button" onClick={openCreate} className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-[#FF6B00] text-white text-xs font-black">
          <Plus className="w-4 h-4" /> New campaign
        </button>
      </div>

      {errorMsg && <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2"><AlertCircle className="w-4 h-4 shrink-0" />{errorMsg}</div>}
      {successMsg && <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 font-semibold">{successMsg}</div>}

      {formOpen && (
        <form onSubmit={save} className="p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-black">{editing ? 'Edit campaign' : 'Create campaign'}</h3>
            <button type="button" onClick={closeForm} className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700" aria-label="Close campaign form"><X className="w-4 h-4" /></button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {([
              ['title', 'Title', 'text'],
              ['category', 'Category', 'text'],
              ['organizer', 'Organizer', 'text'],
              ['target', 'Target amount (INR; 0 = no fixed goal)', 'number'],
              ['image', 'Image URL or site-relative path', 'text'],
              ['sort_order', 'Display order', 'number'],
            ] as const).map(([field, label, type]) => (
              <label key={field} className="text-xs font-bold text-neutral-700 dark:text-neutral-300">
                {label}{field !== 'image' && field !== 'sort_order' ? ' *' : ' (optional)'}
                <input
                  required={field !== 'sort_order' && field !== 'image'}
                  type={type}
                  min={field === 'target' || field === 'sort_order' ? '0' : undefined}
                  value={form[field]}
                  onChange={(event) => setField(field, event.target.value)}
                  className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-semibold"
                />
              </label>
            ))}
          </div>
          <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300">
            Description
            <textarea value={form.description} onChange={(event) => setField('description', event.target.value)} rows={3} className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm" />
          </label>
          <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300">
            Campaign page content (JSON)
            <span className="block mt-1 text-[11px] font-normal text-slate-500">Edit hero text, contribution cards, impact metrics, about/recovery stories, allocation rows, donor wall, FAQs, and section visibility. Leave a field out to keep the current design default.</span>
            <textarea value={form.content_json} onChange={(event) => setField('content_json', event.target.value)} rows={18} spellCheck={false} className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono leading-relaxed" />
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300">Donation amounts (comma-separated)
              <input value={form.donation_presets} onChange={(event) => setField('donation_presets', event.target.value)} className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm" />
              <span className="mt-1 block text-[11px] font-normal text-slate-500">Whole rupees, ₹{MIN_DONATION_AMOUNT}–₹{MAX_DONATION_AMOUNT.toLocaleString('en-IN')} each. Use commas only between amounts, e.g. 501, 1001.</span>
            </label>
            <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300">FAQs JSON
              <textarea value={form.faqs_json} onChange={(event) => setField('faqs_json', event.target.value)} rows={3} spellCheck={false} className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-mono" />
            </label>
          </div>
          <div className="flex flex-wrap gap-4 text-xs font-bold">
            <label className="inline-flex items-center gap-2"><input type="checkbox" checked={form.has_tax_benefit} onChange={(event) => setField('has_tax_benefit', event.target.checked)} /> 80G tax benefit</label>
            <label className="inline-flex items-center gap-2"><input type="checkbox" checked={form.is_active} onChange={(event) => setField('is_active', event.target.checked)} /> Active</label>
          </div>
          <div className="flex gap-2">
            <button disabled={saving} type="submit" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#002D62] text-white text-xs font-black disabled:opacity-50"><Check className="w-4 h-4" /> {saving ? 'Saving…' : 'Save campaign'}</button>
            <button type="button" onClick={closeForm} className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-black">Cancel</button>
          </div>
        </form>
      )}

      <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search campaigns…" className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {filtered.length === 0 ? <p className="text-sm text-neutral-500 py-6">No campaigns found.</p> : filtered.map((campaign) => (
          <article key={campaign.id} className="rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="flex gap-3 p-3">
              <img src={resolveCampaignImage(campaign.id, campaign.image)} alt="" className="w-20 h-20 rounded-xl object-cover bg-slate-100" />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-black text-sm truncate">{campaign.title}</h3>
                    <p className="text-[11px] text-slate-600">{campaign.category} · {campaign.organizer}</p>
                  </div>
                  <span className={`shrink-0 px-2 py-1 rounded-full text-[10px] font-black ${campaign.is_active ? 'bg-emerald-600 text-white' : 'bg-slate-600 text-white'}`}>{campaign.is_active ? 'Active' : 'Inactive'}</span>
                </div>
                <p className="text-xs font-bold mt-2">{formatMoney(campaign.raised)} raised <span className="text-neutral-500 font-normal">{campaign.target === 0 ? '· No fixed goal' : `of ${formatMoney(campaign.target)}`} · {campaign.donors} donors</span></p>
                <p className="text-[10px] text-neutral-500 mt-1">Updated {formatWhen(campaign.updated_at)}</p>
              </div>
            </div>
            <div className="flex gap-2 px-3 pb-3">
              <button type="button" onClick={() => openEdit(campaign)} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-[11px] font-black"><Edit3 className="w-3.5 h-3.5" /> Edit</button>
              <button type="button" disabled={saving} onClick={() => void duplicate(campaign)} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-50 text-blue-800 text-[11px] font-black disabled:opacity-50"><RotateCcw className="w-3.5 h-3.5" /> Duplicate</button>
              <button type="button" disabled={saving} onClick={() => void toggleActive(campaign)} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-[11px] font-black disabled:opacity-50">{campaign.is_active ? <Trash2 className="w-3.5 h-3.5" /> : <RotateCcw className="w-3.5 h-3.5" />} {campaign.is_active ? 'Deactivate' : 'Activate'}</button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
};

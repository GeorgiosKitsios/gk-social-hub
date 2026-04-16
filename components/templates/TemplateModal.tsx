'use client';
import { useEffect, useState } from 'react';
import { Template, TemplateType, Platform } from '@/lib/types';
import { useTemplateStore } from '@/store/useTemplateStore';
import { useBrandStore }    from '@/store/useBrandStore';

const TYPES: { value: TemplateType; label: string }[] = [{ value:'footer',label:'Footer' },{ value:'hashtag_set',label:'Hashtag-Set' },{ value:'text',label:'Textvorlage' },{ value:'cta',label:'CTA' }];
const PLATFORMS: { value: Platform; label: string }[] = [{ value:'facebook',label:'Facebook' },{ value:'instagram',label:'Instagram' },{ value:'tiktok',label:'TikTok' }];
const EMPTY_FORM = { name:'', content:'', type:'footer' as TemplateType, scope:'global' as 'global'|'brand', brandId:undefined as string|undefined, platforms:['facebook','instagram'] as Platform[] };

export default function TemplateModal({ mode, onClose }: { mode: Template|'new'|null; onClose: () => void }) {
  const { addTemplate, updateTemplate, deleteTemplate } = useTemplateStore();
  const { brands, activeBrandId } = useBrandStore();
  const [form, setForm] = useState(EMPTY_FORM);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const isNew  = mode==='new';
  const isEdit = mode!==null && mode!=='new';
  const visibleBrands = brands.filter(b => !b.archived);

  useEffect(() => {
    if (isEdit) setForm({ name:mode.name, content:mode.content, type:mode.type, scope:mode.scope, brandId:mode.brandId, platforms:[...mode.platforms] });
    else setForm({ ...EMPTY_FORM, brandId: activeBrandId ?? undefined });
    setConfirmDelete(false);
  }, [mode]);

  if (!mode) return null;

  function togglePlatform(p: Platform) { setForm(f => ({ ...f, platforms: f.platforms.includes(p) ? f.platforms.filter(x=>x!==p) : [...f.platforms,p] })); }
  function handleSave() {
    if (!form.name.trim() || !form.content.trim()) return;
    const payload = { ...form, brandId: form.scope==='global' ? undefined : form.brandId };
    if (isNew) addTemplate(payload);
    else if (isEdit) updateTemplate(mode.id, payload);
    onClose();
  }
  function handleDelete() {
    if (isEdit && confirmDelete) { deleteTemplate(mode.id); onClose(); }
    else setConfirmDelete(true);
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={e => { if(e.target===e.currentTarget) onClose(); }}>
      <div className="bg-neutral-900 border border-neutral-700 rounded-xl w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800">
          <h2 className="text-base font-medium text-white">{isNew ? 'Neue Vorlage' : 'Vorlage bearbeiten'}</h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-white text-lg">✕</button>
        </div>
        <div className="px-5 py-4 flex flex-col gap-4">
          <div><label className="block text-xs text-neutral-400 mb-1">Name *</label><input type="text" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="z. B. Standard-Footer" className="w-full bg-neutral-800 border border-neutral-600 rounded-lg px-3 py-2 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-blue-500" /></div>
          <div><label className="block text-xs text-neutral-400 mb-2">Typ</label><div className="grid grid-cols-4 gap-2">{TYPES.map(t => <button key={t.value} onClick={() => setForm(f=>({...f,type:t.value}))} className={`py-1.5 text-xs rounded-md border transition-colors ${form.type===t.value ? 'border-blue-500 bg-blue-500/10 text-blue-400' : 'border-neutral-600 text-neutral-400 hover:border-neutral-400'}`}>{t.label}</button>)}</div></div>
          <div><label className="block text-xs text-neutral-400 mb-1">Inhalt *</label><textarea value={form.content} onChange={e=>setForm(f=>({...f,content:e.target.value}))} rows={4} placeholder="Vorlagen-Text..." className="w-full bg-neutral-800 border border-neutral-600 rounded-lg px-3 py-2 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-blue-500 resize-none" /></div>
          <div>
            <label className="block text-xs text-neutral-400 mb-2">Gültig für</label>
            <div className="flex gap-2 mb-2">
              <button onClick={() => setForm(f=>({...f,scope:'global'}))} className={`flex-1 py-1.5 text-xs rounded-md border transition-colors ${form.scope==='global' ? 'border-blue-500 bg-blue-500/10 text-blue-400' : 'border-neutral-600 text-neutral-400 hover:border-neutral-400'}`}>Alle Marken (global)</button>
              <button onClick={() => setForm(f=>({...f,scope:'brand',brandId:activeBrandId??visibleBrands[0]?.id}))} className={`flex-1 py-1.5 text-xs rounded-md border transition-colors ${form.scope==='brand' ? 'border-blue-500 bg-blue-500/10 text-blue-400' : 'border-neutral-600 text-neutral-400 hover:border-neutral-400'}`}>Bestimmte Marke</button>
            </div>
            {form.scope==='brand' && <select value={form.brandId??''} onChange={e=>setForm(f=>({...f,brandId:e.target.value}))} className="w-full bg-neutral-800 border border-neutral-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500">{visibleBrands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select>}
          </div>
          <div><label className="block text-xs text-neutral-400 mb-2">Plattformen</label><div className="flex gap-2">{PLATFORMS.map(p => <button key={p.value} onClick={() => togglePlatform(p.value)} className={`flex-1 py-1.5 text-xs rounded-md border transition-colors ${form.platforms.includes(p.value) ? 'border-blue-500 bg-blue-500/10 text-blue-400' : 'border-neutral-600 text-neutral-400 hover:border-neutral-400'}`}>{p.label}</button>)}</div></div>
        </div>
        <div className="px-5 py-4 border-t border-neutral-800 flex items-center gap-2">
          {isEdit && <button onClick={handleDelete} className={`text-xs px-3 py-1.5 rounded-md border transition-colors ${confirmDelete ? 'border-red-500 bg-red-500/10 text-red-400' : 'border-neutral-600 text-neutral-500 hover:text-red-400 hover:border-red-500'}`}>{confirmDelete ? 'Wirklich löschen?' : 'Löschen'}</button>}
          <div className="flex gap-2 ml-auto">
            <button onClick={onClose} className="text-xs px-3 py-1.5 rounded-md border border-neutral-600 text-neutral-400 hover:text-white transition-colors">Abbrechen</button>
            <button onClick={handleSave} disabled={!form.name.trim()||!form.content.trim()} className="text-xs px-4 py-1.5 rounded-md bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed">{isNew ? 'Anlegen' : 'Speichern'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

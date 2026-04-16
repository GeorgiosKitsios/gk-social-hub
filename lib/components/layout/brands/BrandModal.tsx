DATEI: components/brands/BrandModal.tsx
// ============================================================
'use client';
import { useEffect, useState } from 'react';
import { Brand, Platform, AiTone } from '@/lib/types';
import { useBrandStore } from '@/store/useBrandStore';

const PLATFORMS: { value: Platform; label: string }[] = [{ value:'facebook',label:'Facebook' },{ value:'instagram',label:'Instagram' },{ value:'tiktok',label:'TikTok' }];
const AI_TONES: { value: AiTone; label: string }[] = [{ value:'professionell',label:'Professionell' },{ value:'locker',label:'Locker' },{ value:'motivierend',label:'Motivierend' },{ value:'aggressiv',label:'Aggressiv' }];
const PRESET_COLORS = ['#D85A30','#378ADD','#639922','#7F77DD','#BA7517','#1D9E75','#D4537E','#E24B4A','#888780'];
const EMPTY_FORM = { name:'', industry:'', color:PRESET_COLORS[0], aiTone:'professionell' as AiTone, aiLanguage:'de' as 'de'|'en', platforms:[] as Platform[] };

export default function BrandModal({ mode, onClose }: { mode: Brand|'new'|null; onClose: () => void }) {
  const { addBrand, updateBrand, archiveBrand } = useBrandStore();
  const [form, setForm] = useState(EMPTY_FORM);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const isNew  = mode==='new';
  const isEdit = mode!==null && mode!=='new';

  useEffect(() => {
    if (isEdit) setForm({ name:mode.name, industry:mode.industry, color:mode.color, aiTone:mode.aiTone, aiLanguage:mode.aiLanguage, platforms:[...mode.platforms] });
    else setForm(EMPTY_FORM);
    setConfirmArchive(false);
  }, [mode]);

  if (!mode) return null;
  function togglePlatform(p: Platform) { setForm(f => ({ ...f, platforms: f.platforms.includes(p) ? f.platforms.filter(x=>x!==p) : [...f.platforms,p] })); }
  function handleSave() {
    if (!form.name.trim()) return;
    const slug = form.name.toLowerCase().replace(/\s+/g,'-').replace(/[^a-z0-9-]/g,'');
    if (isNew) addBrand({ ...form, slug });
    else if (isEdit) updateBrand(mode.id, { ...form, slug });
    onClose();
  }
  function handleArchive() {
    if (isEdit && confirmArchive) { archiveBrand(mode.id); onClose(); }
    else setConfirmArchive(true);
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={e => { if(e.target===e.currentTarget) onClose(); }}>
      <div className="bg-neutral-900 border border-neutral-700 rounded-xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800">
          <h2 className="text-base font-medium text-white">{isNew ? 'Neue Marke anlegen' : 'Marke bearbeiten'}</h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-white text-lg leading-none">✕</button>
        </div>
        <div className="px-5 py-4 flex flex-col gap-4">
          <div><label className="block text-xs text-neutral-400 mb-1">Markenname *</label><input type="text" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="z. B. FC Hellas München" className="w-full bg-neutral-800 border border-neutral-600 rounded-lg px-3 py-2 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-blue-500" /></div>
          <div><label className="block text-xs text-neutral-400 mb-1">Branche</label><input type="text" value={form.industry} onChange={e=>setForm(f=>({...f,industry:e.target.value}))} placeholder="z. B. Fußball, Software" className="w-full bg-neutral-800 border border-neutral-600 rounded-lg px-3 py-2 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-blue-500" /></div>
          <div>
            <label className="block text-xs text-neutral-400 mb-2">Markenfarbe</label>
            <div className="flex gap-2 flex-wrap">
              {PRESET_COLORS.map(c => <button key={c} onClick={() => setForm(f=>({...f,color:c}))} style={{backgroundColor:c}} className={`w-7 h-7 rounded-full transition-transform ${form.color===c ? 'ring-2 ring-white ring-offset-2 ring-offset-neutral-900 scale-110' : 'hover:scale-110'}`} />)}
              <label className="w-7 h-7 rounded-full border-2 border-dashed border-neutral-500 flex items-center justify-center cursor-pointer hover:border-neutral-300 overflow-hidden">
                <input type="color" value={form.color} onChange={e=>setForm(f=>({...f,color:e.target.value}))} className="opacity-0 absolute w-0 h-0" />
                <span className="text-neutral-400 text-xs">+</span>
              </label>
            </div>
          </div>
          <div><label className="block text-xs text-neutral-400 mb-2">Plattformen</label><div className="flex gap-2">{PLATFORMS.map(p => <button key={p.value} onClick={() => togglePlatform(p.value)} className={`flex-1 py-1.5 text-xs rounded-md border transition-colors ${form.platforms.includes(p.value) ? 'border-blue-500 bg-blue-500/10 text-blue-400' : 'border-neutral-600 text-neutral-400 hover:border-neutral-400'}`}>{p.label}</button>)}</div></div>
          <div><label className="block text-xs text-neutral-400 mb-2">KI-Tonalität</label><div className="grid grid-cols-2 gap-2">{AI_TONES.map(t => <button key={t.value} onClick={() => setForm(f=>({...f,aiTone:t.value}))} className={`py-1.5 text-xs rounded-md border transition-colors ${form.aiTone===t.value ? 'border-blue-500 bg-blue-500/10 text-blue-400' : 'border-neutral-600 text-neutral-400 hover:border-neutral-400'}`}>{t.label}</button>)}</div></div>
        </div>
        <div className="px-5 py-4 border-t border-neutral-800 flex items-center gap-2">
          {isEdit && <button onClick={handleArchive} className={`text-xs px-3 py-1.5 rounded-md border transition-colors ${confirmArchive ? 'border-red-500 bg-red-500/10 text-red-400' : 'border-neutral-600 text-neutral-500 hover:text-red-400 hover:border-red-500'}`}>{confirmArchive ? 'Wirklich archivieren?' : 'Archivieren'}</button>}
          <div className="flex gap-2 ml-auto">
            <button onClick={onClose} className="text-xs px-3 py-1.5 rounded-md border border-neutral-600 text-neutral-400 hover:text-white transition-colors">Abbrechen</button>
            <button onClick={handleSave} disabled={!form.name.trim()} className="text-xs px-4 py-1.5 rounded-md bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed">{isNew ? 'Anlegen' : 'Speichern'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

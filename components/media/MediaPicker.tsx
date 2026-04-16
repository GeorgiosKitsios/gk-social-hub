DATEI: components/media/MediaPicker.tsx
// ============================================================
'use client';
import { useState } from 'react';
import { useMediaStore } from '@/store/useMediaStore';
import { Media } from '@/lib/types';
import MediaCard     from './MediaCard';
import MediaUploader from './MediaUploader';

export default function MediaPicker({ brandId, selectedIds, onConfirm, onClose }: { brandId: string; selectedIds: string[]; onConfirm: (ids: string[]) => void; onClose: () => void }) {
  const { media } = useMediaStore();
  const [chosen, setChosen]         = useState<string[]>(selectedIds);
  const [showUpload, setShowUpload] = useState(false);

  const brandMedia = media.filter(m => m.brandId===brandId);
  const sorted = [...brandMedia].sort((a,b) => new Date(b.uploadedAt).getTime()-new Date(a.uploadedAt).getTime());

  function toggle(m: Media) { setChosen(ids => ids.includes(m.id) ? ids.filter(x=>x!==m.id) : [...ids,m.id]); }

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div className="bg-neutral-900 border border-neutral-700 rounded-xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800 shrink-0">
          <div><h2 className="text-base font-medium text-white">Medium auswählen</h2>{chosen.length>0&&<p className="text-xs text-blue-400 mt-0.5">{chosen.length} ausgewählt</p>}</div>
          <div className="flex gap-2"><button onClick={()=>setShowUpload(o=>!o)} className="text-xs px-3 py-1.5 rounded-md border border-neutral-600 text-neutral-400 hover:text-white transition-colors">{showUpload ? '▲ Schließen' : '+ Upload'}</button><button onClick={onClose} className="text-neutral-400 hover:text-white text-lg leading-none">✕</button></div>
        </div>
        {showUpload && <div className="px-5 pt-4 shrink-0"><MediaUploader brandId={brandId} onUploaded={()=>setShowUpload(false)} /></div>}
        <div className="flex-1 overflow-y-auto p-5">
          {sorted.length===0
            ? <div className="text-center py-12 text-neutral-600"><p className="text-sm">Noch keine Medien.</p><button onClick={()=>setShowUpload(true)} className="mt-2 text-sm text-blue-400 hover:text-blue-300">Jetzt hochladen →</button></div>
            : <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">{sorted.map(m => <MediaCard key={m.id} media={m} selected={chosen.includes(m.id)} onSelect={toggle} />)}</div>
          }
        </div>
        <div className="flex items-center justify-between px-5 py-4 border-t border-neutral-800 shrink-0">
          <button onClick={onClose} className="text-xs px-3 py-1.5 rounded-md border border-neutral-600 text-neutral-400 hover:text-white transition-colors">Abbrechen</button>
          <button onClick={()=>{onConfirm(chosen);onClose();}} disabled={chosen.length===0} className="text-xs px-4 py-1.5 rounded-md bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed">{chosen.length>0 ? `${chosen.length} übernehmen` : 'Auswählen'}</button>
        </div>
      </div>
    </div>
  );
}

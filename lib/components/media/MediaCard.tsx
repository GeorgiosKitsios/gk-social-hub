DATEI: components/media/MediaCard.tsx
// ============================================================
'use client';
import { useState } from 'react';
import { Media } from '@/lib/types';
import { useMediaStore } from '@/store/useMediaStore';

function formatBytes(b: number) { if(b<1024) return `${b} B`; if(b<1024*1024) return `${(b/1024).toFixed(0)} KB`; return `${(b/1024/1024).toFixed(1)} MB`; }

export default function MediaCard({ media, selected, onSelect, onDeleted }: { media: Media; selected?: boolean; onSelect?: (m: Media) => void; onDeleted?: () => void }) {
  const { updateMedia, deleteMedia } = useMediaStore();
  const [tagInput, setTagInput] = useState('');
  const [editing, setEditing]   = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [preview, setPreview]   = useState(false);

  function addTag() { const t=tagInput.trim().toLowerCase(); if(!t||media.tags.includes(t)){setTagInput('');return;} updateMedia(media.id,{tags:[...media.tags,t]}); setTagInput(''); }
  function removeTag(t: string) { updateMedia(media.id,{tags:media.tags.filter(x=>x!==t)}); }
  function handleDelete() { if(confirmDel){deleteMedia(media.id);onDeleted?.();}else setConfirmDel(true); }

  return (
    <>
      <div className={`bg-neutral-800 border rounded-xl overflow-hidden transition-colors ${selected ? 'border-blue-500 ring-1 ring-blue-500' : 'border-neutral-700 hover:border-neutral-500'}`}>
        <div className="relative aspect-square bg-neutral-900 cursor-pointer group" onClick={() => onSelect ? onSelect(media) : setPreview(true)}>
          {media.type==='image' ? <img src={media.url} alt={media.filename} className="w-full h-full object-cover" /> : <div className="w-full h-full flex flex-col items-center justify-center gap-2"><span className="text-3xl text-neutral-600">▶</span><span className="text-xs text-neutral-500">Video</span></div>}
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
            <button onClick={e=>{e.stopPropagation();setPreview(true);}} className="text-white text-xs bg-black/60 px-2 py-1 rounded">Vorschau</button>
            {selected && <span className="text-blue-400 text-xs font-medium bg-black/60 px-2 py-1 rounded">✓ Ausgewählt</span>}
          </div>
        </div>
        <div className="p-3">
          <p className="text-xs text-white font-medium truncate mb-1">{media.filename}</p>
          <p className="text-xs text-neutral-500 mb-2">{formatBytes(media.sizeBytes)} · {new Date(media.uploadedAt).toLocaleDateString('de-DE')}</p>
          <div className="flex flex-wrap gap-1 mb-2">
            {media.tags.map(t => (
              <span key={t} className="text-xs px-1.5 py-0.5 bg-neutral-700 text-neutral-300 rounded flex items-center gap-1">
                {t}{editing && <button onClick={()=>removeTag(t)} className="text-neutral-500 hover:text-red-400 leading-none">×</button>}
              </span>
            ))}
          </div>
          {editing && (
            <div className="flex gap-1 mb-2">
              <input type="text" value={tagInput} onChange={e=>setTagInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addTag()} placeholder="Tag..." className="flex-1 bg-neutral-700 border border-neutral-600 rounded px-2 py-1 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-blue-500" />
              <button onClick={addTag} className="text-xs px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors">+</button>
            </div>
          )}
          <div className="flex gap-1.5">
            <button onClick={()=>{setEditing(e=>!e);setConfirmDel(false);}} className={`flex-1 text-xs py-1 rounded border transition-colors ${editing ? 'border-blue-500 text-blue-400' : 'border-neutral-600 text-neutral-400 hover:text-white hover:border-neutral-400'}`}>{editing ? '✓ Fertig' : '✎ Tags'}</button>
            <button onClick={handleDelete} className={`text-xs px-2 py-1 rounded border transition-colors ${confirmDel ? 'border-red-500 text-red-400' : 'border-neutral-600 text-neutral-500 hover:text-red-400 hover:border-red-500'}`}>{confirmDel ? '?' : '✕'}</button>
          </div>
        </div>
      </div>
      {preview && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={()=>setPreview(false)}>
          <div className="max-w-3xl max-h-[85vh] relative" onClick={e=>e.stopPropagation()}>
            <button onClick={()=>setPreview(false)} className="absolute -top-8 right-0 text-white text-sm hover:text-neutral-300">✕ Schließen</button>
            {media.type==='image' ? <img src={media.url} alt={media.filename} className="max-w-full max-h-[80vh] object-contain rounded-lg" /> : <video src={media.url} controls autoPlay className="max-w-full max-h-[80vh] rounded-lg" />}
            <p className="text-xs text-neutral-400 mt-2 text-center">{media.filename}</p>
          </div>
        </div>
      )}
    </>
  );
}

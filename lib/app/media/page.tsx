DATEI: app/media/page.tsx
// ============================================================
'use client';
import { useState } from 'react';
import { useMediaStore } from '@/store/useMediaStore';
import { useBrandStore } from '@/store/useBrandStore';
import MediaUploader from '@/components/media/MediaUploader';
import MediaCard     from '@/components/media/MediaCard';

type TypeFilter = 'all' | 'image' | 'video';

export default function MediaPage() {
  const { getByBrand, getTagsForBrand } = useMediaStore();
  const { activeBrandId, activeBrand }  = useBrandStore();
  const brandId  = activeBrandId ?? '';
  const brand    = activeBrand();
  const allMedia = getByBrand(brandId);
  const allTags  = getTagsForBrand(brandId);
  const [typeFilter, setTypeFilter]   = useState<TypeFilter>('all');
  const [activeTags, setActiveTags]   = useState<string[]>([]);
  const [showUpload, setShowUpload]   = useState(false);
  const [, forceUpdate]               = useState(0);

  function toggleTag(t: string) { setActiveTags(ts => ts.includes(t) ? ts.filter(x => x!==t) : [...ts, t]); }

  const filtered = allMedia.filter(m => {
    const matchType = typeFilter==='all' || m.type===typeFilter;
    const matchTags = activeTags.length===0 || activeTags.every(t => m.tags.includes(t));
    return matchType && matchTags;
  });
  const sorted = [...filtered].sort((a,b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-xl font-semibold text-white">Medien</h1><p className="text-sm text-neutral-400 mt-0.5">{brand?.name ?? '–'} · {allMedia.length} Dateien</p></div>
        <button onClick={() => setShowUpload(o => !o)} className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">{showUpload ? '▲ Schließen' : '+ Upload'}</button>
      </div>
      {showUpload && <div className="mb-6"><MediaUploader brandId={brandId} onUploaded={() => { forceUpdate(n=>n+1); setShowUpload(false); }} /></div>}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="flex gap-1 bg-neutral-800 p-1 rounded-lg">
          {([['all',`Alle (${allMedia.length})`],['image',`Bilder (${allMedia.filter(m=>m.type==='image').length})`],['video',`Videos (${allMedia.filter(m=>m.type==='video').length})`]] as const).map(([v,l]) => (
            <button key={v} onClick={() => setTypeFilter(v)} className={`px-3 py-1 text-xs rounded-md transition-colors ${typeFilter===v ? 'bg-neutral-600 text-white' : 'text-neutral-400 hover:text-white'}`}>{l}</button>
          ))}
        </div>
        {allTags.length > 0 && (
          <div className="flex gap-1.5 flex-wrap items-center">
            <span className="text-xs text-neutral-600">Tags:</span>
            {allTags.map(t => <button key={t} onClick={() => toggleTag(t)} className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${activeTags.includes(t) ? 'border-blue-500 bg-blue-500/10 text-blue-400' : 'border-neutral-600 text-neutral-400 hover:border-neutral-400 hover:text-white'}`}>{t}</button>)}
            {activeTags.length > 0 && <button onClick={() => setActiveTags([])} className="text-xs text-neutral-600 hover:text-white transition-colors">zurücksetzen</button>}
          </div>
        )}
      </div>
      {sorted.length > 0
        ? <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">{sorted.map(m => <MediaCard key={m.id} media={m} onDeleted={() => forceUpdate(n=>n+1)} />)}</div>
        : <div className="text-center py-20 text-neutral-600"><div className="text-4xl mb-3">⊡</div>{allMedia.length===0 ? <><p className="text-sm">Noch keine Medien.</p><button onClick={() => setShowUpload(true)} className="mt-3 text-sm text-blue-400 hover:text-blue-300">Hochladen →</button></> : <p className="text-sm">Keine Medien mit diesen Filtern.</p>}</div>
      }
    </div>
  );
}

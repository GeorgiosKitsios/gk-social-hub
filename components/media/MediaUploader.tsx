'use client';
import { useRef, useState, DragEvent } from 'react';
import { useMediaStore } from '@/store/useMediaStore';

export default function MediaUploader({ brandId, onUploaded }: { brandId: string; onUploaded?: (id: string) => void }) {
  const { fetchByBrand } = useMediaStore();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string|null>(null);

  async function processFile(file: File) {
    setError(null);
    const isImage = file.type.startsWith('image/'), isVideo = file.type.startsWith('video/');
    if (!isImage && !isVideo) { setError('Nur Bilder und Videos.'); return; }
    if (file.size > 50 * 1024 * 1024) { setError('Datei zu groß (max. 50 MB).'); return; }
    setUploading(true);
    try {
      // Direkt als FormData senden – kein Base64, kein JSON-Encoding
      const form = new FormData();
      form.append('file',    file);
      form.append('brandId', brandId);
      form.append('tags',    '[]');

      const res = await fetch('/api/media/upload', { method: 'POST', body: form });

      let data: Record<string, unknown> = {};
      try { data = await res.json(); } catch { /* ignore parse error */ }

      if (!res.ok) {
        throw new Error(String(data.error ?? `Upload fehlgeschlagen (HTTP ${res.status})`));
      }

      // Media-Liste aus der Datenbank neu laden
      await fetchByBrand(brandId);
      onUploaded?.(String(data.id ?? ''));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload fehlgeschlagen. Bitte erneut versuchen.');
    } finally {
      setUploading(false);
    }
  }

  function onDrop(e: DragEvent) { e.preventDefault(); setDragging(false); Array.from(e.dataTransfer.files).forEach(processFile); }

  return (
    <div>
      <div onDragOver={e=>{e.preventDefault();setDragging(true);}} onDragLeave={()=>setDragging(false)} onDrop={onDrop} onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${dragging ? 'border-blue-500 bg-blue-500/10' : 'border-neutral-700 hover:border-neutral-500 hover:bg-neutral-800/50'}`}>
        <input ref={inputRef} type="file" multiple accept="image/*,video/*" className="hidden" onChange={async e => { for (const f of Array.from(e.target.files??[])) await processFile(f); e.target.value=''; }} />
        {uploading
          ? <div className="flex flex-col items-center gap-2"><div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /><p className="text-sm text-neutral-400">Wird verarbeitet...</p></div>
          : <div className="flex flex-col items-center gap-2"><div className="text-3xl text-neutral-600">⊡</div><p className="text-sm text-neutral-300">Dateien ziehen oder <span className="text-blue-400">auswählen</span></p><p className="text-xs text-neutral-600">JPG, PNG, MP4, MOV · max. 50 MB</p></div>
        }
      </div>
      {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
    </div>
  );
}

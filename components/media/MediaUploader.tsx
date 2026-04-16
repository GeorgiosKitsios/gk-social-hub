'use client';
import { useRef, useState, DragEvent } from 'react';
import { useMediaStore } from '@/store/useMediaStore';

export default function MediaUploader({ brandId, onUploaded }: { brandId: string; onUploaded?: (id: string) => void }) {
  const { addMedia } = useMediaStore();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string|null>(null);

  async function processFile(file: File) {
    setError(null);
    const isImage = file.type.startsWith('image/'), isVideo = file.type.startsWith('video/');
    if (!isImage && !isVideo) { setError('Nur Bilder und Videos.'); return; }
    if (file.size > 50*1024*1024) { setError('Datei zu groß (max. 50 MB).'); return; }
    setUploading(true);
    try {
      const dataUrl = await new Promise<string>((res,rej) => { const r=new FileReader(); r.onload=()=>res(r.result as string); r.onerror=()=>rej(); r.readAsDataURL(file); });
      const id = addMedia({ brandId, type:isImage?'image':'video', filename:file.name, url:dataUrl, thumbnailUrl:isImage?dataUrl:'', sizeBytes:file.size, tags:[] });
      onUploaded?.(id);
    } finally { setUploading(false); }
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

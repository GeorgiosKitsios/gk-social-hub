'use client';
import { useRef, useState, DragEvent } from 'react';
import { supabase } from '@/lib/supabase';
import { useMediaStore } from '@/store/useMediaStore';
import { useBrandStore } from '@/store/useBrandStore';

const MAX_UPLOAD_SIZE_BYTES = 50 * 1024 * 1024;
const ALLOWED_FILE_TYPES = new Set(['image/jpeg', 'image/png', 'video/mp4', 'video/quicktime']);

type SignedUploadResponse = {
  storagePath?: string;
  token?: string;
  error?: string;
};

type CreateMediaResponse = {
  id?: string;
  error?: string;
};

async function readJson<T>(res: Response): Promise<T> {
  try {
    return await res.json() as T;
  } catch {
    return {} as T;
  }
}

export default function MediaUploader({ brandId: brandIdProp, onUploaded }: { brandId: string; onUploaded?: (id: string) => void }) {
  const { fetchByBrand } = useMediaStore();
  const { activeBrandId } = useBrandStore();
  // activeBrandId aus dem Store ist immer ein reiner String – sicherer als der Prop
  const brandId = typeof activeBrandId === 'string' && activeBrandId ? activeBrandId : (brandIdProp ?? '');
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string|null>(null);

  async function processFile(file: File) {
    setError(null);

    if (!brandId) { setError('brandId ist erforderlich.'); return; }
    if (!ALLOWED_FILE_TYPES.has(file.type)) { setError('Dateityp nicht erlaubt. Erlaubt sind JPG, PNG, MP4 und MOV.'); return; }
    if (file.size > MAX_UPLOAD_SIZE_BYTES) { setError('Datei zu groß (max. 50 MB).'); return; }

    setUploading(true);
    try {
      const signedRes = await fetch('/api/media/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandId,
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
        }),
      });
      const signedData = await readJson<SignedUploadResponse>(signedRes);

      if (!signedRes.ok || !signedData.storagePath || !signedData.token) {
        throw new Error(signedData.error ?? `Signed URL konnte nicht erstellt werden (HTTP ${signedRes.status}).`);
      }

      const { error: storageError } = await supabase.storage
        .from('media')
        .uploadToSignedUrl(signedData.storagePath, signedData.token, file, { contentType: file.type });

      if (storageError) {
        throw new Error(`Storage Upload fehlgeschlagen: ${storageError.message}`);
      }

      const createRes = await fetch('/api/media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandId,
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
          storagePath: signedData.storagePath,
          tags: [],
        }),
      });
      const createData = await readJson<CreateMediaResponse>(createRes);

      if (!createRes.ok) {
        throw new Error(createData.error ?? `DB Insert fehlgeschlagen (HTTP ${createRes.status}).`);
      }

      // Media-Liste aus der Datenbank neu laden, damit das Medium sofort angezeigt wird.
      await fetchByBrand(brandId);
      onUploaded?.(String(createData.id ?? ''));
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
        <input ref={inputRef} type="file" multiple accept="image/jpeg,image/png,video/mp4,video/quicktime" className="hidden" onChange={async e => { for (const f of Array.from(e.target.files??[])) await processFile(f); e.target.value=''; }} />
        {uploading
          ? <div className="flex flex-col items-center gap-2"><div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /><p className="text-sm text-neutral-400">Wird verarbeitet...</p></div>
          : <div className="flex flex-col items-center gap-2"><div className="text-3xl text-neutral-600">⊡</div><p className="text-sm text-neutral-300">Dateien ziehen oder <span className="text-blue-400">auswählen</span></p><p className="text-xs text-neutral-600">JPG, PNG, MP4, MOV · max. 50 MB</p></div>
        }
      </div>
      {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
    </div>
  );
}

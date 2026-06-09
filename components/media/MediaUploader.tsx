'use client';
import { useRef, useState, DragEvent } from 'react';
import { useMediaStore } from '@/store/useMediaStore';
import { useBrandStore } from '@/store/useBrandStore';

const MAX_BYTES = 100 * 1024 * 1024; // 100 MB (Cloudinary Free-Plan-Limit pro Datei)

interface CloudinaryResult {
  secure_url: string;
  public_id:  string;
}

/** Lädt eine Datei per XHR direkt zu Cloudinary hoch (signed upload).
 *  Gibt Fortschritt (0–100) via onProgress zurück. */
function uploadToCloudinary(
  file:       File,
  params:     { timestamp: number; signature: string; apiKey: string; cloudName: string; folder: string },
  onProgress: (pct: number) => void,
): Promise<CloudinaryResult> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append('file',      file);
    form.append('api_key',   params.apiKey);
    form.append('timestamp', String(params.timestamp));
    form.append('signature', params.signature);
    form.append('folder',    params.folder);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${params.cloudName}/auto/upload`);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 90));
    };

    xhr.onload = () => {
      let body: Record<string, unknown> = {};
      try { body = JSON.parse(xhr.responseText); } catch { /* ignore */ }

      if (xhr.status >= 200 && xhr.status < 300) {
        const err = body.error as { message?: string } | undefined;
        if (err) { reject(new Error(err.message ?? 'Cloudinary-Fehler')); return; }
        resolve({ secure_url: body.secure_url as string, public_id: body.public_id as string });
      } else {
        const msg = (body.error as { message?: string } | undefined)?.message
          ?? `Cloudinary HTTP ${xhr.status}`;
        reject(new Error(msg));
      }
    };

    xhr.onerror = () => reject(new Error('Netzwerkfehler beim Upload zu Cloudinary.'));
    xhr.send(form);
  });
}

export default function MediaUploader({
  brandId: brandIdProp,
  onUploaded,
}: {
  brandId:     string;
  onUploaded?: (id: string) => void;
}) {
  const { fetchByBrand } = useMediaStore();
  const { activeBrandId } = useBrandStore();
  const brandId = typeof activeBrandId === 'string' && activeBrandId
    ? activeBrandId
    : (brandIdProp ?? '');

  const inputRef              = useRef<HTMLInputElement>(null);
  const [dragging,  setDragging]  = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress,  setProgress]  = useState(0);
  const [error,     setError]     = useState<string | null>(null);

  async function processFile(file: File) {
    setError(null);

    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');
    if (!isImage && !isVideo) { setError('Nur Bilder und Videos.'); return; }
    if (file.size > MAX_BYTES) { setError('Datei zu groß (max. 100 MB).'); return; }

    setUploading(true);
    setProgress(0);

    try {
      // ── Schritt 1: Upload-Signatur vom Server holen ──────────────
      const sigRes = await fetch(`/api/media/sign-upload?brandId=${encodeURIComponent(brandId)}`);
      if (!sigRes.ok) {
        const d = await sigRes.json().catch(() => ({})) as { error?: string };
        throw new Error(d.error ?? 'Signatur konnte nicht abgerufen werden.');
      }
      const sigData = await sigRes.json() as {
        timestamp: number; signature: string; apiKey: string; cloudName: string; folder: string;
      };

      // ── Schritt 2: Datei direkt zu Cloudinary hochladen ──────────
      const cloud = await uploadToCloudinary(file, sigData, setProgress);
      setProgress(95);

      // ── Schritt 3: Metadaten in Supabase registrieren ────────────
      const regRes = await fetch('/api/media/register', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          brandId,
          fileName:    file.name,
          fileUrl:     cloud.secure_url,
          storagePath: cloud.public_id,
          mediaType:   isVideo ? 'video' : 'image',
          mimeType:    file.type,
          sizeBytes:   file.size,
          tags:        [],
        }),
      });

      let data: Record<string, unknown> = {};
      try { data = await regRes.json(); } catch { /* ignore */ }
      if (!regRes.ok) throw new Error(String(data.error ?? 'Metadaten konnten nicht gespeichert werden.'));

      setProgress(100);
      await fetchByBrand(brandId);
      onUploaded?.(String(data.id ?? ''));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload fehlgeschlagen. Bitte erneut versuchen.');
    } finally {
      setUploading(false);
      setProgress(0);
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    Array.from(e.dataTransfer.files).forEach(processFile);
  }

  return (
    <div>
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => !uploading && inputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
          uploading
            ? 'border-blue-500/40 bg-neutral-800/30 cursor-default'
            : dragging
            ? 'border-blue-500 bg-blue-500/10 cursor-copy'
            : 'border-neutral-700 hover:border-neutral-500 hover:bg-neutral-800/50 cursor-pointer'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*,video/*"
          className="hidden"
          onChange={async e => {
            for (const f of Array.from(e.target.files ?? [])) await processFile(f);
            e.target.value = '';
          }}
        />

        {uploading ? (
          <div className="flex flex-col items-center gap-3">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-neutral-400">
              {progress < 95 ? `Wird hochgeladen … ${progress} %` : 'Wird gespeichert …'}
            </p>
            {/* Fortschrittsbalken */}
            <div className="w-full max-w-xs bg-neutral-700 rounded-full h-1.5 overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-200"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <div className="text-3xl text-neutral-600">⊡</div>
            <p className="text-sm text-neutral-300">
              Dateien ziehen oder <span className="text-blue-400">auswählen</span>
            </p>
            <p className="text-xs text-neutral-600">JPG, PNG, MP4, MOV · max. 100 MB</p>
          </div>
        )}
      </div>

      {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
    </div>
  );
}

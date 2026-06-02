import { create } from 'zustand';
import { Media } from '@/lib/types';

interface MediaStore {
  media:           Media[];
  loading:         boolean;
  getById:         (id: string)       => Media | undefined;
  getByBrand:      (brandId: string)  => Media[];
  getTagsForBrand: (brandId: string)  => string[];
  fetchByBrand:    (brandId: string)  => Promise<void>;
  addMedia:        (brandId: string, file: File, tags: string[]) => Promise<string>;
  deleteMedia:     (id: string, storagePath: string) => Promise<void>;
}

export const useMediaStore = create<MediaStore>()((set, get) => ({
  media: [],
  loading: false,

  getById: (id) => {
    const media = get().media;
    return Array.isArray(media) ? media.find(m => m.id === id) : undefined;
  },

  getByBrand: (brandId) => {
    const media = get().media;
    return Array.isArray(media) ? media.filter(m => m.brandId === brandId) : [];
  },

  getTagsForBrand: (brandId) => {
    const media = get().media;
    if (!Array.isArray(media)) return [];
    return Array.from(new Set(
      media
        .filter(m => m.brandId === brandId)
        .flatMap(m => m.tags ?? [])
    ));
  },

  fetchByBrand: async (brandId) => {
    set({ loading: true });
    try {
      const res  = await fetch(`/api/media?brandId=${brandId}`);
      const data = await res.json();
      set({ media: Array.isArray(data) ? data : [], loading: false });
    } catch {
      set({ loading: false });
    }
  },

  addMedia: async (brandId, file, tags) => {
    console.log('[MediaStore] addMedia gestartet:', { brandId, fileName: file?.name, fileSize: file?.size, tags });

    if (!file || !brandId) {
      console.error('[MediaStore] addMedia: file oder brandId fehlt', { file, brandId });
      throw new Error('file und brandId sind erforderlich.');
    }

    // Datei als Base64 lesen – umgeht alle FormData-Parsing-Probleme
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload  = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Datei konnte nicht gelesen werden.'));
      reader.readAsDataURL(file);
    });

    // Robuste Base64-Extraktion:
    // 1. indexOf statt split – kein undefined-Risiko
    // 2. trim() – Whitespace entfernen
    // 3. Nur gültige Base64-Zeichen behalten (A-Z a-z 0-9 + / =)
    const commaIdx  = dataUrl.indexOf(',');
    const rawBase64 = commaIdx >= 0 ? dataUrl.substring(commaIdx + 1) : dataUrl;
    const fileBase64 = rawBase64.trim().replace(/[^A-Za-z0-9+/=]/g, '');

    if (!fileBase64) {
      throw new Error('Base64-Kodierung fehlgeschlagen – leerer String nach Extraktion.');
    }

    console.log('[MediaStore] addMedia: Base64 erzeugt, Länge:', fileBase64.length);

    let res: Response;
    try {
      res = await fetch('/api/media/upload', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandId,
          fileName:   file.name,
          fileType:   file.type,
          fileSize:   file.size,
          fileBase64,
          tags:       tags ?? [],
        }),
      });
    } catch (networkErr) {
      console.error('[MediaStore] addMedia: Netzwerkfehler beim Upload:', networkErr);
      throw networkErr;
    }

    let data: Record<string, unknown>;
    try {
      data = await res.json();
    } catch {
      console.error('[MediaStore] addMedia: Antwort kein JSON. HTTP-Status:', res.status);
      throw new Error(`Ungültige Server-Antwort (HTTP ${res.status})`);
    }

    if (!res.ok || data.error) {
      console.error('[MediaStore] addMedia: Server-Fehler:', { httpStatus: res.status, error: data.error, response: data });
      throw new Error(String(data.error ?? `HTTP ${res.status}`));
    }

    if (!data.id) {
      console.error('[MediaStore] addMedia: Keine id in Antwort:', data);
      throw new Error('Ungültige Antwort: Kein id-Feld');
    }

    console.log('[MediaStore] addMedia erfolgreich:', data.id);
    set(s => ({
      media: Array.isArray(s.media)
        ? [data as unknown as Media, ...s.media]
        : [data as unknown as Media],
    }));
    return data.id as string;
  },

  deleteMedia: async (id, storagePath) => {
    await fetch(`/api/media/${id}`, {
      method: 'DELETE',
      body: JSON.stringify({ storagePath }),
    });
    set(s => ({ media: s.media.filter(m => m.id !== id) }));
  },
}));

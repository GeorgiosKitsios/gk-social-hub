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

    const form = new FormData();
    form.append('file',    file);
    form.append('brandId', brandId);
    form.append('tags',    JSON.stringify(tags ?? []));

    let res: Response;
    try {
      res = await fetch('/api/media/upload', { method: 'POST', body: form });
    } catch (networkErr) {
      console.error('[MediaStore] addMedia: Netzwerkfehler beim Upload:', networkErr);
      throw networkErr;
    }

    let data: Record<string, unknown>;
    try {
      data = await res.json();
    } catch (parseErr) {
      console.error('[MediaStore] addMedia: Antwort konnte nicht als JSON geparst werden. HTTP-Status:', res.status);
      throw new Error(`Ungültige Server-Antwort (HTTP ${res.status})`);
    }

    if (!res.ok || data.error) {
      console.error('[MediaStore] addMedia: Server hat Fehler zurückgegeben:', {
        httpStatus: res.status,
        error:      data.error,
        response:   data,
      });
      throw new Error(String(data.error ?? `HTTP ${res.status}`));
    }

    if (!data.id) {
      console.error('[MediaStore] addMedia: Antwort enthält keine id:', data);
      throw new Error('Ungültige Antwort: Kein id-Feld');
    }

    console.log('[MediaStore] addMedia erfolgreich:', data.id);
    set(s => ({
      media: Array.isArray(s.media) ? [data as unknown as import('@/lib/types').Media, ...s.media] : [data as unknown as import('@/lib/types').Media],
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

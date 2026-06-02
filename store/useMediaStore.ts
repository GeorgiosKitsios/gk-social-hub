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

  addMedia: async (brandId, _file, _tags) => {
    // Upload erfolgt direkt in MediaUploader per FormData.
    // addMedia lädt nur die aktualisierte Media-Liste neu.
    await get().fetchByBrand(brandId);
    const media = get().media;
    return (Array.isArray(media) && media.length > 0) ? media[0].id : '';
  },

  deleteMedia: async (id, storagePath) => {
    await fetch(`/api/media/${id}`, {
      method: 'DELETE',
      body: JSON.stringify({ storagePath }),
    });
    set(s => ({ media: s.media.filter(m => m.id !== id) }));
  },
}));

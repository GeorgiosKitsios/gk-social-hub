DATEI: store/useMediaStore.ts
// ============================================================
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Media } from '@/lib/types';

interface MediaStore {
  media: Media[];
  getByBrand:  (brandId: string) => Media[];
  getById:     (id: string) => Media | undefined;
  addMedia:    (m: Omit<Media, 'id' | 'uploadedAt'>) => string;
  updateMedia: (id: string, updates: Partial<Media>) => void;
  deleteMedia: (id: string) => void;
  getTagsForBrand: (brandId: string) => string[];
}

export const useMediaStore = create<MediaStore>()(
  persist(
    (set, get) => ({
      media: [],
      getByBrand: (brandId) => get().media.filter(m => m.brandId === brandId),
      getById: (id) => get().media.find(m => m.id === id),
      addMedia: (data) => {
        const id = crypto.randomUUID();
        set(s => ({ media: [...s.media, { ...data, id, uploadedAt: new Date().toISOString() }] }));
        return id;
      },
      updateMedia: (id, updates) =>
        set(s => ({ media: s.media.map(m => m.id === id ? { ...m, ...updates } : m) })),
      deleteMedia: (id) =>
        set(s => ({ media: s.media.filter(m => m.id !== id) })),
      getTagsForBrand: (brandId) => {
        const tags = get().media.filter(m => m.brandId === brandId).flatMap(m => m.tags);
        return [...new Set(tags)].sort();
      },
    }),
    { name: 'gk-media-store' }
  )
);

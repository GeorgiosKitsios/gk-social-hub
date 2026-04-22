import { create } from 'zustand';
import { Media } from '@/lib/types';

interface MediaStore {
  media: Media[];
  loading: boolean;
  fetchByBrand: (brandId: string) => Promise<void>;
  addMedia: (brandId: string, file: File, tags: string[]) => Promise<string>;
  deleteMedia: (id: string, storagePath: string) => Promise<void>;
}

export const useMediaStore = create<MediaStore>()((set) => ({
  media: [],
  loading: false,

  fetchByBrand: async (brandId) => {
    set({ loading: true });
    const res = await fetch(`/api/media?brandId=${brandId}`);
    const data = await res.json();
    set({ media: data, loading: false });
  },

  addMedia: async (brandId, file, tags) => {
    const form = new FormData();
    form.append('file', file);
    form.append('brandId', brandId);
    form.append('tags', JSON.stringify(tags));
    const res = await fetch('/api/media/upload', { method: 'POST', body: form });
    const data = await res.json();
    set(s => ({ media: [data, ...s.media] }));
    return data.id;
  },

  deleteMedia: async (id, storagePath) => {
    await fetch(`/api/media/${id}`, {
      method: 'DELETE',
      body: JSON.stringify({ storagePath }),
    });
    set(s => ({ media: s.media.filter(m => m.id !== id) }));
  },
}));

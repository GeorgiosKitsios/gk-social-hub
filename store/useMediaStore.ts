import { create } from 'zustand';
import { Media } from '@/lib/types';

type MediaResponse = Partial<Media> & {
  brand_id?: string;
  brandId?: string;
  file_name?: string;
  fileName?: string;
  file_url?: string;
  fileUrl?: string;
  media_type?: 'image' | 'video';
  mediaType?: 'image' | 'video';
  size_bytes?: number;
  sizeBytes?: number;
  storage_path?: string;
  storagePath?: string;
  created_at?: string;
  createdAt?: string;
  updated_at?: string;
  uploadedAt?: string;
};

interface MediaStore {
  media:           Media[];
  loading:         boolean;
  getById:         (id: string)       => Media | undefined;
  getByBrand:      (brandId: string)  => Media[];
  getTagsForBrand: (brandId: string)  => string[];
  fetchByBrand:    (brandId: string)  => Promise<void>;
  addMedia:        (brandId: string, file: File, tags: string[]) => Promise<string>;
  updateMedia:     (id: string, updates: Partial<Media>) => void;
  deleteMedia:     (id: string, storagePath?: string) => Promise<void>;
}

function normalizeMedia(item: MediaResponse): Media {
  const type = item.type ?? item.mediaType ?? item.media_type ?? 'image';
  const filename = item.filename ?? item.fileName ?? item.file_name ?? '';
  const url = item.url ?? item.fileUrl ?? item.file_url ?? '';
  const uploadedAt = item.uploadedAt ?? item.createdAt ?? item.created_at ?? new Date().toISOString();

  return {
    id: String(item.id ?? ''),
    brandId: String(item.brandId ?? item.brand_id ?? ''),
    type,
    filename,
    url,
    thumbnailUrl: item.thumbnailUrl ?? url,
    sizeBytes: item.sizeBytes ?? item.size_bytes ?? 0,
    tags: Array.isArray(item.tags) ? item.tags : [],
    aiPrompt: item.aiPrompt,
    aiSuggestions: item.aiSuggestions,
    uploadedAt,
    storagePath: item.storagePath ?? item.storage_path,
  };
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
      const res  = await fetch(`/api/media?brandId=${encodeURIComponent(brandId)}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(String(data.error ?? `Medien konnten nicht geladen werden (HTTP ${res.status})`));
      }

      set({ media: Array.isArray(data) ? data.map(normalizeMedia) : [], loading: false });
    } catch (err) {
      console.error('[mediaStore] fetchByBrand failed:', err);
      set({ loading: false });
      throw err;
    }
  },

  addMedia: async (brandId) => {
    // Upload erfolgt direkt in MediaUploader per FormData.
    // addMedia lädt nur die aktualisierte Media-Liste neu.
    await get().fetchByBrand(brandId);
    const media = get().media;
    return (Array.isArray(media) && media.length > 0) ? media[0].id : '';
  },

  updateMedia: (id, updates) => {
    set(s => ({ media: s.media.map(m => m.id === id ? { ...m, ...updates } : m) }));
  },

  deleteMedia: async (id, storagePath) => {
    const pathToDelete = storagePath ?? get().media.find(m => m.id === id)?.storagePath ?? '';

    await fetch(`/api/media/${id}`, {
      method: 'DELETE',
      body: JSON.stringify({ storagePath: pathToDelete }),
    });
    set(s => ({ media: s.media.filter(m => m.id !== id) }));
  },
}));

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Post, PostStatus } from '@/lib/types';

// Sichere ID-Generierung – funktioniert auch ohne HTTPS
function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback für HTTP oder ältere Browser
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

const INITIAL_POSTS: Post[] = [
  {
    id: 'p1',
    brandId: '1',
    title: 'Spieltagsankündigung – Samstag 15:00',
    mainText: 'Samstag ist Spieltag! 🔴⚪\nWir empfangen den TSV Neuried im Grünwalder Stadion.\nAnstoß um 15:00 Uhr. Kommt zahlreich!',
    platformTexts: {},
    mediaIds: [],
    platforms: ['facebook', 'instagram'],
    platformStatus: { facebook: 'pending', instagram: 'pending' },
    scheduledAt: new Date(Date.now() + 86400000).toISOString(),
    status: 'scheduled',
    templateIds: [],
    notes: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'p2',
    brandId: '2',
    title: 'Neues Trainingsvideo',
    mainText: '🎬 Neues Video ist live!\nDiese Woche: Reaktionsschulung für Torhüter.\n\n👉 Jetzt ansehen – Link in der Bio!',
    platformTexts: {},
    mediaIds: [],
    platforms: ['instagram', 'tiktok'],
    platformStatus: { instagram: 'published', tiktok: 'published' },
    publishedAt: new Date().toISOString(),
    status: 'published',
    templateIds: [],
    notes: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

interface PostStore {
  posts: Post[];
  getPostsByBrand:  (brandId: string) => Post[];
  getPostById:      (id: string) => Post | undefined;
  addPost:          (p: Omit<Post, 'id' | 'createdAt' | 'updatedAt'>) => string;
  updatePost:       (id: string, updates: Partial<Post>) => void;
  deletePost:       (id: string) => void;
  simulatePublish:  (id: string) => void;
}

export const usePostStore = create<PostStore>()(
  persist(
    (set, get) => ({
      posts: INITIAL_POSTS,

      getPostsByBrand: (brandId) =>
        get().posts.filter(p => p.brandId === brandId),

      getPostById: (id) =>
        get().posts.find(p => p.id === id),

      addPost: (data) => {
        const id  = generateId();
        const now = new Date().toISOString();
        const newPost: Post = { ...data, id, createdAt: now, updatedAt: now };
        set(s => ({ posts: [...s.posts, newPost] }));
        // Sofort aus Store lesen um sicherzustellen dass gespeichert
        console.log('[PostStore] addPost:', id, get().posts.length, 'posts total');
        return id;
      },

      updatePost: (id, updates) => {
        set(s => ({
          posts: s.posts.map(p =>
            p.id === id
              ? { ...p, ...updates, updatedAt: new Date().toISOString() }
              : p
          ),
        }));
        console.log('[PostStore] updatePost:', id);
      },

      deletePost: (id) =>
        set(s => ({ posts: s.posts.filter(p => p.id !== id) })),

      simulatePublish: (id) => {
        const post = get().posts.find(p => p.id === id);
        if (!post) return;
        const platformStatus = Object.fromEntries(
          post.platforms.map(pl => [pl, 'published'])
        ) as Post['platformStatus'];
        set(s => ({
          posts: s.posts.map(p =>
            p.id === id
              ? {
                  ...p,
                  status: 'published',
                  platformStatus,
                  publishedAt: new Date().toISOString(),
                  updatedAt:   new Date().toISOString(),
                }
              : p
          ),
        }));
      },
    }),
    {
      name:    'gk-post-store',
      // Explizit localStorage als Storage angeben
      storage: {
        getItem: (name) => {
          try {
            const val = localStorage.getItem(name);
            return val ? JSON.parse(val) : null;
          } catch { return null; }
        },
        setItem: (name, value) => {
          try {
            localStorage.setItem(name, JSON.stringify(value));
          } catch (e) {
            console.error('[PostStore] localStorage.setItem failed:', e);
          }
        },
        removeItem: (name) => {
          try { localStorage.removeItem(name); } catch { /* ignore */ }
        },
      },
    }
  )
);

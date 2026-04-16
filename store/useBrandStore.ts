DATEI: store/useBrandStore.ts
// ============================================================
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Brand } from '@/lib/types';

const INITIAL_BRANDS: Brand[] = [
  { id: '1', name: 'FC Hellas München',  slug: 'fc-hellas-muenchen',  color: '#D85A30', industry: 'Fußball',        aiTone: 'locker',        aiLanguage: 'de', platforms: ['facebook','instagram'],           createdAt: new Date().toISOString(), archived: false },
  { id: '2', name: 'GK Skill Systems',  slug: 'gk-skill-systems',   color: '#378ADD', industry: 'Training',       aiTone: 'motivierend',   aiLanguage: 'de', platforms: ['facebook','instagram','tiktok'],  createdAt: new Date().toISOString(), archived: false },
  { id: '3', name: 'GK Pokale',         slug: 'gk-pokale',          color: '#639922', industry: 'E-Commerce',     aiTone: 'professionell', aiLanguage: 'de', platforms: ['facebook','instagram'],           createdAt: new Date().toISOString(), archived: false },
  { id: '4', name: 'GK Software',       slug: 'gk-software',        color: '#7F77DD', industry: 'Software',       aiTone: 'professionell', aiLanguage: 'de', platforms: ['facebook'],                       createdAt: new Date().toISOString(), archived: false },
  { id: '5', name: 'GK Sports Group',   slug: 'gk-sports-group',    color: '#BA7517', industry: 'Sport',          aiTone: 'motivierend',   aiLanguage: 'de', platforms: ['facebook','instagram'],           createdAt: new Date().toISOString(), archived: false },
  { id: '6', name: 'Georgios Kitsios',  slug: 'georgios-kitsios',   color: '#1D9E75', industry: 'Personal Brand', aiTone: 'professionell', aiLanguage: 'de', platforms: ['facebook','instagram','tiktok'],  createdAt: new Date().toISOString(), archived: false },
];

interface BrandStore {
  brands: Brand[];
  activeBrandId: string | null;
  activeBrand: () => Brand | null;
  setActiveBrand: (id: string) => void;
  addBrand: (brand: Omit<Brand, 'id' | 'createdAt' | 'archived'>) => void;
  updateBrand: (id: string, updates: Partial<Brand>) => void;
  archiveBrand: (id: string) => void;
}

export const useBrandStore = create<BrandStore>()(
  persist(
    (set, get) => ({
      brands: INITIAL_BRANDS,
      activeBrandId: INITIAL_BRANDS[0].id,
      activeBrand: () => {
        const { brands, activeBrandId } = get();
        return brands.find(b => b.id === activeBrandId) ?? null;
      },
      setActiveBrand: (id) => set({ activeBrandId: id }),
      addBrand: (data) => {
        const newBrand: Brand = { ...data, id: crypto.randomUUID(), createdAt: new Date().toISOString(), archived: false };
        set(s => ({ brands: [...s.brands, newBrand] }));
      },
      updateBrand: (id, updates) =>
        set(s => ({ brands: s.brands.map(b => b.id === id ? { ...b, ...updates } : b) })),
      archiveBrand: (id) =>
        set(s => ({ brands: s.brands.map(b => b.id === id ? { ...b, archived: true } : b) })),
    }),
    { name: 'gk-brand-store' }
  )
);

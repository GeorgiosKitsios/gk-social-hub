DATEI: store/useTemplateStore.ts
// ============================================================
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Template, TemplateType } from '@/lib/types';

const INITIAL_TEMPLATES: Template[] = [
  { id: 't1', scope: 'global', type: 'footer',      name: 'Standard-Footer',      content: '📍 München · 🌐 gk-sports.de · Folge uns für mehr!', platforms: ['facebook','instagram','tiktok'], createdAt: new Date().toISOString() },
  { id: 't2', scope: 'global', type: 'footer',      name: 'Footer Kurz',           content: '🌐 gk-sports.de', platforms: ['facebook','instagram','tiktok'], createdAt: new Date().toISOString() },
  { id: 't3', scope: 'global', type: 'cta',         name: 'Link in Bio',           content: '👉 Link in der Bio für mehr Infos!', platforms: ['instagram'], createdAt: new Date().toISOString() },
  { id: 't4', scope: 'global', type: 'cta',         name: 'Kommentar CTA',         content: '💬 Schreib uns deine Meinung in die Kommentare!', platforms: ['facebook','instagram'], createdAt: new Date().toISOString() },
  { id: 't5', brandId: '1', scope: 'brand', type: 'hashtag_set', name: 'FC Hellas – Standard', content: '#FCHellasMünchen #Fußball #München #Kreisliga #GrünwalderStadion', platforms: ['facebook','instagram'], createdAt: new Date().toISOString() },
  { id: 't6', brandId: '1', scope: 'brand', type: 'hashtag_set', name: 'FC Hellas – Spieltag', content: '#Spieltag #FCHellas #Matchday #Fußball #München #UltrasHellas', platforms: ['facebook','instagram'], createdAt: new Date().toISOString() },
  { id: 't7', brandId: '1', scope: 'brand', type: 'text',        name: 'Spieltag-Ankündigung', content: 'Samstag ist Spieltag! 🔴⚪\nWir empfangen [Gegner] im [Stadion].\nAnstoß um [Uhrzeit] Uhr. Kommt zahlreich!', platforms: ['facebook','instagram'], createdAt: new Date().toISOString() },
  { id: 't8', brandId: '1', scope: 'brand', type: 'footer',      name: 'Footer Aggressiv',     content: 'Nur für echte Fans. Wer wir sind – das zeigen wir auf dem Platz. 🔴⚪', platforms: ['facebook','instagram'], createdAt: new Date().toISOString() },
  { id: 't9', brandId: '2', scope: 'brand', type: 'hashtag_set', name: 'GK Skill – Standard',  content: '#GKSkillSystems #Torwarttraining #Goalkeeper #Training #Fußball', platforms: ['facebook','instagram','tiktok'], createdAt: new Date().toISOString() },
  { id: 't10', brandId: '2', scope: 'brand', type: 'text',       name: 'Neues Video',          content: '🎬 Neues Video ist live!\n[Beschreibung]\n\n👉 Jetzt ansehen – Link in der Bio!', platforms: ['instagram','tiktok'], createdAt: new Date().toISOString() },
];

interface TemplateStore {
  templates: Template[];
  getTemplatesForBrand: (brandId: string) => Template[];
  getGlobalTemplates: () => Template[];
  getByType: (templates: Template[], type: TemplateType) => Template[];
  addTemplate: (t: Omit<Template, 'id' | 'createdAt'>) => void;
  updateTemplate: (id: string, updates: Partial<Template>) => void;
  deleteTemplate: (id: string) => void;
}

export const useTemplateStore = create<TemplateStore>()(
  persist(
    (set, get) => ({
      templates: INITIAL_TEMPLATES,
      getTemplatesForBrand: (brandId) => get().templates.filter(t => t.scope === 'global' || t.brandId === brandId),
      getGlobalTemplates: () => get().templates.filter(t => t.scope === 'global'),
      getByType: (templates, type) => templates.filter(t => t.type === type),
      addTemplate: (data) => {
        const t: Template = { ...data, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
        set(s => ({ templates: [...s.templates, t] }));
      },
      updateTemplate: (id, updates) =>
        set(s => ({ templates: s.templates.map(t => t.id === id ? { ...t, ...updates } : t) })),
      deleteTemplate: (id) =>
        set(s => ({ templates: s.templates.filter(t => t.id !== id) })),
    }),
    { name: 'gk-template-store' }
  )
);

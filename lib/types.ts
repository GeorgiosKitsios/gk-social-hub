// ============================================================
// DATEI: lib/types.ts
// ============================================================
export type Platform = 'facebook' | 'instagram' | 'tiktok';

export type BrandColor = string;

export type AiTone = 'professionell' | 'locker' | 'motivierend' | 'aggressiv';

export interface Brand {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string;
  color: BrandColor;
  industry: string;
  aiTone: AiTone;
  aiLanguage: 'de' | 'en';
  platforms: Platform[];
  createdAt: string;
  archived: boolean;
}

export type PostStatus = 'draft' | 'scheduled' | 'published' | 'error';
export type PlatformStatus = 'pending' | 'published' | 'error';

export interface Post {
  id: string;
  brandId: string;
  title: string;
  mainText: string;
  platformTexts: Partial<Record<Platform, string>>;
  mediaIds: string[];
  previewImage?: string;
  platforms: Platform[];
  platformStatus: Partial<Record<Platform, PlatformStatus>>;
  scheduledAt?: string;
  publishedAt?: string;
  status: PostStatus;
  errorMessage?: string;
  templateIds: string[];
  hashtagSetId?: string;
  notes: string;
  boardColumn?: string;
  createdAt: string;
  updatedAt: string;
}

export type TemplateType = 'footer' | 'hashtag_set' | 'text' | 'cta';
export type TemplateScope = 'global' | 'brand';

export interface Template {
  id: string;
  brandId?: string;
  scope: TemplateScope;
  type: TemplateType;
  name: string;
  content: string;
  platforms: Platform[];
  createdAt: string;
}

export interface Media {
  id: string;
  brandId: string;
  type: 'image' | 'video';
  filename: string;
  url: string;
  thumbnailUrl: string;
  sizeBytes: number;
  tags: string[];
  aiPrompt?: string;
  aiSuggestions?: {
    texts: string[];
    hooks: string[];
    hashtags: string[];
  };
  uploadedAt: string;
}


// ============================================================
// DATEI: lib/aiService.ts
// ============================================================
import Anthropic from '@anthropic-ai/sdk';

export type AiMode = 'text' | 'variants' | 'hooks' | 'hashtags';
export type { AiTone } from './types';

export interface AiRequest {
  prompt:    string;
  mode:      AiMode;
  tone:      AiTone;
  brand:     string;
  platforms: string[];
  language?: string;
}

export interface AiResult {
  mode:  AiMode;
  items: string[];
}

function toneInstruction(tone: AiTone): string {
  const map: Record<AiTone, string> = {
    professionell: 'Schreibe sachlich, klar und professionell.',
    locker:        'Schreibe locker, freundlich und nahbar.',
    motivierend:   'Schreibe energetisch, motivierend und inspirierend.',
    aggressiv:     'Schreibe direkt, selbstbewusst und provokativ.',
  };
  return map[tone];
}

function platformHints(platforms: string[]): string {
  const hints: Record<string, string> = {
    instagram: 'Instagram: max. 2200 Zeichen, Emojis erwünscht',
    facebook:  'Facebook: etwas ausführlicher erlaubt, persönlicher Ton',
    tiktok:    'TikTok: sehr kurz, Hook am Anfang, jugendliche Sprache',
  };
  return platforms.map(p => hints[p]).filter(Boolean).join(' · ') || '';
}

function buildPrompt(req: AiRequest): string {
  const lang    = req.language ?? 'de';
  const langStr = lang === 'de' ? 'Deutsch' : 'English';
  const tone    = toneInstruction(req.tone);
  const plat    = platformHints(req.platforms);

  const base = [
    `Du bist ein Social-Media-Texter für die Marke "${req.brand}".`,
    tone,
    plat ? `Plattform-Hinweise: ${plat}` : '',
    `Sprache: ${langStr}.`,
    `Thema / Kontext: ${req.prompt}`,
    'Antworte NUR mit dem angeforderten Inhalt, ohne Einleitung oder Erklärung.',
  ].filter(Boolean).join('\n');

  const instructions: Record<AiMode, string> = {
    text:     `${base}\n\nErstelle einen fertig verwendbaren Social-Media-Post-Text (1–4 Absätze, mit passenden Emojis).`,
    variants: `${base}\n\nErstelle genau 3 verschiedene Post-Text-Varianten.\nTrenne sie mit einer Leerzeile und "---".\nJede Variante soll einen anderen Ansatz haben.`,
    hooks:    `${base}\n\nErstelle genau 5 starke Hook-Sätze.\nEinen Hook pro Zeile, nummeriert 1–5. Keine weiteren Erklärungen.`,
    hashtags: `${base}\n\nErstelle 15–20 passende Hashtags.\nNur die Hashtags, mit # davor, durch Leerzeichen getrennt.`,
  };

  return instructions[req.mode];
}

function parseResponse(mode: AiMode, raw: string): string[] {
  const text = raw.trim();
  if (mode === 'text')     return [text];
  if (mode === 'variants') return text.split(/\n---\n|^---$/m).map(s => s.trim()).filter(Boolean);
  if (mode === 'hooks')    return text.split('\n').map(l => l.replace(/^\d+\.\s*/, '').trim()).filter(Boolean);
  if (mode === 'hashtags') return text.split(/[\s,]+/).map(t => t.trim()).filter(t => t.startsWith('#') && t.length > 1);
  return [text];
}

export async function generateAiContent(req: AiRequest): Promise<AiResult> {
  const apiKey = process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('Kein API-Key. Bitte NEXT_PUBLIC_ANTHROPIC_API_KEY in .env.local setzen.');

  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
  const message = await client.messages.create({
    model:      'claude-sonnet-4-20250514',
    max_tokens: 1024,
    messages:   [{ role: 'user', content: buildPrompt(req) }],
  });

  const raw = message.content
    .filter(b => b.type === 'text')
    .map(b => (b as { type: 'text'; text: string }).text)
    .join('\n');

  return { mode: req.mode, items: parseResponse(req.mode, raw) };
}


// ============================================================
// DATEI: store/useBrandStore.ts
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


// ============================================================
// DATEI: store/usePostStore.ts
// ============================================================
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Post, PostStatus } from '@/lib/types';

const INITIAL_POSTS: Post[] = [
  {
    id: 'p1', brandId: '1', title: 'Spieltagsankündigung – Samstag 15:00',
    mainText: 'Samstag ist Spieltag! 🔴⚪\nWir empfangen den TSV Neuried im Grünwalder Stadion.\nAnstoß um 15:00 Uhr. Kommt zahlreich!',
    platformTexts: {}, mediaIds: [], platforms: ['facebook','instagram'],
    platformStatus: { facebook: 'pending', instagram: 'pending' },
    scheduledAt: new Date(Date.now() + 86400000).toISOString(),
    status: 'scheduled', templateIds: [], notes: '',
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  },
  {
    id: 'p2', brandId: '2', title: 'Neues Trainingsvideo',
    mainText: '🎬 Neues Video ist live!\nDiese Woche: Reaktionsschulung für Torhüter.\n\n👉 Jetzt ansehen – Link in der Bio!',
    platformTexts: {}, mediaIds: [], platforms: ['instagram','tiktok'],
    platformStatus: { instagram: 'published', tiktok: 'published' },
    publishedAt: new Date().toISOString(),
    status: 'published', templateIds: [], notes: '',
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  },
  {
    id: 'p3', brandId: '1', title: 'Vereinsnews Q2',
    mainText: '', platformTexts: {}, mediaIds: [], platforms: ['facebook'],
    platformStatus: {}, status: 'draft', templateIds: [],
    notes: 'Noch auf Infos vom Vorstand warten.',
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  },
];

interface PostStore {
  posts: Post[];
  getPostsByBrand:  (brandId: string) => Post[];
  getPostById:      (id: string) => Post | undefined;
  addPost:    (p: Omit<Post, 'id' | 'createdAt' | 'updatedAt'>) => string;
  updatePost: (id: string, updates: Partial<Post>) => void;
  deletePost: (id: string) => void;
  simulatePublish: (id: string) => void;
}

export const usePostStore = create<PostStore>()(
  persist(
    (set, get) => ({
      posts: INITIAL_POSTS,
      getPostsByBrand: (brandId) => get().posts.filter(p => p.brandId === brandId),
      getPostById: (id) => get().posts.find(p => p.id === id),
      addPost: (data) => {
        const id = crypto.randomUUID();
        const now = new Date().toISOString();
        set(s => ({ posts: [...s.posts, { ...data, id, createdAt: now, updatedAt: now }] }));
        return id;
      },
      updatePost: (id, updates) =>
        set(s => ({ posts: s.posts.map(p => p.id === id ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p) })),
      deletePost: (id) =>
        set(s => ({ posts: s.posts.filter(p => p.id !== id) })),
      simulatePublish: (id) => {
        const post = get().posts.find(p => p.id === id);
        if (!post) return;
        const platformStatus = Object.fromEntries(post.platforms.map(pl => [pl, 'published'])) as Post['platformStatus'];
        set(s => ({
          posts: s.posts.map(p => p.id === id
            ? { ...p, status: 'published', platformStatus, publishedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
            : p
          ),
        }));
      },
    }),
    { name: 'gk-post-store' }
  )
);


// ============================================================
// DATEI: store/useTemplateStore.ts
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


// ============================================================
// DATEI: store/useMediaStore.ts
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

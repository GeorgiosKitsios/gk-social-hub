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

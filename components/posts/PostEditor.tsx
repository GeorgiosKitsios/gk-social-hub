'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { usePostStore }     from '@/store/usePostStore';
import { useTemplateStore } from '@/store/useTemplateStore';
import { useBrandStore }    from '@/store/useBrandStore';
import { useMediaStore }    from '@/store/useMediaStore';
import { Post, Platform, PostStatus, TemplateType } from '@/lib/types';
import MediaPicker           from '@/components/media/MediaPicker';
import AiAssistant           from '@/components/posts/AiAssistant';
import FacebookPublishButton from '@/components/posts/FacebookPublishButton';

const PLATFORMS: { value: Platform; label: string }[] = [
  { value: 'facebook',  label: 'Facebook'  },
  { value: 'instagram', label: 'Instagram' },
  { value: 'tiktok',    label: 'TikTok'    },
];

const STATUS_OPTS: { value: PostStatus; label: string }[] = [
  { value: 'draft',     label: 'Entwurf'  },
  { value: 'scheduled', label: 'Geplant'  },
  { value: 'published', label: 'Gepostet' },
  { value: 'error',     label: 'Fehler'   },
];

const STATUS_STYLE: Record<PostStatus, string> = {
  draft:     'bg-neutral-700 text-neutral-300',
  scheduled: 'bg-blue-500/20 text-blue-400',
  published: 'bg-green-500/20 text-green-400',
  error:     'bg-red-500/20 text-red-400',
};

const TEMPLATE_TABS: { value: TemplateType; label: string }[] = [
  { value: 'footer',      label: 'Footer'   },
  { value: 'hashtag_set', label: 'Hashtags' },
  { value: 'text',        label: 'Texte'    },
  { value: 'cta',         label: 'CTAs'     },
];

function emptyForm(brandId: string): Omit<Post, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    brandId,
    title: '', mainText: '', platformTexts: {}, mediaIds: [],
    platforms: ['facebook', 'instagram'], platformStatus: {},
    status: 'draft', templateIds: [], notes: '', tags: [],
  };
}

function PlatformPreview({
  platform, text, brandName, brandColor, mediaUrl,
}: {
  platform: Platform;
  text: string;
  brandName: string;
  brandColor: string;
  mediaUrl?: string;
}) {
  const isEmpty    = !text.trim();
  const display    = isEmpty ? 'Post-Text erscheint hier …' : text;
  const hashtags   = text.match(/#[\wÄäÖöÜüß]+/g) ?? [];
  const cleanText  = text.replace(/#[\wÄäÖöÜüß]+/g, '').trim();
  const initial    = brandName.charAt(0).toUpperCase();

  if (platform === 'facebook') {
    return (
      <div className="bg-white rounded-xl overflow-hidden shadow-lg text-black w-full max-w-xs mx-auto">
        <div className="h-1" style={{ backgroundColor: '#1877F2' }} />
        <div className="p-3">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
              style={{ backgroundColor: brandColor }}>{initial}</div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-gray-900 leading-tight truncate">{brandName}</div>
              <div className="text-xs text-gray-400">Jetzt · 🌐</div>
            </div>
            <span className="text-gray-400 text-lg leading-none">···</span>
          </div>
          <p className={`text-sm leading-relaxed whitespace-pre-wrap mb-3 ${isEmpty ? 'text-gray-300 italic' : 'text-gray-800'}`}>
            {display}
          </p>
          {mediaUrl && <img src={mediaUrl} alt="" className="w-full rounded-lg object-cover max-h-48" />}
          <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-100 text-xs text-gray-400">
            <span>👍 Gefällt mir</span>
            <span>💬 Kommentieren</span>
            <span>↗ Teilen</span>
          </div>
        </div>
      </div>
    );
  }

  if (platform === 'instagram') {
    return (
      <div className="bg-white rounded-xl overflow-hidden shadow-lg text-black w-full max-w-xs mx-auto">
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full p-0.5 shrink-0"
              style={{ background: 'linear-gradient(45deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)' }}>
              <div className="w-full h-full rounded-full flex items-center justify-center text-white text-xs font-bold"
                style={{ backgroundColor: brandColor }}>{initial}</div>
            </div>
            <span className="text-sm font-semibold text-gray-900 truncate">{brandName}</span>
          </div>
          <span className="text-gray-400 text-lg leading-none shrink-0">···</span>
        </div>
        {mediaUrl
          ? <img src={mediaUrl} alt="" className="w-full aspect-square object-cover" />
          : <div className="w-full aspect-square bg-gray-100 flex items-center justify-center text-gray-300 text-5xl">⊡</div>
        }
        <div className="px-3 pt-2 pb-1 flex gap-3 text-xl">
          <span>🤍</span><span>💬</span><span>↗</span>
          <span className="ml-auto">🔖</span>
        </div>
        <div className="px-3 pb-3">
          <p className={`text-sm leading-relaxed ${isEmpty ? 'text-gray-300 italic' : 'text-gray-800'}`}>
            {isEmpty
              ? display
              : <><span className="font-semibold">{brandName} </span>{hashtags.length > 0 ? cleanText : text}</>
            }
          </p>
          {hashtags.length > 0 && (
            <p className="text-sm mt-1 flex flex-wrap gap-x-1">
              {hashtags.map((h, i) => <span key={i} className="text-purple-500">{h}</span>)}
            </p>
          )}
        </div>
      </div>
    );
  }

  /* TikTok */
  return (
    <div className="bg-black rounded-xl overflow-hidden shadow-lg mx-auto w-40" style={{ aspectRatio: '9/16' }}>
      <div className="relative w-full h-full">
        {mediaUrl
          ? <img src={mediaUrl} alt="" className="absolute inset-0 w-full h-full object-cover opacity-60" />
          : <div className="absolute inset-0 bg-gradient-to-b from-neutral-800 to-black" />
        }
        <div className="absolute right-2 bottom-16 flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-white flex items-center justify-center text-white text-xs font-bold shrink-0"
            style={{ backgroundColor: brandColor }}>{initial}</div>
          <span className="text-lg">❤️</span>
          <span className="text-lg">💬</span>
          <span className="text-lg">↗</span>
        </div>
        <div className="absolute bottom-0 left-0 right-12 p-3">
          <p className="text-white text-xs font-semibold mb-1 truncate">
            @{brandName.toLowerCase().replace(/\s+/g, '_')}
          </p>
          <p className={`text-xs leading-relaxed line-clamp-4 ${isEmpty ? 'text-white/30 italic' : 'text-white'}`}>
            {display}
          </p>
        </div>
      </div>
    </div>
  );
}

interface Props { postId?: string; presetDate?: string; }

export default function PostEditor({ postId, presetDate }: Props) {
  const router = useRouter();
  const { addPost, updatePost, getPostById, simulatePublish, deletePost } = usePostStore();
  const { getTemplatesForBrand, getByType } = useTemplateStore();
  const { activeBrandId, activeBrand, brands } = useBrandStore();
  const { getById: getMediaById } = useMediaStore();

  const isNew   = !postId;
  const brand   = activeBrand();
  const brandId = activeBrandId ?? brands.filter(b => !b.archived)[0]?.id ?? '';

  const [form, setForm]           = useState(emptyForm(brandId));
  const [scheduledDate, setDate]  = useState('');
  const [scheduledTime, setTime]  = useState('09:00');
  const [saved, setSaved]         = useState(false);
  const [confirmDelete, setConfirm] = useState(false);
  const [templateTab, setTemplateTab]     = useState<TemplateType>('footer');
  const [templateOpen, setTemplateOpen]   = useState(false);
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
  const [platformMode, setPlatformMode]   = useState(false);
  const [tagInput, setTagInput]           = useState('');
  const [previewPlatform, setPreviewPlatform] = useState<Platform>('facebook');
  const activePrev: Platform = form.platforms.includes(previewPlatform)
    ? previewPlatform
    : (form.platforms[0] ?? 'facebook');

  useEffect(() => {
    if (!isNew && postId) {
      const p = getPostById(postId);
      if (p) {
        setForm(p);
        if (p.scheduledAt) {
          const d = new Date(p.scheduledAt);
          setDate(d.toISOString().slice(0, 10));
          setTime(d.toTimeString().slice(0, 5));
        }
      }
    }
    if (isNew && presetDate) {
      setDate(presetDate);
      setForm(f => ({ ...f, status: 'scheduled' }));
    }
  }, [postId, presetDate]);

  if (!brandId) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-neutral-500">
        <div className="text-4xl">◈</div>
        <p className="text-sm">Keine Marke aktiv.</p>
        <a href="/brands" className="text-sm text-blue-400 hover:text-blue-300">Jetzt Marke anlegen →</a>
      </div>
    );
  }

  const templates    = getTemplatesForBrand(brandId);
  const tabTemplates = getByType(templates, templateTab);

  function togglePlatform(p: Platform) {
    setForm(f => ({
      ...f,
      platforms: f.platforms.includes(p) ? f.platforms.filter(x => x !== p) : [...f.platforms, p],
    }));
  }

  function insertTemplate(content: string, templateId: string) {
    setForm(f => ({
      ...f,
      mainText:    f.mainText ? `${f.mainText}\n\n${content}` : content,
      templateIds: f.templateIds.includes(templateId) ? f.templateIds : [...f.templateIds, templateId],
    }));
  }

  function buildScheduledAt() {
    if (!scheduledDate) return undefined;
    return new Date(`${scheduledDate}T${scheduledTime}`).toISOString();
  }

  function handleSave(newStatus?: PostStatus) {
    const payload = { ...form, brandId, status: newStatus ?? form.status, scheduledAt: buildScheduledAt() };
    if (isNew) {
      const id = addPost(payload);
      setSaved(true);
      setTimeout(() => router.push(`/posts/${id}`), 600);
    } else {
      updatePost(postId!, payload);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    }
  }

  function handleSimulate() {
    if (isNew) {
      const id = addPost({ ...form, brandId, scheduledAt: buildScheduledAt() });
      simulatePublish(id);
      router.push(`/posts/${id}`);
    } else {
      simulatePublish(postId!);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    }
  }

  function handleDelete() {
    if (confirmDelete && !isNew) { deletePost(postId!); router.push('/posts'); }
    else setConfirm(true);
  }

  return (
    // Outer: volle Höhe, kein overflow
    <div className="flex flex-col" style={{ height: '100%' }}>

      {/* ── Topbar ── */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-neutral-800 bg-neutral-950 sticky top-0 z-10 flex-wrap shrink-0">
        <button onClick={() => router.push('/posts')} className="text-neutral-400 hover:text-white text-sm transition-colors">← Posts</button>
        <div className="w-px h-4 bg-neutral-700" />
        {brand && (
          <div className="text-xs px-2 py-1 rounded-full font-medium" style={{ backgroundColor: `${brand.color}30`, color: brand.color }}>
            {brand.name}
          </div>
        )}
        <div className="flex-1" />
        <span className={`text-xs px-2 py-1 rounded-full ${STATUS_STYLE[form.status]}`}>
          {STATUS_OPTS.find(s => s.value === form.status)?.label}
        </span>
        {!isNew && (
          <button onClick={handleDelete} className={`text-xs px-3 py-1.5 rounded-md border transition-colors ${confirmDelete ? 'border-red-500 text-red-400' : 'border-neutral-700 text-neutral-500 hover:text-red-400 hover:border-red-500'}`}>
            {confirmDelete ? 'Wirklich löschen?' : 'Löschen'}
          </button>
        )}
        <button onClick={() => handleSave()} className="text-xs px-3 py-1.5 rounded-md border border-neutral-600 text-neutral-300 hover:text-white transition-colors">
          {saved ? '✓ Gespeichert' : 'Speichern'}
        </button>
        <button onClick={handleSimulate} className="text-xs px-3 py-1.5 rounded-md border border-blue-600 text-blue-400 hover:bg-blue-600 hover:text-white transition-colors">
          ▸ Simulieren
        </button>
        <button onClick={() => handleSave('scheduled')} className="text-xs px-4 py-1.5 rounded-md bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors">
          Planen →
        </button>
      </div>

      {/* Facebook Button */}
      {form.platforms.includes('facebook') && (
        <div className="px-4 py-2 border-b border-neutral-800 bg-neutral-950 shrink-0">
          <FacebookPublishButton
            message={form.mainText}
            mediaIds={form.mediaIds}
            onSuccess={() => handleSave('published')}
            onError={(e) => console.error(e)}
          />
        </div>
      )}

      {/* ── Scrollbarer Hauptbereich ── */}
      <div className="flex-1 overflow-y-auto">
        <div className="flex flex-col xl:flex-row min-h-full">

          {/* Linke Spalte – Hauptinhalt */}
          <div className="flex-1 p-4 flex flex-col gap-4">

            {/* Titel */}
            <div>
              <label className="block text-xs text-neutral-400 mb-1">Interner Titel</label>
              <input
                type="text"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="z. B. Spieltagsankündigung – 19. April"
                className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Plattformen */}
            <div>
              <label className="block text-xs text-neutral-400 mb-2">Plattformen</label>
              <div className="flex gap-2">
                {PLATFORMS.map(p => (
                  <button key={p.value} onClick={() => togglePlatform(p.value)}
                    className={`flex-1 py-1.5 text-xs rounded-md border transition-colors ${form.platforms.includes(p.value) ? 'border-blue-500 bg-blue-500/10 text-blue-400' : 'border-neutral-700 text-neutral-400 hover:border-neutral-500'}`}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Haupttext */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-neutral-400">Haupttext</label>
                <button onClick={() => setPlatformMode(m => !m)} className="text-xs text-neutral-500 hover:text-blue-400 transition-colors">
                  {platformMode ? '– Plattform-Texte ausblenden' : '+ Plattform-spezifische Texte'}
                </button>
              </div>
              <textarea
                value={form.mainText}
                onChange={e => setForm(f => ({ ...f, mainText: e.target.value }))}
                rows={6}
                placeholder="Post-Text eingeben..."
                className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-blue-500 resize-none"
              />
              <div className="text-xs text-neutral-600 mt-1 text-right">{form.mainText.length} Zeichen</div>
            </div>

            {/* Plattform-spezifische Texte */}
            {platformMode && form.platforms.map(p => (
              <div key={p}>
                <label className="block text-xs text-neutral-400 mb-1">
                  Text für {PLATFORMS.find(pl => pl.value === p)?.label}
                  <span className="text-neutral-600 ml-1">(überschreibt Haupttext)</span>
                </label>
                <textarea
                  value={form.platformTexts[p] ?? ''}
                  onChange={e => setForm(f => ({ ...f, platformTexts: { ...f.platformTexts, [p]: e.target.value } }))}
                  rows={3}
                  placeholder={`Text für ${p}...`}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>
            ))}

            {/* Medien */}
            <div>
              <label className="block text-xs text-neutral-400 mb-2">Medien</label>
              {form.mediaIds.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {form.mediaIds.map(mid => {
                    const m = getMediaById(mid);
                    if (!m) return null;
                    return (
                      <div key={mid} className="relative group w-16 h-16 rounded-lg overflow-hidden border border-neutral-700">
                        {m.type === 'image'
                          ? <img src={m.url} alt={m.filename} className="w-full h-full object-cover" />
                          : <div className="w-full h-full bg-neutral-800 flex items-center justify-center text-neutral-500 text-xs">▶</div>
                        }
                        <button
                          onClick={() => setForm(f => ({ ...f, mediaIds: f.mediaIds.filter(x => x !== mid) }))}
                          className="absolute top-0.5 right-0.5 w-4 h-4 bg-black/70 rounded-full text-white text-xs hidden group-hover:flex items-center justify-center"
                        >×</button>
                      </div>
                    );
                  })}
                </div>
              )}
              <button
                onClick={() => setMediaPickerOpen(true)}
                className="w-full py-2 text-xs rounded-lg border border-dashed border-neutral-600 text-neutral-400 hover:text-white hover:border-neutral-400 transition-colors"
              >
                {form.mediaIds.length > 0 ? '+ Weitere Medien' : '⊡ Medien auswählen'}
              </button>
            </div>

            {/* ── Vorlagen ── */}
            <div className="border border-neutral-700 rounded-xl overflow-hidden">
              <button
                onClick={() => setTemplateOpen(o => !o)}
                className="w-full flex items-center justify-between px-4 py-3 bg-neutral-800 text-sm text-neutral-300 hover:text-white transition-colors"
              >
                <span>⊟ Vorlagen einfügen</span>
                <span className="text-neutral-500">{templateOpen ? '▲' : '▼'}</span>
              </button>
              {templateOpen && (
                <div className="bg-neutral-900 p-4">
                  {/* Tabs */}
                  <div className="flex gap-2 mb-4 flex-wrap">
                    {TEMPLATE_TABS.map(t => (
                      <button key={t.value} onClick={() => setTemplateTab(t.value)}
                        className={`px-4 py-2 text-sm rounded-lg transition-colors ${templateTab === t.value ? 'bg-neutral-700 text-white' : 'text-neutral-500 hover:text-white bg-neutral-800'}`}>
                        {t.label}
                      </button>
                    ))}
                  </div>
                  {/* Vorlagen-Liste – kein max-height, scrollt mit der Seite */}
                  <div className="flex flex-col gap-3">
                    {tabTemplates.length === 0 && (
                      <p className="text-sm text-neutral-600 text-center py-4">Keine Vorlagen für diesen Typ.</p>
                    )}
                    {tabTemplates.map(t => (
                      <div key={t.id} className="flex items-start gap-3 p-3 bg-neutral-800 rounded-lg">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-white mb-1">{t.name}</div>
                          <div className="text-sm text-neutral-400 whitespace-pre-wrap">{t.content}</div>
                        </div>
                        <button
                          onClick={() => insertTemplate(t.content, t.id)}
                          className="text-sm px-3 py-1.5 rounded-lg border border-neutral-600 text-neutral-300 hover:text-white hover:border-blue-500 transition-colors shrink-0"
                        >
                          Einfügen
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ── KI-Assistent ── */}
            {brand && (
              <AiAssistant
                brandName={brand.name}
                tone={brand.aiTone}
                platforms={form.platforms}
                language={brand.aiLanguage}
                onInsert={text => setForm(f => ({ ...f, mainText: f.mainText ? `${f.mainText}\n\n${text}` : text }))}
              />
            )}

            {/* Tags */}
            <div>
              <label className="block text-xs text-neutral-400 mb-2">Tags</label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {(form.tags ?? []).map(tag => (
                  <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-violet-500/20 text-violet-300 border border-violet-500/30">
                    {tag}
                    <button
                      onClick={() => setForm(f => ({ ...f, tags: (f.tags ?? []).filter(t => t !== tag) }))}
                      className="hover:text-white leading-none"
                    >×</button>
                  </span>
                ))}
              </div>
              <input
                type="text"
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && tagInput.trim()) {
                    e.preventDefault();
                    const t = tagInput.trim();
                    if (!(form.tags ?? []).includes(t)) {
                      setForm(f => ({ ...f, tags: [...(f.tags ?? []), t] }));
                    }
                    setTagInput('');
                  }
                }}
                placeholder="Tag eingeben + Enter"
                className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-violet-500"
              />
            </div>

            {/* Notizen */}
            <div>
              <label className="block text-xs text-neutral-400 mb-1">Interne Notizen</label>
              <textarea
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                rows={2}
                placeholder="Nur intern sichtbar..."
                className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-blue-500 resize-none"
              />
            </div>

            {/* Abstand unten */}
            <div className="h-4" />
          </div>

          {/* ── Vorschau-Panel ── */}
          <div className="xl:w-80 shrink-0 xl:border-l border-t xl:border-t-0 border-neutral-800 bg-neutral-900/50 p-4 flex flex-col gap-3">
            {/* Header */}
            <div className="flex items-center justify-between shrink-0">
              <span className="text-xs text-neutral-400 font-medium">Vorschau</span>
              {form.platforms.length > 1 ? (
                <div className="flex gap-1 bg-neutral-800 rounded-md p-0.5">
                  {form.platforms.map(p => (
                    <button key={p} onClick={() => setPreviewPlatform(p)}
                      className={`px-2.5 py-1 text-xs rounded transition-colors ${activePrev === p ? 'bg-neutral-600 text-white' : 'text-neutral-500 hover:text-white'}`}>
                      {p === 'facebook' ? 'FB' : p === 'instagram' ? 'IG' : 'TK'}
                    </button>
                  ))}
                </div>
              ) : (
                <span className="text-xs text-neutral-500">
                  {activePrev === 'facebook' ? 'Facebook' : activePrev === 'instagram' ? 'Instagram' : 'TikTok'}
                </span>
              )}
            </div>
            {/* Preview card */}
            <div className="flex-1 overflow-y-auto">
              {form.platforms.length === 0
                ? <p className="text-xs text-neutral-600 text-center mt-8">Keine Plattform ausgewählt.</p>
                : <PlatformPreview
                    platform={activePrev}
                    text={form.platformTexts[activePrev] ?? form.mainText}
                    brandName={brand?.name ?? 'Marke'}
                    brandColor={brand?.color ?? '#378ADD'}
                    mediaUrl={form.mediaIds.length > 0 ? getMediaById(form.mediaIds[0])?.url : undefined}
                  />
              }
            </div>
          </div>

          {/* Rechte Spalte – Metadaten */}
          <div className="xl:w-56 shrink-0 xl:border-l border-t xl:border-t-0 border-neutral-800 bg-neutral-950 p-4 flex flex-col gap-4">

            {/* Status */}
            <div>
              <label className="block text-xs text-neutral-400 mb-2">Status</label>
              <div className="flex flex-col gap-1.5">
                {STATUS_OPTS.map(s => (
                  <button key={s.value} onClick={() => setForm(f => ({ ...f, status: s.value }))}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-md border text-xs transition-colors ${form.status === s.value ? 'border-blue-500 bg-blue-500/10 text-blue-400' : 'border-neutral-700 text-neutral-400 hover:border-neutral-500'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${STATUS_STYLE[s.value].split(' ')[0]}`} />
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="border-t border-neutral-800" />

            {/* Zeitplan */}
            <div>
              <label className="block text-xs text-neutral-400 mb-2">Veröffentlichungszeitpunkt</label>
              <input type="date" value={scheduledDate} onChange={e => setDate(e.target.value)}
                className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 mb-2" />
              <input type="time" value={scheduledTime} onChange={e => setTime(e.target.value)}
                className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500" />
              {scheduledDate && (
                <p className="text-xs text-neutral-500 mt-1.5">
                  {new Date(`${scheduledDate}T${scheduledTime}`).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </p>
              )}
            </div>

            <div className="border-t border-neutral-800" />

            {/* Verwendete Vorlagen */}
            {form.templateIds.length > 0 && (
              <div>
                <label className="block text-xs text-neutral-400 mb-2">Verwendete Vorlagen</label>
                <div className="flex flex-col gap-1">
                  {form.templateIds.map(tid => {
                    const tpl = templates.find(t => t.id === tid);
                    return tpl ? <div key={tid} className="text-xs text-neutral-500 flex items-center gap-1"><span>✓</span>{tpl.name}</div> : null;
                  })}
                </div>
              </div>
            )}

            <div className="border-t border-neutral-800" />

            {/* Plattform-Status */}
            {!isNew && form.platforms.length > 0 && (
              <div>
                <label className="block text-xs text-neutral-400 mb-2">Status je Plattform</label>
                {form.platforms.map(p => {
                  const ps = form.platformStatus?.[p] ?? 'pending';
                  return (
                    <div key={p} className="flex items-center justify-between py-1 text-xs">
                      <span className="text-neutral-400">{p === 'facebook' ? 'FB' : p === 'instagram' ? 'IG' : 'TK'}</span>
                      <span className={ps === 'published' ? 'text-green-400' : ps === 'error' ? 'text-red-400' : 'text-neutral-500'}>
                        {ps === 'published' ? '✓ Gepostet' : ps === 'error' ? '✕ Fehler' : '– Ausstehend'}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Media Picker */}
      {mediaPickerOpen && (
        <MediaPicker
          brandId={brandId}
          selectedIds={form.mediaIds}
          onConfirm={ids => setForm(f => ({ ...f, mediaIds: ids }))}
          onClose={() => setMediaPickerOpen(false)}
        />
      )}
    </div>
  );
}

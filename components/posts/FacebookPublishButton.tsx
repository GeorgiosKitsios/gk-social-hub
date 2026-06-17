'use client';

import { useState } from 'react';
import { useMediaStore } from '@/store/useMediaStore';

interface FacebookPage {
  id:           string;
  name:         string;
  access_token: string;
  tasks?:       string[];
  brand_id?:    string | null;
}

interface Props {
  message:           string;
  mediaIds?:         string[];
  brandId?:          string;
  validationErrors?: string[];
  onSuccess?:        (postId: string, pageName: string) => void;
  onError?:          (error: string) => void;
}

function loadPages(): FacebookPage[] {
  try {
    const raw = localStorage.getItem('gk-facebook-pages');
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

/** Eine Page kann nur bespielt werden, wenn der Nutzer dort CREATE_CONTENT darf.
 *  Ältere Verbindungen ohne tasks-Info gelten als unbekannt (true). */
function canPost(page: FacebookPage): boolean {
  if (!page.tasks) return true;
  return page.tasks.includes('CREATE_CONTENT');
}

/** Erkennt Berechtigungs-/Token-Fehler von Facebook, bei denen ein
 *  Neu-Verbinden der Seite hilft (publish_actions, fehlende Rechte usw.). */
function isPermissionError(err?: string): boolean {
  if (!err) return false;
  const e = err.toLowerCase();
  return (
    e.includes('publish_actions') ||
    e.includes('permission')      ||
    e.includes('deprecated')      ||
    e.includes('(#200)')          ||
    e.includes('(#10)')           ||
    e.includes('(#190)')
  );
}

type PostVariant = 'text' | 'image' | 'video_feed' | 'video_reel';
type PostMode    = 'feed' | 'story';

export default function FacebookPublishButton({ message, mediaIds = [], brandId, validationErrors, onSuccess, onError }: Props) {
  const [loading,        setLoading]        = useState(false);
  const [postMode,       setPostMode]       = useState<PostMode>('feed');
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [results,        setResults]        = useState<{ page: string; success: boolean; error?: string }[]>([]);

  const { getById } = useMediaStore();
  const pages = loadPages();

  // Standardauswahl: nur Pages der aktiven Marke (wenn brandId gesetzt), andere sichtbar aber abgehakt.
  const [selected, setSelected] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const p of loadPages()) {
      const isBrandMatch = !brandId || p.brand_id === brandId;
      init[p.id] = isBrandMatch && canPost(p);
    }
    return init;
  });

  const firstMedia  = mediaIds.length > 0 ? getById(mediaIds[0]) : null;
  const imageBase64 = firstMedia?.type === 'image' ? firstMedia.url : undefined;
  const videoBase64 = firstMedia?.type === 'video' ? firstMedia.url : undefined;
  const isVideo     = !!videoBase64;

  const selectedPages = pages.filter(p => selected[p.id]);

  const internalErrors: string[] = pages.length === 0
    ? ['Keine Facebook-Seite verbunden.']
    : selectedPages.length === 0
    ? ['Keine Seite ausgewählt.']
    : postMode === 'story' && !imageBase64 && !videoBase64
    ? ['Facebook-Stories benötigen mindestens ein Bild oder Video.']
    : [];
  // Caption-Validierung ist für Stories irrelevant
  const externalErrors = postMode === 'story' ? [] : (validationErrors ?? []);
  const allErrors  = [...internalErrors, ...externalErrors];
  const canPublish = allErrors.length === 0;

  const hasPermissionError = results.some(r => !r.success && isPermissionError(r.error));

  function getDefaultVariant(): PostVariant {
    if (imageBase64) return 'image';
    if (videoBase64) return 'video_feed';
    return 'text';
  }

  function toggle(pageId: string) {
    setSelected(s => ({ ...s, [pageId]: !s[pageId] }));
  }

  async function publishToPage(page: FacebookPage, variant: PostVariant) {
    setLoading(true);
    try {
      // Story-Modus: eigene Route, kein Text, Medien erforderlich
      if (postMode === 'story') {
        const body: Record<string, unknown> = {
          pageId:    page.id,
          pageToken: page.access_token,
        };
        if (imageBase64) body.imageBase64 = imageBase64;
        if (videoBase64) body.videoBase64 = videoBase64;

        const res  = await fetch('/api/facebook/story', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify(body),
        });
        const data = await res.json();

        if (data.success) {
          setResults(r => [...r, { page: page.name, success: true }]);
          onSuccess?.(data.postId, page.name);
        } else {
          setResults(r => [...r, { page: page.name, success: false, error: data.error }]);
          onError?.(data.error);
        }
        return;
      }

      // Feed-Modus (unverändert)
      let endpoint = '/api/facebook/upload';
      const body: Record<string, unknown> = {
        pageId:    page.id,
        pageToken: page.access_token,
        message,
      };

      if (variant === 'image') {
        body.imageBase64 = imageBase64;
      } else if (variant === 'video_feed' || variant === 'video_reel') {
        endpoint         = '/api/facebook/video';
        body.videoBase64 = videoBase64;
        body.postType    = variant === 'video_reel' ? 'reels' : 'feed';
      }

      const res  = await fetch(endpoint, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      });
      const data = await res.json();

      if (data.success) {
        setResults(r => [...r, { page: page.name, success: true }]);
        onSuccess?.(data.postId, page.name);
      } else {
        setResults(r => [...r, { page: page.name, success: false, error: data.error }]);
        onError?.(data.error);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Fehler';
      setResults(r => [...r, { page: page.name, success: false, error: msg }]);
      onError?.(msg);
    } finally {
      setLoading(false);
    }
  }

  async function publishSelected(variant: PostVariant) {
    setResults([]);
    setShowTypePicker(false);
    for (const page of selectedPages) {
      await publishToPage(page, variant);
    }
  }

  return (
    <div className="flex flex-col gap-2">

      {/* Medium-Info */}
      {firstMedia && (
        <div className="text-xs text-neutral-500 flex items-center gap-1.5">
          <span>{isVideo ? '🎬' : '🖼'}</span>
          <span>{isVideo ? 'Video wird mitgepostet' : 'Bild wird mitgepostet'}</span>
        </div>
      )}

      {/* Feed / Story Umschalter */}
      {pages.length > 0 && (
        <div className="flex gap-1 bg-neutral-900 rounded-lg p-0.5 border border-neutral-700">
          {(['feed', 'story'] as PostMode[]).map(m => (
            <button
              key={m}
              onClick={() => { setPostMode(m); setShowTypePicker(false); setResults([]); }}
              disabled={loading}
              className={`flex-1 text-xs py-1.5 rounded-md transition-colors ${
                postMode === m ? 'bg-neutral-700 text-white' : 'text-neutral-400 hover:text-white'
              }`}>
              {m === 'feed' ? '📰 Feed-Post' : '⊕ Story'}
            </button>
          ))}
        </div>
      )}
      {postMode === 'story' && (
        <p className="text-[11px] text-neutral-500">
          Story: nur Bild/Video, kein Text (Facebook zeigt keinen Caption-Text in Stories an).
        </p>
      )}

      {/* Page-Auswahl per Checkbox */}
      {pages.length > 0 && (
        <div className="flex flex-col gap-1 p-2 bg-neutral-900 rounded-lg border border-neutral-700">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-neutral-400 font-medium">Seiten auswählen</span>
            <div className="flex gap-2">
              <button
                onClick={() => setSelected(Object.fromEntries(pages.map(p => [p.id, true])))}
                disabled={loading}
                className="text-[11px] text-neutral-500 hover:text-white transition-colors">
                Alle
              </button>
              <button
                onClick={() => setSelected(Object.fromEntries(pages.map(p => [p.id, false])))}
                disabled={loading}
                className="text-[11px] text-neutral-500 hover:text-white transition-colors">
                Keine
              </button>
            </div>
          </div>
          {pages.map(page => {
            const postable = canPost(page);
            return (
              <label
                key={page.id}
                className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-neutral-800/60 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!selected[page.id]}
                  onChange={() => toggle(page.id)}
                  disabled={loading}
                  className="accent-green-600"
                />
                <span className="text-xs text-neutral-300 flex items-center gap-1.5">
                  📘 {page.name}
                  {!postable && (
                    <span className="text-[10px] px-1 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/20">
                      ⚠ kein Posting-Recht
                    </span>
                  )}
                </span>
              </label>
            );
          })}
        </div>
      )}

      {/* Ergebnisse */}
      {results.length > 0 && (
        <div className="flex flex-col gap-1">
          {results.map((r, i) => (
            <div key={i} className={`text-xs px-2 py-1 rounded flex items-center gap-1.5 ${
              r.success ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
            }`}>
              <span>{r.success ? '✓' : '✕'}</span>
              <span>{r.page}: {r.success ? 'Veröffentlicht' : r.error}</span>
            </div>
          ))}
          {hasPermissionError && (
            <a href="/accounts" className="text-xs text-blue-400 hover:text-blue-300 transition-colors mt-0.5">
              → Seite neu verbinden &amp; Posting-Recht freigeben
            </a>
          )}
        </div>
      )}

      {/* Buttons */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => {
            if (postMode === 'story') {
              publishSelected(getDefaultVariant());
            } else {
              isVideo ? setShowTypePicker(o => !o) : publishSelected(getDefaultVariant());
            }
          }}
          disabled={loading || !canPublish}
          className={`flex-1 text-xs py-2 rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5 text-white ${
            canPublish && !loading ? 'bg-green-600 hover:bg-green-500' : 'bg-neutral-700'
          }`}
        >
          {loading
            ? <><div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" /> Wird gepostet...</>
            : postMode === 'story'
            ? <>⊕ Story auf {selectedPages.length} {selectedPages.length === 1 ? 'Seite' : 'Seiten'}</>
            : isVideo
            ? <>🎬 Video posten ({selectedPages.length}) ▾</>
            : <>📘 Auf {selectedPages.length} {selectedPages.length === 1 ? 'Seite' : 'Seiten'} posten</>
          }
        </button>
      </div>

      {/* Validierungsfehler */}
      {allErrors.length > 0 && (
        <div className="flex flex-col gap-1">
          {allErrors.map((err, i) => (
            <p key={i} className="text-xs text-red-400 flex items-start gap-1">
              <span className="shrink-0 mt-px">✕</span>
              <span>{err}</span>
            </p>
          ))}
          {pages.length === 0 && (
            <a href="/accounts" className="text-xs text-blue-400 hover:text-blue-300 transition-colors mt-0.5">
              → Jetzt Facebook-Seite verbinden
            </a>
          )}
        </div>
      )}

      {/* Video-Typ-Picker – nur im Feed-Modus */}
      {isVideo && showTypePicker && postMode === 'feed' && (
        <div className="flex flex-col gap-2 p-3 bg-neutral-900 rounded-lg border border-neutral-700">
          <p className="text-xs text-neutral-400 font-medium mb-1">Als was posten?</p>
          <button onClick={() => publishSelected('video_feed')} disabled={loading || !canPublish}
            className="text-xs px-3 py-2 rounded-md border border-neutral-700 text-neutral-300 hover:text-white hover:border-blue-500 transition-colors text-left disabled:opacity-40">
            📹 Feed-Video (normaler Post)
          </button>
          <button onClick={() => publishSelected('video_reel')} disabled={loading || !canPublish}
            className="text-xs px-3 py-2 rounded-md border border-neutral-700 text-neutral-300 hover:text-white hover:border-purple-500 transition-colors text-left disabled:opacity-40">
            🎬 Reel (Facebook)
          </button>
        </div>
      )}
    </div>
  );
}

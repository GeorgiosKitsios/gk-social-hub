'use client';

import { useState } from 'react';
import { useMediaStore } from '@/store/useMediaStore';

interface FacebookPage {
  id:           string;
  name:         string;
  access_token: string;
}

interface Props {
  message:           string;
  mediaIds?:         string[];
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

type PostVariant = 'text' | 'image' | 'video_feed' | 'video_reel';

export default function FacebookPublishButton({ message, mediaIds = [], validationErrors, onSuccess, onError }: Props) {
  const [loading,        setLoading]        = useState(false);
  const [showPicker,     setShowPicker]     = useState(false);
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [results,        setResults]        = useState<{ page: string; success: boolean; error?: string }[]>([]);

  const { getById } = useMediaStore();
  const pages = loadPages();

  const firstMedia  = mediaIds.length > 0 ? getById(mediaIds[0]) : null;
  const imageBase64 = firstMedia?.type === 'image' ? firstMedia.url : undefined;
  const videoBase64 = firstMedia?.type === 'video' ? firstMedia.url : undefined;
  const isVideo     = !!videoBase64;

  const internalErrors: string[] = pages.length === 0
    ? ['Keine Facebook-Seite verbunden.']
    : [];
  const allErrors  = [...internalErrors, ...(validationErrors ?? [])];
  const canPublish = allErrors.length === 0;

  function getDefaultVariant(): PostVariant {
    if (imageBase64) return 'image';
    if (videoBase64) return 'video_feed';
    return 'text';
  }

  async function publishToPage(page: FacebookPage, variant: PostVariant) {
    setLoading(true);
    try {
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

  async function publishAll(variant: PostVariant) {
    setResults([]);
    setShowPicker(false);
    setShowTypePicker(false);
    for (const page of pages) {
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
        </div>
      )}

      {/* Buttons */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => isVideo ? setShowTypePicker(o => !o) : publishAll(getDefaultVariant())}
          disabled={loading || !canPublish}
          className={`flex-1 text-xs py-2 rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5 text-white ${
            canPublish && !loading ? 'bg-green-600 hover:bg-green-500' : 'bg-neutral-700'
          }`}
        >
          {loading
            ? <><div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" /> Wird gepostet...</>
            : isVideo
            ? <>🎬 Video posten ▾</>
            : <>📘 Auf alle Pages ({pages.length}) posten</>
          }
        </button>
        {pages.length > 1 && (
          <button
            onClick={() => setShowPicker(o => !o)}
            disabled={loading}
            className="text-xs px-3 py-2 rounded-lg border border-neutral-600 text-neutral-400 hover:text-white hover:border-neutral-400 transition-colors"
          >
            Seite ▾
          </button>
        )}
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

      {/* Video-Typ-Picker */}
      {isVideo && showTypePicker && (
        <div className="flex flex-col gap-2 p-3 bg-neutral-900 rounded-lg border border-neutral-700">
          <p className="text-xs text-neutral-400 font-medium mb-1">Als was posten?</p>
          <button onClick={() => publishAll('video_feed')} disabled={loading}
            className="text-xs px-3 py-2 rounded-md border border-neutral-700 text-neutral-300 hover:text-white hover:border-blue-500 transition-colors text-left">
            📹 Feed-Video (normaler Post)
          </button>
          <div className="text-xs px-3 py-2 rounded-md border border-neutral-800 text-neutral-600 cursor-not-allowed">
            🎬 Reel – folgt mit Instagram-Anbindung
          </div>
        </div>
      )}

      {/* Page-Auswahl */}
      {showPicker && (
        <div className="flex flex-col gap-1.5 p-2 bg-neutral-900 rounded-lg border border-neutral-700">
          {pages.map(page => (
            <button key={page.id}
              onClick={() => { publishToPage(page, getDefaultVariant()); setShowPicker(false); }}
              disabled={loading || !canPublish}
              className="text-xs px-3 py-2 rounded-md border border-neutral-700 text-neutral-300 hover:text-white hover:border-blue-500 transition-colors text-left disabled:opacity-40">
              📘 {page.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

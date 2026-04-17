'use client';

import { useState } from 'react';
import { useMediaStore } from '@/store/useMediaStore';

interface FacebookPage {
  id:           string;
  name:         string;
  access_token: string;
}

interface Props {
  message:    string;
  mediaIds?:  string[];
  onSuccess?: (postId: string, pageName: string) => void;
  onError?:   (error: string) => void;
}

function loadPages(): FacebookPage[] {
  try {
    const raw = localStorage.getItem('gk-facebook-pages');
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export default function FacebookPublishButton({ message, mediaIds = [], onSuccess, onError }: Props) {
  const [loading,    setLoading]    = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [results,    setResults]    = useState<{ page: string; success: boolean; error?: string }[]>([]);

  const { getById } = useMediaStore();
  const pages = loadPages();

  // Erstes Bild holen falls vorhanden
  const firstMedia = mediaIds.length > 0 ? getById(mediaIds[0]) : null;
  const imageBase64 = firstMedia?.type === 'image' ? firstMedia.url : undefined;

  if (pages.length === 0) {
    return (
      <a href="/accounts" className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
        Facebook verbinden →
      </a>
    );
  }

  async function publishToPage(page: FacebookPage) {
    setLoading(true);
    try {
      const res = await fetch('/api/facebook/upload', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          pageId:      page.id,
          pageToken:   page.access_token,
          message,
          imageBase64,
        }),
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

  async function publishToAll() {
    setResults([]);
    setShowPicker(false);
    for (const page of pages) {
      await publishToPage(page);
    }
  }

  return (
    <div className="flex flex-col gap-2">

      {/* Bild-Info */}
      {imageBase64 && (
        <div className="text-xs text-neutral-500 flex items-center gap-1.5">
          <span>🖼</span>
          <span>1 Bild wird mitgepostet</span>
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
        {pages.length === 1 ? (
          <button
            onClick={() => publishToPage(pages[0])}
            disabled={loading || !message.trim()}
            className="flex-1 text-xs py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
          >
            {loading
              ? <><div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" /> Wird gepostet...</>
              : <>📘 Auf {pages[0].name} posten</>
            }
          </button>
        ) : (
          <>
            <button
              onClick={publishToAll}
              disabled={loading || !message.trim()}
              className="flex-1 text-xs py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
            >
              {loading
                ? <><div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" /> Wird gepostet...</>
                : <>📘 Auf alle Pages ({pages.length}) posten</>
              }
            </button>
            <button
              onClick={() => setShowPicker(o => !o)}
              disabled={loading}
              className="text-xs px-3 py-2 rounded-lg border border-neutral-600 text-neutral-400 hover:text-white hover:border-neutral-400 transition-colors"
            >
              Auswählen ▾
            </button>
          </>
        )}
      </div>

      {/* Page-Auswahl */}
      {showPicker && (
        <div className="flex flex-col gap-1.5 p-2 bg-neutral-900 rounded-lg border border-neutral-700">
          {pages.map(page => (
            <button
              key={page.id}
              onClick={() => { publishToPage(page); setShowPicker(false); }}
              disabled={loading || !message.trim()}
              className="text-xs px-3 py-2 rounded-md border border-neutral-700 text-neutral-300 hover:text-white hover:border-blue-500 transition-colors text-left disabled:opacity-40"
            >
              📘 {page.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

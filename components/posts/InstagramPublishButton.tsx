'use client';

import { useState } from 'react';
import { useMediaStore } from '@/store/useMediaStore';

interface InstagramToken {
  accountId:   string;
  brandName:   string;
  accessToken: string;
}

interface Props {
  message:           string;
  mediaIds?:         string[];
  validationErrors?: string[];
  onSuccess?:        (postId: string, accountName: string) => void;
  onError?:          (error: string) => void;
}

function loadTokens(): InstagramToken[] {
  try {
    const raw = localStorage.getItem('gk-instagram-tokens');
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export default function InstagramPublishButton({ message, mediaIds = [], validationErrors, onSuccess, onError }: Props) {
  const [loading,      setLoading]      = useState(false);
  const [showPicker,   setShowPicker]   = useState(false);
  const [results,      setResults]      = useState<{ account: string; success: boolean; error?: string }[]>([]);

  const { getById } = useMediaStore();
  const tokens      = loadTokens();

  const firstMedia = mediaIds.length > 0 ? getById(mediaIds[0]) : null;
  const imageUrl   = firstMedia?.type === 'image' ? firstMedia.url  : undefined;
  const videoUrl   = firstMedia?.type === 'video' ? firstMedia.url  : undefined;
  const hasMedia   = !!imageUrl || !!videoUrl;

  // Interne Validierung
  const internalErrors: string[] = [];
  if (tokens.length === 0)  internalErrors.push('Kein Instagram-Account verbunden.');
  if (!hasMedia)             internalErrors.push('Instagram benötigt mindestens ein Bild oder Video.');

  const allErrors  = [...internalErrors, ...(validationErrors ?? [])];
  const canPublish = allErrors.length === 0;

  async function publishToAccount(token: InstagramToken) {
    setLoading(true);
    try {
      const res  = await fetch('/api/instagram/publish', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          accountId:   token.accountId,
          accessToken: token.accessToken,
          caption:     message,
          imageUrl,
          videoUrl,
        }),
      });
      const data = await res.json();

      if (data.success) {
        setResults(r => [...r, { account: token.brandName, success: true }]);
        onSuccess?.(data.postId, token.brandName);
      } else {
        setResults(r => [...r, { account: token.brandName, success: false, error: data.error }]);
        onError?.(data.error);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Fehler';
      setResults(r => [...r, { account: token.brandName, success: false, error: msg }]);
      onError?.(msg);
    } finally {
      setLoading(false);
    }
  }

  async function publishAll() {
    setResults([]);
    setShowPicker(false);
    for (const token of tokens) {
      await publishToAccount(token);
    }
  }

  return (
    <div className="flex flex-col gap-2">

      {/* Medium-Info */}
      {firstMedia && (
        <div className="text-xs text-neutral-500 flex items-center gap-1.5">
          <span>{videoUrl ? '🎬' : '🖼'}</span>
          <span>{videoUrl ? 'Video wird mitgepostet' : 'Bild wird mitgepostet'}</span>
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
              <span>{r.account}: {r.success ? 'Veröffentlicht' : r.error}</span>
            </div>
          ))}
        </div>
      )}

      {/* Buttons */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => publishAll()}
          disabled={loading || !canPublish}
          className={`flex-1 text-xs py-2 rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5 text-white ${
            canPublish && !loading
              ? 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500'
              : 'bg-neutral-700'
          }`}
        >
          {loading
            ? <><div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" /> Wird gepostet…</>
            : <>📸 Auf Instagram ({tokens.length}) posten</>
          }
        </button>
        {tokens.length > 1 && (
          <button
            onClick={() => setShowPicker(o => !o)}
            disabled={loading}
            className="text-xs px-3 py-2 rounded-lg border border-neutral-600 text-neutral-400 hover:text-white hover:border-neutral-400 transition-colors"
          >
            Account ▾
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
          {tokens.length === 0 && (
            <a href="/admin/tokens" className="text-xs text-blue-400 hover:text-blue-300 transition-colors mt-0.5">
              → Instagram-Token hinzufügen
            </a>
          )}
        </div>
      )}

      {/* Account-Auswahl */}
      {showPicker && (
        <div className="flex flex-col gap-1.5 p-2 bg-neutral-900 rounded-lg border border-neutral-700">
          {tokens.map(token => (
            <button key={token.accountId}
              onClick={() => { publishToAccount(token); setShowPicker(false); }}
              disabled={loading || !canPublish}
              className="text-xs px-3 py-2 rounded-md border border-neutral-700 text-neutral-300 hover:text-white hover:border-pink-500 transition-colors text-left disabled:opacity-40">
              📸 {token.brandName}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

'use client';

import { useState, useEffect, useRef } from 'react';
import { useMediaStore } from '@/store/useMediaStore';
import { fetchSupabaseFbPages, nameBelongsToBrand, sameBrand, type SupabaseFbPage } from '@/lib/facebookPages';

interface InstagramAccount {
  id:          string;
  name:        string;
  accountId:   string;
  accessToken: string;
}

interface Props {
  message:           string;
  mediaIds?:         string[];
  brandId?:          string;
  brandName?:        string;
  validationErrors?: string[];
  onSuccess?:        (postId: string, accountName: string) => void;
  onError?:          (error: string) => void;
}

type PostType = 'feed' | 'story';

function loadAccounts(): InstagramAccount[] {
  try {
    const raw = localStorage.getItem('gk-instagram-accounts');
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

/** Vorauswahl der IG-Accounts der aktiven Marke.
 *  account.id = Facebook Page ID → Zuordnung autoritativ über Supabase-brand_id,
 *  sonst Namensabgleich, sonst nichts (lieber leer als falsch). */
function computeDefaultSelection(
  accounts:  InstagramAccount[],
  brandId:   string | undefined,
  brandName: string | undefined,
  supa:      SupabaseFbPage[] | null,
): Record<string, boolean> {
  const supaMap = supa ? new Map(supa.map(p => [p.page_id, p.brand_id])) : null;
  const init: Record<string, boolean> = {};
  for (const a of accounts) {
    let belongs: boolean | null = null;            // null = unbekannt
    if (supaMap) {
      const b = supaMap.get(a.id);
      if (b != null) belongs = sameBrand(b, brandId);
    }
    if (belongs === null && brandName) belongs = nameBelongsToBrand(a.name, brandName);
    init[a.id] = belongs === true;                 // unbekannt/false → nicht vorauswählen
  }
  return init;
}

export default function InstagramPublishButton({ message, mediaIds = [], brandId, brandName, validationErrors, onSuccess, onError }: Props) {
  const [loading,  setLoading]  = useState(false);
  const [postType, setPostType] = useState<PostType>('feed');
  const [results,  setResults]  = useState<{ account: string; success: boolean; error?: string }[]>([]);

  const { getById }  = useMediaStore();

  // SSR-sicher: localStorage erst nach dem Mount lesen (Initialwert leer = wie Server).
  const [accounts, setAccounts] = useState<InstagramAccount[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  // Sobald der Nutzer selbst (ab)wählt, nicht mehr automatisch überschreiben.
  const userTouched = useRef(false);

  // Nach Mount: Accounts laden + Vorauswahl bestimmen (Supabase → Namensabgleich → nichts).
  useEffect(() => {
    const local = loadAccounts();
    setAccounts(local);
    let cancelled = false;
    fetchSupabaseFbPages().then(supa => {
      if (cancelled || userTouched.current) return;
      setSelected(computeDefaultSelection(local, brandId, brandName, supa));
    });
    return () => { cancelled = true; };
  }, [brandId, brandName]);

  const firstMedia = mediaIds.length > 0 ? getById(mediaIds[0]) : null;
  const imageUrl   = firstMedia?.type === 'image' ? firstMedia.url  : undefined;
  const videoUrl   = firstMedia?.type === 'video' ? firstMedia.url  : undefined;
  const hasMedia   = !!imageUrl || !!videoUrl;

  const selectedAccounts = accounts.filter(a => selected[a.id]);

  // Interne Validierung
  const internalErrors: string[] = [];
  if (accounts.length === 0)          internalErrors.push('Kein Instagram-Account verbunden.');
  if (!hasMedia)                      internalErrors.push('Instagram benötigt mindestens ein Bild oder Video.');
  if (accounts.length > 0 && selectedAccounts.length === 0)
                                      internalErrors.push('Kein Account ausgewählt.');
  if (imageUrl?.startsWith('data:'))  internalErrors.push('Bild muss als öffentliche HTTPS-URL vorliegen (zuerst in die Medienbibliothek hochladen).');

  // Caption-Validierungsfehler (leerer Text) sind für Stories irrelevant.
  const externalErrors = postType === 'story' ? [] : (validationErrors ?? []);
  const allErrors  = [...internalErrors, ...externalErrors];
  const canPublish = allErrors.length === 0;

  function toggle(accId: string) {
    userTouched.current = true;
    setSelected(s => ({ ...s, [accId]: !s[accId] }));
  }

  async function publishToAccount(account: InstagramAccount) {
    setLoading(true);
    try {
      const payload = {
        accountId:   account.accountId,
        accessToken: account.accessToken,
        caption:     postType === 'story' ? '' : message,
        imageUrl,
        videoUrl,
        postType,
      };
      const res  = await fetch('/api/instagram/publish', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      });
      const data = await res.json();

      if (data.success) {
        setResults(r => [...r, { account: account.name, success: true }]);
        onSuccess?.(data.postId, account.name);
      } else {
        setResults(r => [...r, { account: account.name, success: false, error: data.error }]);
        onError?.(data.error);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Fehler';
      setResults(r => [...r, { account: account.name, success: false, error: msg }]);
      onError?.(msg);
    } finally {
      setLoading(false);
    }
  }

  async function publishSelected() {
    setResults([]);
    for (const account of selectedAccounts) {
      await publishToAccount(account);
    }
  }

  return (
    <div className="flex flex-col gap-2">

      {/* Medium-Info */}
      {firstMedia && (
        <div className="text-xs text-neutral-500 flex items-center gap-1.5">
          <span>{videoUrl ? '🎬' : '🖼'}</span>
          <span>{videoUrl ? 'Video wird gepostet' : 'Bild wird gepostet'}</span>
        </div>
      )}

      {/* Feed / Story Umschalter */}
      {accounts.length > 0 && (
        <div className="flex gap-1 bg-neutral-900 rounded-lg p-0.5 border border-neutral-700">
          {(['feed', 'story'] as PostType[]).map(t => (
            <button
              key={t}
              onClick={() => setPostType(t)}
              disabled={loading}
              className={`flex-1 text-xs py-1.5 rounded-md transition-colors ${
                postType === t ? 'bg-neutral-700 text-white' : 'text-neutral-400 hover:text-white'
              }`}>
              {t === 'feed' ? '🖼 Feed-Post' : '⊕ Story'}
            </button>
          ))}
        </div>
      )}
      {postType === 'story' && (
        <p className="text-[11px] text-neutral-500">
          Story: nur Bild/Video, ohne Bildunterschrift (Instagram unterstützt keinen Caption-Text für Stories).
        </p>
      )}

      {/* Account-Auswahl per Checkbox */}
      {accounts.length > 0 && (
        <div className="flex flex-col gap-1 p-2 bg-neutral-900 rounded-lg border border-neutral-700">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-neutral-400 font-medium">Accounts auswählen</span>
            <div className="flex gap-2">
              <button
                onClick={() => { userTouched.current = true; setSelected(Object.fromEntries(accounts.map(a => [a.id, true]))); }}
                disabled={loading}
                className="text-[11px] text-neutral-500 hover:text-white transition-colors">
                Alle
              </button>
              <button
                onClick={() => { userTouched.current = true; setSelected(Object.fromEntries(accounts.map(a => [a.id, false]))); }}
                disabled={loading}
                className="text-[11px] text-neutral-500 hover:text-white transition-colors">
                Keine
              </button>
            </div>
          </div>
          {accounts.map(account => (
            <label
              key={account.id}
              className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-neutral-800/60 cursor-pointer">
              <input
                type="checkbox"
                checked={!!selected[account.id]}
                onChange={() => toggle(account.id)}
                disabled={loading}
                className="accent-pink-600"
              />
              <span className="text-xs text-neutral-300">📸 {account.name}</span>
            </label>
          ))}
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

      {/* Publish-Button */}
      <button
        onClick={() => publishSelected()}
        disabled={loading || !canPublish}
        className={`w-full text-xs py-2 rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5 text-white ${
          canPublish && !loading
            ? 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500'
            : 'bg-neutral-700'
        }`}
      >
        {loading
          ? <><div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" /> Wird gepostet…</>
          : postType === 'story'
          ? <>📸 Story auf {selectedAccounts.length} {selectedAccounts.length === 1 ? 'Account' : 'Accounts'}</>
          : <>📸 Feed-Post auf {selectedAccounts.length} {selectedAccounts.length === 1 ? 'Account' : 'Accounts'}</>
        }
      </button>

      {/* Validierungsfehler */}
      {allErrors.length > 0 && (
        <div className="flex flex-col gap-1">
          {allErrors.map((err, i) => (
            <p key={i} className="text-xs text-red-400 flex items-start gap-1">
              <span className="shrink-0 mt-px">✕</span>
              <span>{err}</span>
            </p>
          ))}
          {accounts.length === 0 && (
            <a href="/accounts" className="text-xs text-blue-400 hover:text-blue-300 transition-colors mt-0.5">
              → Instagram-Account verbinden
            </a>
          )}
        </div>
      )}
    </div>
  );
}

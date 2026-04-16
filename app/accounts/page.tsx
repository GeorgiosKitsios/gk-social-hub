'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useBrandStore } from '@/store/useBrandStore';
import { BrandAvatar }   from '@/components/layout/Topbar';

interface FacebookPage {
  id:           string;
  name:         string;
  access_token: string;
}

const STORAGE_KEY = 'gk-facebook-pages';

function loadPages(): FacebookPage[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function savePages(pages: FacebookPage[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pages));
  } catch { /* ignore */ }
}

function AccountsContent() {
  const { brands } = useBrandStore();
  const searchParams = useSearchParams();
  const active = brands.filter(b => !b.archived);

  const [fbPages, setFbPages] = useState<FacebookPage[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setFbPages(loadPages());

    const pagesParam = searchParams.get('pages');
    const error      = searchParams.get('error');

    if (pagesParam) {
      try {
        const newPages: FacebookPage[] = JSON.parse(decodeURIComponent(pagesParam));
        const existing = loadPages();
        const merged   = [...existing];

        for (const p of newPages) {
          const idx = merged.findIndex(e => e.id === p.id);
          if (idx === -1) {
            merged.push(p);
          } else {
            merged[idx] = p;
          }
        }

        savePages(merged);
        setFbPages(merged);
        setMessage(`✓ ${merged.length} Facebook ${merged.length === 1 ? 'Page' : 'Pages'} verbunden`);
      } catch {
        setMessage('Fehler beim Laden der Pages.');
      }
      window.history.replaceState({}, '', '/accounts');
    }

    if (error) {
      const errorMap: Record<string, string> = {
        no_code:     'Verbindung abgebrochen.',
        token_failed:'Token konnte nicht abgerufen werden.',
        no_pages:    'Keine Facebook Pages gefunden.',
        oauth_failed:'Verbindungsfehler.',
      };
      setMessage(`✕ ${errorMap[error] ?? 'Unbekannter Fehler'}`);
      window.history.replaceState({}, '', '/accounts');
    }
  }, [searchParams]);

  function disconnectPage(pageId: string) {
    const updated = fbPages.filter(p => p.id !== pageId);
    savePages(updated);
    setFbPages(updated);
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-white">Konten & Verbindungen</h1>
        <p className="text-sm text-neutral-400 mt-0.5">Social-Media-Accounts verwalten</p>
      </div>

      {/* Status-Meldung */}
      {message && (
        <div className={`mb-6 px-4 py-3 rounded-lg text-sm ${
          message.startsWith('✓')
            ? 'bg-green-500/10 text-green-400 border border-green-500/20'
            : 'bg-red-500/10 text-red-400 border border-red-500/20'
        }`}>
          {message}
        </div>
      )}

      {/* Facebook verbinden */}
      <div className="bg-neutral-800 border border-neutral-700 rounded-xl p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-sm font-medium text-white mb-1">Facebook Pages</div>
            <div className="text-xs text-neutral-400">
              {fbPages.length > 0
                ? `${fbPages.length} ${fbPages.length === 1 ? 'Page' : 'Pages'} verbunden`
                : 'Noch keine Pages verbunden'}
            </div>
          </div>
          <a
            href="/api/auth/facebook"
            className="text-xs px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors"
          >
            {fbPages.length > 0 ? '+ Weitere Pages' : 'Mit Facebook verbinden'}
          </a>
        </div>

        {fbPages.length > 0 && (
          <div className="flex flex-col gap-2">
            {fbPages.map(page => (
              <div
                key={page.id}
                className="flex items-center justify-between py-2.5 px-3 bg-neutral-900 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <div>
                    <div className="text-sm text-white">{page.name}</div>
                    <div className="text-xs text-neutral-500">ID: {page.id}</div>
                  </div>
                </div>
                <button
                  onClick={() => disconnectPage(page.id)}
                  className="text-xs px-3 py-1 rounded border border-neutral-600 text-neutral-400 hover:text-red-400 hover:border-red-500 transition-colors"
                >
                  Trennen
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Marken-Übersicht */}
      <div className="flex flex-col gap-4">
        {active.map(brand => (
          <div
            key={brand.id}
            className="bg-neutral-800 border border-neutral-700 rounded-xl p-4"
            style={{ borderLeftColor: brand.color, borderLeftWidth: 3 }}
          >
            <div className="flex items-center gap-3 mb-3">
              <BrandAvatar brand={brand} size={32} />
              <div>
                <div className="text-sm font-medium text-white">{brand.name}</div>
                <div className="text-xs text-neutral-400">{brand.industry}</div>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              {brand.platforms.map(p => {
                const label     = p === 'facebook' ? 'Facebook' : p === 'instagram' ? 'Instagram' : 'TikTok';
                const connected = p === 'facebook' && fbPages.length > 0;
                return (
                  <div key={p} className="flex items-center justify-between py-1.5 border-t border-neutral-700/50">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-neutral-300 w-20">{label}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        connected
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-neutral-700 text-neutral-500'
                      }`}>
                        {connected ? '✓ Verbunden' : '– Nicht verbunden'}
                      </span>
                    </div>
                    {p !== 'facebook' && (
                      <span className="text-xs text-neutral-600 italic">folgt in Phase 3</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AccountsPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-full text-neutral-500 text-sm">
        Lade...
      </div>
    }>
      <AccountsContent />
    </Suspense>
  );
}

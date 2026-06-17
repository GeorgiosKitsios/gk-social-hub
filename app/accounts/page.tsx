'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useBrandStore } from '@/store/useBrandStore';
import { BrandAvatar }   from '@/components/layout/Topbar';

interface FacebookPage {
  id:           string;
  name:         string;
  access_token: string;
  tasks?:       string[];
  brand_id?:    string | null;
}

interface InstagramAccount {
  id:          string;
  name:        string;
  accountId:   string;
  accessToken: string;
}

const STORAGE_KEY    = 'gk-facebook-pages';
const IG_STORAGE_KEY = 'gk-instagram-accounts';

function loadIgAccounts(): InstagramAccount[] {
  try {
    const raw = localStorage.getItem(IG_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveIgAccounts(accounts: InstagramAccount[]) {
  try {
    localStorage.setItem(IG_STORAGE_KEY, JSON.stringify(accounts));
  } catch { /* ignore */ }
}

/** Spiegelt IG-Accounts fire-and-forget nach Supabase via dedizierter Route.
 *  Nutzt service_role-Key (server-only), kein CRON_SECRET nötig. */
function syncIgAccountsToSupabase(accounts: InstagramAccount[]) {
  if (accounts.length === 0) return;
  fetch('/api/ig-accounts/sync', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ accounts }),
  })
    .then(async r => {
      const d = await r.json();
      if (d.ok) {
        console.log('[Accounts] IG-Sync OK –', d.synced, 'Account(s) in Supabase geschrieben');
      } else {
        console.error('[Accounts] IG-Sync FEHLER (HTTP', r.status, '):',
          d.error, '| code:', d.code, '| details:', d.details, '| hint:', d.hint);
      }
    })
    .catch(e => console.error('[Accounts] IG-Sync Netzwerkfehler:', e));
}

/** Eine Page kann nur bespielt werden, wenn der Nutzer dort CREATE_CONTENT darf.
 *  Ältere Verbindungen ohne tasks-Info gelten als unbekannt (true), damit sie
 *  nicht fälschlich als gesperrt erscheinen. */
function canPost(page: FacebookPage): boolean {
  if (!page.tasks) return true;
  return page.tasks.includes('CREATE_CONTENT');
}

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

  const [fbPages,    setFbPages]    = useState<FacebookPage[]>([]);
  const [igAccounts, setIgAccounts] = useState<InstagramAccount[]>([]);
  const [message,    setMessage]    = useState<string | null>(null);

  useEffect(() => {
    setFbPages(loadPages());
    const existingIg = loadIgAccounts();
    setIgAccounts(existingIg);
    // Beim ersten Laden einmalig spiegeln – falls Accounts im localStorage sind,
    // aber die Supabase-Tabelle noch leer ist (z. B. nach Migration).
    syncIgAccountsToSupabase(existingIg);

    const pagesParam = searchParams.get('pages');
    const igParam    = searchParams.get('igAccounts');
    const error      = searchParams.get('error');

    if (pagesParam) {
      try {
        const newPages: FacebookPage[] = JSON.parse(pagesParam);
        const merged = [...loadPages()];

        for (const p of newPages) {
          const idx = merged.findIndex(e => e.id === p.id);
          if (idx === -1) merged.push(p);
          else            merged[idx] = p;
        }

        savePages(merged);
        setFbPages(merged);

        // Verknüpfte Instagram-Accounts (falls vorhanden) mergen – dedupliziert nach accountId.
        let igCount = 0;
        if (igParam) {
          const newIg: InstagramAccount[] = JSON.parse(igParam);
          const mergedIg = [...loadIgAccounts()];
          for (const a of newIg) {
            const idx = mergedIg.findIndex(e => e.accountId === a.accountId);
            if (idx === -1) mergedIg.push(a);
            else            mergedIg[idx] = a;
          }
          saveIgAccounts(mergedIg);
          setIgAccounts(mergedIg);
          syncIgAccountsToSupabase(mergedIg);
          igCount = newIg.length;
        }

        setMessage(
          `✓ ${merged.length} Facebook ${merged.length === 1 ? 'Page' : 'Pages'}` +
          (igCount > 0 ? ` · ${igCount} Instagram-Account${igCount === 1 ? '' : 's'}` : '') +
          ' verbunden'
        );
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

  function assignBrandToPage(pageId: string, brandId: string | null) {
    const updated = fbPages.map(p =>
      p.id === pageId ? { ...p, brand_id: brandId ?? undefined } : p
    );
    savePages(updated);
    setFbPages(updated);
  }

  function disconnectIg(accountId: string) {
    const updated = igAccounts.filter(a => a.accountId !== accountId);
    saveIgAccounts(updated);
    setIgAccounts(updated);
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
                className="flex items-center justify-between py-2.5 px-3 bg-neutral-900 rounded-lg gap-2"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${canPost(page) ? 'bg-green-500' : 'bg-amber-500'}`} />
                  <div className="min-w-0">
                    <div className="text-sm text-white flex items-center gap-2 flex-wrap">
                      {page.name}
                      {!canPost(page) && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/20">
                          ⚠ kein Posting-Recht
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-neutral-500">ID: {page.id}</div>
                  </div>
                </div>
                <select
                  value={page.brand_id ?? ''}
                  onChange={e => assignBrandToPage(page.id, e.target.value || null)}
                  className="text-xs bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-neutral-300 focus:outline-none focus:border-blue-500 shrink-0"
                >
                  <option value="">– Marke –</option>
                  {active.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
                <button
                  onClick={() => disconnectPage(page.id)}
                  className="text-xs px-3 py-1 rounded border border-neutral-600 text-neutral-400 hover:text-red-400 hover:border-red-500 transition-colors shrink-0"
                >
                  Trennen
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Instagram-Accounts (automatisch über Facebook-Login verknüpft) */}
      <div className="bg-neutral-800 border border-neutral-700 rounded-xl p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-sm font-medium text-white mb-1">Instagram-Accounts</div>
            <div className="text-xs text-neutral-400">
              {igAccounts.length > 0
                ? `${igAccounts.length} ${igAccounts.length === 1 ? 'Account' : 'Accounts'} verknüpft`
                : 'Werden beim Facebook-Login automatisch verknüpft'}
            </div>
          </div>
          <a
            href="/api/auth/facebook"
            className="text-xs px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-medium transition-colors"
          >
            {igAccounts.length > 0 ? '↻ Aktualisieren' : 'Via Facebook verbinden'}
          </a>
        </div>

        {igAccounts.length > 0 ? (
          <div className="flex flex-col gap-2">
            {igAccounts.map(acc => (
              <div
                key={acc.id}
                className="flex items-center justify-between py-2.5 px-3 bg-neutral-900 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-pink-500" />
                  <div>
                    <div className="text-sm text-white">📸 {acc.name}</div>
                    <div className="text-xs text-neutral-500">Account-ID: {acc.accountId}</div>
                  </div>
                </div>
                <button
                  onClick={() => disconnectIg(acc.accountId)}
                  className="text-xs px-3 py-1 rounded border border-neutral-600 text-neutral-400 hover:text-red-400 hover:border-red-500 transition-colors"
                >
                  Trennen
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-neutral-500">
            Verbinde dich oben mit Facebook und gib <span className="text-neutral-300">instagram_basic</span> +{' '}
            <span className="text-neutral-300">instagram_content_publish</span> frei. Jede Facebook-Page mit
            verknüpftem Instagram-Business-Account erscheint dann hier automatisch.
          </p>
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
                const connected = (p === 'facebook'  && fbPages.length > 0)
                               || (p === 'instagram' && igAccounts.length > 0);
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
                    {p === 'tiktok' && (
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

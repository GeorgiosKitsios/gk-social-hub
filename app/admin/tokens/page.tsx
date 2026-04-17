'use client';

import { useState, useEffect } from 'react';

interface FacebookPage {
  id:           string;
  name:         string;
  access_token: string;
}

const STORAGE_KEY = 'gk-facebook-pages';

const KNOWN_PAGES = [
  { id: '837133812826123', name: 'GK Skill Systems'  },
  { id: '456579734205552', name: 'GK Pokale'         },
  { id: '133683950024890', name: 'FC Hellas München' },
];

export default function AdminTokensPage() {
  const [tokens, setTokens]   = useState<Record<string, string>>({});
  const [saved,  setSaved]    = useState(false);
  const [current, setCurrent] = useState<FacebookPage[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const pages: FacebookPage[] = JSON.parse(raw);
        setCurrent(pages);
        const t: Record<string, string> = {};
        pages.forEach(p => { t[p.id] = p.access_token; });
        setTokens(t);
      }
    } catch { /* ignore */ }
  }, []);

  function handleSave() {
    const pages: FacebookPage[] = KNOWN_PAGES
      .filter(p => tokens[p.id]?.trim())
      .map(p => ({
        id:           p.id,
        name:         p.name,
        access_token: tokens[p.id].trim(),
      }));

    localStorage.setItem(STORAGE_KEY, JSON.stringify(pages));
    setCurrent(pages);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function handleClear() {
    localStorage.removeItem(STORAGE_KEY);
    setTokens({});
    setCurrent([]);
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-white">Facebook Token Manager</h1>
        <p className="text-sm text-neutral-400 mt-0.5">
          Page Access Tokens manuell eintragen
        </p>
      </div>

      {/* Aktueller Status */}
      {current.length > 0 && (
        <div className="mb-6 bg-green-500/10 border border-green-500/20 rounded-xl p-4">
          <div className="text-sm font-medium text-green-400 mb-2">
            ✓ {current.length} Pages gespeichert
          </div>
          {current.map(p => (
            <div key={p.id} className="text-xs text-neutral-400">
              {p.name} · ID: {p.id}
            </div>
          ))}
        </div>
      )}

      {/* Token-Felder */}
      <div className="flex flex-col gap-4 mb-6">
        {KNOWN_PAGES.map(page => (
          <div key={page.id} className="bg-neutral-800 border border-neutral-700 rounded-xl p-4">
            <div className="text-sm font-medium text-white mb-1">{page.name}</div>
            <div className="text-xs text-neutral-500 mb-3">ID: {page.id}</div>
            <label className="block text-xs text-neutral-400 mb-1">
              Page Access Token
            </label>
            <textarea
              value={tokens[page.id] ?? ''}
              onChange={e => setTokens(t => ({ ...t, [page.id]: e.target.value }))}
              rows={3}
              placeholder="EAAUUtbZ..."
              className="w-full bg-neutral-900 border border-neutral-600 rounded-lg px-3 py-2 text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-blue-500 resize-none font-mono"
            />
          </div>
        ))}
      </div>

      {/* Aktionen */}
      <div className="flex gap-3">
        <button
          onClick={handleSave}
          className="flex-1 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
        >
          {saved ? '✓ Gespeichert!' : 'Tokens speichern'}
        </button>
        <button
          onClick={handleClear}
          className="px-4 py-2.5 rounded-lg border border-neutral-600 text-neutral-400 hover:text-red-400 hover:border-red-500 text-sm transition-colors"
        >
          Alle löschen
        </button>
      </div>

      <p className="text-xs text-neutral-600 mt-4 text-center">
        Tokens aus dem Graph API Explorer eintragen · Laufen nach ~60 Tagen ab
      </p>
    </div>
  );
}

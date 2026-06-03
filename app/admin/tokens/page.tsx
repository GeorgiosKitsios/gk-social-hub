'use client';

import { useState, useEffect } from 'react';

// ── Typen ────────────────────────────────────────────────────────────────────

interface FacebookPage {
  id:           string;
  name:         string;
  access_token: string;
}

interface InstagramAccount {
  id:          string;
  name:        string;
  accountId:   string;
  accessToken: string;
}

// ── Konstanten ───────────────────────────────────────────────────────────────

const FB_STORAGE_KEY = 'gk-facebook-pages';
const IG_STORAGE_KEY = 'gk-instagram-accounts';

const KNOWN_FB_PAGES = [
  { id: '837133812826123', name: 'GK Skill Systems'  },
  { id: '456579734205552', name: 'GK Pokale'         },
  { id: '133683950024890', name: 'FC Hellas München' },
];

const KNOWN_IG_BRANDS = [
  { id: 'gk-skill-systems',  name: 'GK Skill Systems',  defaultAccountId: ''                  },
  { id: 'gk-pokale',         name: 'GK Pokale',          defaultAccountId: '17841470117662266' },
  { id: 'fc-hellas',         name: 'FC Hellas München',  defaultAccountId: ''                  },
  { id: 'gk-sports-group',   name: 'GK Sports Group',    defaultAccountId: ''                  },
  { id: 'georgios-kitsios',  name: 'Georgios Kitsios',   defaultAccountId: ''                  },
];

const createDefaultIgForm = () =>
  KNOWN_IG_BRANDS.reduce<Record<string, { accountId: string; accessToken: string }>>((form, brand) => {
    form[brand.id] = { accountId: brand.defaultAccountId, accessToken: '' };
    return form;
  }, {});

const getDefaultIgEntry = (brandId: string) => {
  const brand = KNOWN_IG_BRANDS.find(b => b.id === brandId);
  return { accountId: brand?.defaultAccountId ?? '', accessToken: '' };
};

// ── Komponente ───────────────────────────────────────────────────────────────

export default function AdminTokensPage() {

  // ── Facebook State ──────────────────────────────────────────────────────
  const [fbTokens,  setFbTokens]  = useState<Record<string, string>>({});
  const [fbSaved,   setFbSaved]   = useState(false);
  const [fbCurrent, setFbCurrent] = useState<FacebookPage[]>([]);

  // ── Instagram State ─────────────────────────────────────────────────────
  // igForm: keyed by brand.id → { accountId, accessToken }
  const [igForm,    setIgForm]    = useState<Record<string, { accountId: string; accessToken: string }>>(createDefaultIgForm);
  const [igSaved,   setIgSaved]   = useState(false);
  const [igCurrent, setIgCurrent] = useState<InstagramAccount[]>([]);

  // ── Hydration aus localStorage ──────────────────────────────────────────
  useEffect(() => {
    // Facebook
    try {
      const raw = localStorage.getItem(FB_STORAGE_KEY);
      if (raw) {
        const pages: FacebookPage[] = JSON.parse(raw);
        setFbCurrent(pages);
        const t: Record<string, string> = {};
        pages.forEach(p => { t[p.id] = p.access_token; });
        setFbTokens(t);
      }
    } catch { /* ignore */ }

    // Instagram
    try {
      const raw = localStorage.getItem(IG_STORAGE_KEY);
      if (raw) {
        const accounts: InstagramAccount[] = JSON.parse(raw);
        setIgCurrent(accounts);
        const form = createDefaultIgForm();
        accounts.forEach(a => {
          form[a.id] = { accountId: a.accountId, accessToken: a.accessToken };
        });
        setIgForm(form);
      }
    } catch { /* ignore */ }
  }, []);

  // ── Facebook Handler ────────────────────────────────────────────────────
  function handleFbSave() {
    const pages: FacebookPage[] = KNOWN_FB_PAGES
      .filter(p => fbTokens[p.id]?.trim())
      .map(p => ({ id: p.id, name: p.name, access_token: fbTokens[p.id].trim() }));
    localStorage.setItem(FB_STORAGE_KEY, JSON.stringify(pages));
    setFbCurrent(pages);
    setFbSaved(true);
    setTimeout(() => setFbSaved(false), 2000);
  }

  function handleFbClear() {
    localStorage.removeItem(FB_STORAGE_KEY);
    setFbTokens({});
    setFbCurrent([]);
  }

  // ── Instagram Handler ───────────────────────────────────────────────────
  function handleIgSave() {
    const accounts: InstagramAccount[] = KNOWN_IG_BRANDS
      .filter(b => igForm[b.id]?.accountId?.trim() && igForm[b.id]?.accessToken?.trim())
      .map(b => ({
        id:          b.id,
        name:        b.name,
        accountId:   igForm[b.id].accountId.trim(),
        accessToken: igForm[b.id].accessToken.trim(),
      }));
    localStorage.setItem(IG_STORAGE_KEY, JSON.stringify(accounts));
    setIgCurrent(accounts);
    setIgSaved(true);
    setTimeout(() => setIgSaved(false), 2000);
  }

  function handleIgClear() {
    localStorage.removeItem(IG_STORAGE_KEY);
    setIgForm(createDefaultIgForm());
    setIgCurrent([]);
  }

  function setIgField(brandId: string, field: 'accountId' | 'accessToken', value: string) {
    setIgForm(prev => ({
      ...prev,
      [brandId]: { ...getDefaultIgEntry(brandId), ...prev[brandId], [field]: value },
    }));
  }

  // ── JSX ──────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 max-w-2xl mx-auto">

      {/* ════ FACEBOOK ════════════════════════════════════════════════════ */}

      <div className="mb-6">
        <h1 className="text-xl font-semibold text-white">🔑 Token Manager</h1>
        <p className="text-sm text-neutral-400 mt-0.5">
          Facebook &amp; Instagram Access Tokens verwalten · laufen nach ~60 Tagen ab
        </p>
      </div>

      {/* Quick Links */}
      <div className="bg-neutral-800 border border-neutral-700 rounded-xl p-4 mb-6">
        <div className="text-sm font-medium text-white mb-3">Token erneuern</div>
        <div className="flex flex-col gap-2">
          <a
            href="https://developers.facebook.com/tools/explorer"
            target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-3 px-4 py-3 bg-blue-600/10 hover:bg-blue-600/20 border border-blue-500/30 rounded-lg transition-colors"
          >
            <span className="text-lg">📘</span>
            <div>
              <div className="text-sm font-medium text-blue-400">Facebook Graph API Explorer</div>
              <div className="text-xs text-neutral-500 mt-0.5">
                App „GK Social Hub“ → Generate Access Token → GET /me/accounts → Token kopieren
              </div>
            </div>
            <span className="ml-auto text-neutral-500 text-xs">↗</span>
          </a>
          <a
            href="https://developers.facebook.com/tools/explorer"
            target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-3 px-4 py-3 bg-purple-600/10 hover:bg-purple-600/20 border border-purple-500/30 rounded-lg transition-colors"
          >
            <span className="text-lg">📸</span>
            <div>
              <div className="text-sm font-medium text-purple-400">Instagram Token erneuern</div>
              <div className="text-xs text-neutral-500 mt-0.5">
                Graph Explorer → Permissions: instagram_basic + instagram_content_publish → Token kopieren
              </div>
            </div>
            <span className="ml-auto text-neutral-500 text-xs">↗</span>
          </a>
        </div>
      </div>

      {/* Facebook Status */}
      {fbCurrent.length > 0 && (
        <div className="mb-4 bg-green-500/10 border border-green-500/20 rounded-xl p-4">
          <div className="text-sm font-medium text-green-400 mb-2">✓ {fbCurrent.length} Facebook Pages gespeichert</div>
          {fbCurrent.map(p => (
            <div key={p.id} className="text-xs text-neutral-400">{p.name} · ID: {p.id}</div>
          ))}
        </div>
      )}

      {/* Facebook Token-Felder */}
      <div className="flex flex-col gap-4 mb-6">
        {KNOWN_FB_PAGES.map(page => (
          <div key={page.id} className="bg-neutral-800 border border-neutral-700 rounded-xl p-4">
            <div className="text-sm font-medium text-white mb-1">{page.name}</div>
            <div className="text-xs text-neutral-500 mb-3">Page ID: {page.id}</div>
            <label className="block text-xs text-neutral-400 mb-1">Page Access Token</label>
            <textarea
              value={fbTokens[page.id] ?? ''}
              onChange={e => setFbTokens(t => ({ ...t, [page.id]: e.target.value }))}
              rows={3}
              placeholder="EAAUUtbZ..."
              className="w-full bg-neutral-900 border border-neutral-600 rounded-lg px-3 py-2 text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-blue-500 resize-none font-mono"
            />
            {fbCurrent.find(p2 => p2.id === page.id)
              ? <div className="text-xs text-green-400 mt-1">✓ Token gespeichert</div>
              : <div className="text-xs text-neutral-600 mt-1">– Kein Token</div>
            }
          </div>
        ))}
      </div>

      {/* Facebook Aktionen */}
      <div className="flex gap-3">
        <button
          onClick={handleFbSave}
          className="flex-1 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
        >
          {fbSaved ? '✓ Gespeichert!' : 'Facebook Tokens speichern'}
        </button>
        <button
          onClick={handleFbClear}
          className="px-4 py-2.5 rounded-lg border border-neutral-600 text-neutral-400 hover:text-red-400 hover:border-red-500 text-sm transition-colors"
        >
          Alle löschen
        </button>
      </div>

      <p className="text-xs text-neutral-600 mt-4 mb-10 text-center">
        Tokens laufen nach ~60 Tagen ab · Long-Lived Tokens folgen in Phase 3
      </p>

      {/* ════ INSTAGRAM ═══════════════════════════════════════════════════ */}

      <div className="border-t border-neutral-800 pt-10 mb-6">
        <h2 className="text-lg font-semibold text-white mb-1">📸 Instagram Tokens</h2>
        <p className="text-sm text-neutral-400">
          Instagram Business Account Tokens · Permissions: instagram_basic + instagram_content_publish
        </p>
      </div>

      {/* Instagram Status */}
      {igCurrent.length > 0 && (
        <div className="mb-4 bg-purple-500/10 border border-purple-500/20 rounded-xl p-4">
          <div className="text-sm font-medium text-purple-400 mb-2">✓ {igCurrent.length} Instagram-Account(s) gespeichert</div>
          {igCurrent.map(a => (
            <div key={a.id} className="text-xs text-neutral-400">{a.name} · Account-ID: {a.accountId}</div>
          ))}
        </div>
      )}

      {/* Instagram Token-Felder */}
      <div className="flex flex-col gap-4 mb-6">
        {KNOWN_IG_BRANDS.map(brand => {
          const entry = igForm[brand.id] ?? { accountId: brand.defaultAccountId, accessToken: '' };
          const isSaved = !!igCurrent.find(a => a.id === brand.id);
          return (
            <div key={brand.id} className="bg-neutral-800 border border-neutral-700 rounded-xl p-4">
              <div className="text-sm font-medium text-white mb-3">{brand.name}</div>

              <label className="block text-xs text-neutral-400 mb-1">Instagram Business Account-ID</label>
              <input
                type="text"
                value={entry.accountId}
                onChange={e => setIgField(brand.id, 'accountId', e.target.value)}
                placeholder="17841470117662266"
                className="w-full bg-neutral-900 border border-neutral-600 rounded-lg px-3 py-2 text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-purple-500 font-mono mb-3"
              />

              <label className="block text-xs text-neutral-400 mb-1">Access Token</label>
              <textarea
                value={entry.accessToken}
                onChange={e => setIgField(brand.id, 'accessToken', e.target.value)}
                rows={3}
                placeholder="EAAUUtbZ..."
                className="w-full bg-neutral-900 border border-neutral-600 rounded-lg px-3 py-2 text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-purple-500 resize-none font-mono"
              />
              {isSaved
                ? <div className="text-xs text-purple-400 mt-1">✓ Token gespeichert</div>
                : <div className="text-xs text-neutral-600 mt-1">– Kein Token</div>
              }
            </div>
          );
        })}
      </div>

      {/* Instagram Aktionen */}
      <div className="flex gap-3">
        <button
          onClick={handleIgSave}
          className="flex-1 py-2.5 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-sm font-medium transition-colors"
        >
          {igSaved ? '✓ Gespeichert!' : 'Instagram-Tokens speichern'}
        </button>
        <button
          onClick={handleIgClear}
          className="px-4 py-2.5 rounded-lg border border-neutral-600 text-neutral-400 hover:text-red-400 hover:border-red-500 text-sm transition-colors"
        >
          Alle löschen
        </button>
      </div>

      <p className="text-xs text-neutral-600 mt-4 text-center">
        Instagram erfordert einen Business- oder Creator-Account · Permissions: instagram_basic, instagram_content_publish
      </p>
    </div>
  );
}

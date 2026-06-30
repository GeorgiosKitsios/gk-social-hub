/**
 * lib/facebookPages.ts
 *
 * Gemeinsame Logik rund um Facebook-Seiten-/Marken-Zuordnung im Browser.
 *
 * Hintergrund: Die brand_ids im localStorage (gk-facebook-pages) waren durch
 * einen früheren Bug „vergiftet" (überall '3'). Quelle der Wahrheit ist jetzt
 * Supabase (facebook_pages.brand_id). Diese Datei holt die echten Werte und
 * KORRIGIERT damit den localStorage aktiv – sonst schlägt der alte Wert immer
 * wieder durch (u. a. weil cron/sync den localStorage-Wert nach Supabase pusht).
 *
 * Reihenfolge für die Marken-Zuordnung:
 *   1) Supabase-Wert (autoritativ)
 *   2) Namensabgleich (Seitenname ↔ Markenname)
 *   3) nichts (lieber leer als falsch)
 */

const STORAGE_KEY = 'gk-facebook-pages';

export interface SupabaseFbPage {
  page_id:  string;
  brand_id: string | null;
  name:     string | null;
}

interface BrandLike { id: string; name: string }

/** Robuster Vergleich zweier Brand-IDs – unabhängig vom Typ ('3' === 3). */
export function sameBrand(a: unknown, b: unknown): boolean {
  if (a == null || b == null) return false;
  return String(a) === String(b);
}

function norm(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Gehört eine Seite (über ihren Namen) zur aktiven Marke? Reiner Namensabgleich. */
export function nameBelongsToBrand(pageName: string | null | undefined, brandName: string | null | undefined): boolean {
  const pn = norm(pageName ?? '');
  const bn = norm(brandName ?? '');
  if (!pn || !bn) return false;
  return pn === bn || pn.includes(bn) || bn.includes(pn);
}

/** Namensabgleich Seite → Marken-ID (längster Treffer gewinnt). */
export function matchBrandIdByName(pageName: string | null | undefined, brands: BrandLike[]): string | undefined {
  const pn = norm(pageName ?? '');
  if (!pn) return undefined;
  const exact = brands.find(b => norm(b.name) === pn);
  if (exact) return exact.id;
  const partial = brands
    .filter(b => { const bn = norm(b.name); return pn.includes(bn) || bn.includes(pn); })
    .sort((a, b) => b.name.length - a.name.length)[0];
  return partial?.id;
}

// In-Flight-Request teilen, damit StoreHydration + beide Buttons nicht mehrfach laden.
let cachedPromise: Promise<SupabaseFbPage[] | null> | null = null;

/** Holt die echten Seiten-/Brand-Zuordnungen aus Supabase.
 *  Liefert null, wenn der Fetch fehlschlägt (→ Aufrufer nutzt Namensabgleich). */
export function fetchSupabaseFbPages(): Promise<SupabaseFbPage[] | null> {
  if (cachedPromise) return cachedPromise;
  cachedPromise = fetch('/api/facebook-pages')
    .then(r => (r.ok ? r.json() : null))
    .then(d => (d && Array.isArray(d.pages) ? (d.pages as SupabaseFbPage[]) : null))
    .catch(() => null);
  // Fehlschlag nicht cachen → nächster Aufruf darf erneut versuchen.
  cachedPromise.then(v => { if (v === null) cachedPromise = null; });
  return cachedPromise;
}

/** Bestimmt die korrekte Marken-ID einer Seite nach der Reihenfolge
 *  Supabase → Namensabgleich → undefined. */
export function resolveBrandId(
  pageId: string,
  pageName: string | null | undefined,
  supaMap: Map<string, string | null> | null,
  brands: BrandLike[],
): string | undefined {
  if (supaMap) {
    const supa = supaMap.get(pageId);
    if (supa != null) return String(supa);
  }
  return matchBrandIdByName(pageName, brands);
}

/** Überschreibt die brand_ids im localStorage dauerhaft mit den korrekten Werten.
 *  Nicht ermittelbare Zuordnungen werden geleert (entfernt die alte '3'), damit
 *  sie nicht erneut nach Supabase gepusht werden. */
export function correctLocalStorageBrandIds(supaPages: SupabaseFbPage[] | null, brands: BrandLike[]): void {
  if (typeof window === 'undefined') return;
  let local: Array<{ id: string; name?: string; brand_id?: string | null; [k: string]: unknown }>;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    local = raw ? JSON.parse(raw) : [];
  } catch { return; }
  if (!Array.isArray(local) || local.length === 0) return;

  const supaMap = supaPages ? new Map(supaPages.map(p => [p.page_id, p.brand_id])) : null;

  let changed = false;
  const corrected = local.map(p => {
    const next = resolveBrandId(p.id, p.name, supaMap, brands); // undefined wenn nicht ermittelbar
    if (next !== (p.brand_id ?? undefined)) {
      changed = true;
      return { ...p, brand_id: next };
    }
    return p;
  });

  if (changed) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(corrected)); } catch { /* ignore */ }
  }
}

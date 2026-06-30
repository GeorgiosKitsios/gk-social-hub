/**
 * lib/postFooter.ts
 *
 * Erzeugt den automatischen Footer unter jedem Post.
 *
 * Zwei Bestandteile:
 *  A) Cross-Promo-Footer – nennt die ANDEREN Konto-Marken (nie die eigene
 *     Absender-Marke) plus immer das private Reise-Profil @travel.georg.
 *  B) Marken-Pflichtangaben – inhaltliche Pflichtteile NUR für bestimmte Marken
 *     (aktuell GK Skill: @eliteskillsarena #TheUltimateMatchSimulator). Steht
 *     ÜBER dem Cross-Promo-Footer und erscheint nie unter anderen Marken.
 *
 * Der Footer lebt im Editor in einem eigenen Feld (Post.footerText). Beim
 * Speichern/Planen wird er via applyFooterToPost in den geposteten Text
 * (main_text bzw. platform_texts) einkomponiert – das ist exakt das, was der
 * Cron rausschickt. So kann der Footer nicht still verloren gehen.
 *
 * Schreibregel: keine Binde-/Gedankenstriche im Fließtext. Hashtags bleiben
 * unverändert.
 */

import type { Brand, Post } from '@/lib/types';

/** Konto-Marken in fester Anzeige-Reihenfolge (FC Hellas, GK Skill, GK Pokale). */
const ACCOUNT_BRAND_IDS = ['1', '2', '3'];

/** Eigenes Emoji pro Marke für den Footer. */
const BRAND_EMOJI: Record<string, string> = {
  '1': '⚽',  // FC Hellas München
  '2': '🧤',  // GK Skill Systems (Torwarttraining)
  '3': '🏆',  // GK Pokale
};

/** Privates Reise-Profil – immer am Ende, als reiner Text-Handle (keine Marke). */
const TRAVEL_HANDLE = '✈️ @travel.georg';

/** Marken-spezifische Pflichtangaben (nur diese Marken-IDs). */
const BRAND_MANDATORY: Record<string, string> = {
  '2': '@eliteskillsarena #TheUltimateMatchSimulator', // GK Skill
};

/** A) Cross-Promo-Zeile: andere Konto-Marken + @travel.georg, eine Zeile. */
export function buildCrossPromoFooter(senderBrandId: string | undefined, brands: Brand[]): string {
  const parts = ACCOUNT_BRAND_IDS
    .filter(id => id !== senderBrandId)
    .map(id => {
      const handle = brands.find(b => b.id === id)?.instagramHandle;
      if (!handle) return null;
      const emoji = BRAND_EMOJI[id] ?? '';
      return `${emoji} ${handle}`.trim();
    })
    .filter((x): x is string => Boolean(x));

  parts.push(TRAVEL_HANDLE);
  return `Mehr von GK: ${parts.join(' · ')}`;
}

/** B) Marken-Pflichtangabe (leer, wenn die Marke keine hat). */
export function buildBrandMandatory(senderBrandId: string | undefined): string {
  return senderBrandId ? (BRAND_MANDATORY[senderBrandId] ?? '') : '';
}

/** Kompletter Footer-Block: Pflichtangabe (oben) + Cross-Promo (unten). */
export function buildFullFooter(senderBrandId: string | undefined, brands: Brand[]): string {
  const mandatory  = buildBrandMandatory(senderBrandId);
  const crossPromo = buildCrossPromoFooter(senderBrandId, brands);
  return [mandatory, crossPromo].filter(Boolean).join('\n');
}

/** Hängt den Footer an einen Text an (zwei Leerzeilen Abstand). */
export function appendFooter(text: string | undefined, footer: string | undefined): string {
  const t = (text ?? '').trimEnd();
  const f = (footer ?? '').trim();
  if (!f) return text ?? '';
  return t ? `${t}\n\n${f}` : f;
}

/**
 * Baut den Footer in den geposteten Text ein: main_text UND alle gesetzten
 * platform-spezifischen Texte. Genau dieses Objekt geht an /api/cron/sync und
 * landet in Supabase – also in dem, was der Cron postet.
 *
 * Gibt eine Kopie zurück; der lokale Post (eigenes footerText-Feld) bleibt
 * unverändert, damit beim erneuten Planen nicht doppelt angehängt wird.
 */
export function applyFooterToPost(post: Post): Post {
  const footer = (post.footerText ?? '').trim();
  if (!footer) return post;

  const platformTexts: Post['platformTexts'] = { ...(post.platformTexts ?? {}) };
  for (const key of Object.keys(platformTexts) as Array<keyof Post['platformTexts']>) {
    const v = platformTexts[key];
    if (v && v.trim()) platformTexts[key] = appendFooter(v, footer);
  }

  return {
    ...post,
    mainText:      appendFooter(post.mainText, footer),
    platformTexts,
  };
}

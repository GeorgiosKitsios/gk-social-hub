/**
 * app/api/ai/captions/route.ts
 *
 * Bild-Analyse + Caption-Generierung über Claude Vision (Server-Route).
 *
 * POST { imageUrl, brandId, brandName, tone, platforms, templates }
 * → { variants: [{ hook, text, hashtags, cta }, ×3] }
 *
 * Nutzt ANTHROPIC_API_KEY (server-only) – NICHT den NEXT_PUBLIC_-Key,
 * der weiterhin für die 4 bestehenden Client-Modi in lib/aiService.ts dient.
 */

import { NextRequest, NextResponse } from 'next/server';
import { CLAUDE_MODEL } from '@/lib/aiModel';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';
const MODEL         = CLAUDE_MODEL;

interface TemplatePayload {
  type:    string;   // 'footer' | 'hashtag_set' | 'text' | 'cta'
  name:    string;
  content: string;
}

interface CaptionVariant {
  hook:     string;
  text:     string;
  hashtags: string;
  cta:      string;
}

const TONE_INSTRUCTION: Record<string, string> = {
  professionell: 'Schreibe sachlich, klar und professionell.',
  locker:        'Schreibe locker, freundlich und nahbar.',
  motivierend:   'Schreibe energetisch, motivierend und inspirierend.',
  aggressiv:     'Schreibe direkt, selbstbewusst und provokativ.',
};

const PLATFORM_HINTS: Record<string, string> = {
  instagram: 'Instagram: max. 2200 Zeichen, Emojis erwünscht',
  facebook:  'Facebook: etwas ausführlicher erlaubt, persönlicher Ton',
  tiktok:    'TikTok: sehr kurz, Hook am Anfang, jugendliche Sprache',
};

function buildPrompt(
  brandName: string,
  brandDescription: string,
  tone: string,
  platforms: string[],
  templates: TemplatePayload[],
): string {
  const toneStr = TONE_INSTRUCTION[tone] ?? TONE_INSTRUCTION.professionell;
  const platStr = platforms.map(p => PLATFORM_HINTS[p]).filter(Boolean).join(' · ');

  // Templates nach Typ gruppieren für den Prompt
  const byType = (type: string) =>
    templates.filter(t => t.type === type).map(t => `- ${t.name}: ${t.content}`).join('\n');

  const hashtagSets = byType('hashtag_set');
  const ctas        = byType('cta');
  const footers     = byType('footer');
  const textTpls    = byType('text');

  return [
    // ── 1. Marken-Kontext ──
    `Du bist ein Social-Media-Texter für die Marke "${brandName}".`,
    brandDescription.trim() ? `Über die Marke:\n${brandDescription.trim()}` : '',
    toneStr,
    platStr ? `Plattform-Hinweise: ${platStr}` : '',
    'Sprache: Deutsch.',
    '',
    // ── 2. Markenspezifische Vorlagen ──
    'Vorlagen der Marke (nutze sie als Stilreferenz und übernimm passende Hashtags/CTAs daraus):',
    hashtagSets ? `\nHashtag-Sets:\n${hashtagSets}` : '',
    ctas        ? `\nCTAs:\n${ctas}`                : '',
    footers     ? `\nFooter:\n${footers}`           : '',
    textTpls    ? `\nText-Vorlagen (Stilreferenz):\n${textTpls}` : '',
    '',
    // ── 3. Bild-Analyse-Auftrag ──
    'Analysiere das beigefügte Bild und erstelle GENAU 3 verschiedene Caption-Varianten für einen Social-Media-Post zu diesem Bild.',
    'Jede Variante hat einen anderen Ansatz (z. B. emotional, informativ, direkt).',
    '',
    'WICHTIG – Formatierung: Verwende in hook, text, hashtags und cta NIEMALS Markdown – keine Sternchen, keine Unterstriche, kein Fettdruck. Social-Media-Posts sind reiner Text mit Emojis.',
    'WICHTIG – Fakten: Erfinde NIEMALS URLs, Domains, Preise, Telefonnummern oder Adressen. Verwende nur Angaben, die in den oben mitgelieferten Vorlagen stehen. Wenn dort keine URL vorkommt, schreibe keine URL in den Text.',
    'WICHTIG – Keine Beschriftungen: hook, text, hashtags und cta dürfen KEINE Beschriftungen, Präfixe oder Überschriften enthalten wie "Instagram:", "Instagram-Post:", "Caption:", "Variante 1 – Nutzen/Mehrwert:" oder Ähnliches. Nur der reine Post-Text.',
    '',
    'Antworte AUSSCHLIESSLICH mit validem JSON in exakt diesem Format, ohne Markdown-Codeblock, ohne Erklärung:',
    '[',
    '  { "hook": "Aufmerksamkeitsstarker erster Satz", "text": "Haupttext der Caption (1-3 Absätze, passende Emojis)", "hashtags": "#tag1 #tag2 ...", "cta": "Call-to-Action Satz" },',
    '  { ... Variante 2 ... },',
    '  { ... Variante 3 ... }',
    ']',
  ].filter(line => line !== '').join('\n');
}

/** Entfernt Markdown-Codefences und parst das JSON-Array robust. */
function parseVariants(raw: string): CaptionVariant[] {
  let text = raw.trim();
  // Codefences entfernen falls Claude sie doch setzt
  text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  // Falls Text vor/nach dem Array steht: Array-Teil extrahieren
  const start = text.indexOf('[');
  const end   = text.lastIndexOf(']');
  if (start >= 0 && end > start) text = text.slice(start, end + 1);

  const parsed = JSON.parse(text);
  if (!Array.isArray(parsed)) throw new Error('Antwort ist kein Array');

  return parsed.slice(0, 3).map((v: Record<string, unknown>) => ({
    hook:     String(v.hook     ?? ''),
    text:     String(v.text     ?? ''),
    hashtags: String(v.hashtags ?? ''),
    cta:      String(v.cta      ?? ''),
  }));
}

export async function POST(req: NextRequest) {
  console.log('[AI/captions] ── Request gestartet ──');

  // ── API-Key prüfen (server-only) ────────────────────────────────────────────
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('[AI/captions] ANTHROPIC_API_KEY nicht gesetzt');
    return NextResponse.json({
      error: 'ANTHROPIC_API_KEY ist nicht konfiguriert. Bitte in Hostinger Env-Variablen setzen (ohne NEXT_PUBLIC_).',
    }, { status: 500 });
  }

  // ── Body lesen ──────────────────────────────────────────────────────────────
  let imageUrl: string, brandName: string, brandDescription: string, tone: string,
      platforms: string[], templates: TemplatePayload[];
  try {
    const body = await req.json();
    imageUrl   = body.imageUrl  ?? '';
    brandName  = body.brandName ?? body.brandId ?? 'Marke';
    brandDescription = typeof body.brandDescription === 'string' ? body.brandDescription : '';
    tone       = body.tone      ?? 'professionell';
    platforms  = Array.isArray(body.platforms) ? body.platforms : [];
    templates  = Array.isArray(body.templates) ? body.templates : [];
  } catch {
    return NextResponse.json({ error: 'Ungültiger Request-Body.' }, { status: 400 });
  }

  if (!imageUrl || !imageUrl.startsWith('https://')) {
    return NextResponse.json({
      error: 'imageUrl muss eine öffentliche HTTPS-URL sein (Bild zuerst in die Medienbibliothek hochladen).',
    }, { status: 400 });
  }

  console.log('[AI/captions] Parameter:', {
    imageUrl:  imageUrl.slice(0, 70),
    brandName, tone, platforms,
    templates: templates.length,
  });

  // ── Claude Vision aufrufen ──────────────────────────────────────────────────
  const prompt = buildPrompt(brandName, brandDescription, tone, platforms, templates);

  let anthropicRes: Response;
  try {
    anthropicRes = await fetch(ANTHROPIC_API, {
      method:  'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      MODEL,
        max_tokens: 2048,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'url', url: imageUrl } },
            { type: 'text',  text: prompt },
          ],
        }],
      }),
    });
  } catch (err) {
    console.error('[AI/captions] Netzwerkfehler:', err);
    return NextResponse.json({ error: 'Netzwerkfehler beim Anthropic-API-Aufruf.' }, { status: 500 });
  }

  const data = await anthropicRes.json();

  if (!anthropicRes.ok || data.error) {
    const msg = data.error?.message ?? `HTTP ${anthropicRes.status}`;
    console.error('[AI/captions] Anthropic-Fehler:', msg);
    return NextResponse.json({ error: `Claude-Fehler: ${msg}` }, { status: 500 });
  }

  const raw = (data.content ?? [])
    .filter((b: { type: string }) => b.type === 'text')
    .map((b: { text: string }) => b.text)
    .join('\n');

  // ── Antwort parsen ──────────────────────────────────────────────────────────
  let variants: CaptionVariant[];
  try {
    variants = parseVariants(raw);
  } catch (err) {
    console.error('[AI/captions] Parse-Fehler. Rohantwort:', raw.slice(0, 300));
    return NextResponse.json({
      error: 'Claude-Antwort konnte nicht als JSON geparst werden. Bitte erneut versuchen.',
    }, { status: 500 });
  }

  if (variants.length === 0) {
    return NextResponse.json({ error: 'Keine Varianten in der Antwort.' }, { status: 500 });
  }

  console.log(`[AI/captions] ✓ ${variants.length} Varianten generiert`);
  return NextResponse.json({ variants });
}

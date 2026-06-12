import Anthropic from '@anthropic-ai/sdk';
import { CLAUDE_MODEL } from '@/lib/aiModel';

export type AiMode = 'text' | 'variants' | 'hooks' | 'hashtags';

// AiTone direkt hier definiert (kein Re-Export aus types.ts)
export type AiTone = 'professionell' | 'locker' | 'motivierend' | 'aggressiv';

export interface AiRequest {
  prompt:    string;
  mode:      AiMode;
  tone:      AiTone;
  brand:     string;
  brandDescription?: string;
  platforms: string[];
  language?: string;
}

export interface AiResult {
  mode:  AiMode;
  items: string[];
}

function toneInstruction(tone: AiTone): string {
  const map: Record<AiTone, string> = {
    professionell: 'Schreibe sachlich, klar und professionell.',
    locker:        'Schreibe locker, freundlich und nahbar.',
    motivierend:   'Schreibe energetisch, motivierend und inspirierend.',
    aggressiv:     'Schreibe direkt, selbstbewusst und provokativ.',
  };
  return map[tone];
}

function platformHints(platforms: string[]): string {
  const hints: Record<string, string> = {
    instagram: 'Instagram: max. 2200 Zeichen, Emojis erwünscht',
    facebook:  'Facebook: etwas ausführlicher erlaubt, persönlicher Ton',
    tiktok:    'TikTok: sehr kurz, Hook am Anfang, jugendliche Sprache',
  };
  return platforms.map(p => hints[p]).filter(Boolean).join(' · ') || '';
}

function buildPrompt(req: AiRequest): string {
  const lang    = req.language ?? 'de';
  const langStr = lang === 'de' ? 'Deutsch' : 'English';
  const tone    = toneInstruction(req.tone);
  const plat    = platformHints(req.platforms);

  const base = [
    `Du bist ein Social-Media-Texter für die Marke "${req.brand}".`,
    req.brandDescription?.trim() ? `Über die Marke:\n${req.brandDescription.trim()}` : '',
    tone,
    plat ? `Plattform-Hinweise: ${plat}` : '',
    `Sprache: ${langStr}.`,
    `Thema / Kontext: ${req.prompt}`,
    'Antworte NUR mit dem angeforderten Inhalt, ohne Einleitung oder Erklärung.',
    'WICHTIG – Formatierung: Verwende NIEMALS Markdown – keine Sternchen, keine Unterstriche, kein Fettdruck. Social-Media-Posts sind reiner Text mit Emojis.',
    'WICHTIG – Fakten: Erfinde NIEMALS URLs, Domains, Preise, Telefonnummern oder Adressen. Verwende nur Angaben, die im Thema/Kontext ausdrücklich genannt sind. Wenn keine URL mitgeliefert wurde, schreibe keine URL in den Text.',
    'WICHTIG – Keine Beschriftungen: Die Antwort darf KEINE Beschriftungen, Präfixe oder Überschriften enthalten wie "Instagram:", "Instagram-Post:", "Caption:", "Variante 1 – Nutzen/Mehrwert:" oder Ähnliches. Nur der reine Post-Text.',
  ].filter(Boolean).join('\n');

  const instructions: Record<AiMode, string> = {
    text:     `${base}\n\nErstelle einen fertig verwendbaren Social-Media-Post-Text (1–4 Absätze, mit passenden Emojis).`,
    variants: `${base}\n\nErstelle genau 3 verschiedene Post-Text-Varianten.\nTrenne sie mit einer Leerzeile und "---".\nJede Variante soll einen anderen Ansatz haben.`,
    hooks:    `${base}\n\nErstelle genau 5 starke Hook-Sätze.\nEinen Hook pro Zeile, nummeriert 1–5. Keine weiteren Erklärungen.`,
    hashtags: `${base}\n\nErstelle 15–20 passende Hashtags.\nNur die Hashtags, mit # davor, durch Leerzeichen getrennt.`,
  };

  return instructions[req.mode];
}

function parseResponse(mode: AiMode, raw: string): string[] {
  const text = raw.trim();
  if (mode === 'text')     return [text];
  if (mode === 'variants') return text.split(/\n---\n|^---$/m).map(s => s.trim()).filter(Boolean);
  if (mode === 'hooks')    return text.split('\n').map(l => l.replace(/^\d+\.\s*/, '').trim()).filter(Boolean);
  if (mode === 'hashtags') return text.split(/[\s,]+/).map(t => t.trim()).filter(t => t.startsWith('#') && t.length > 1);
  return [text];
}

export async function generateAiContent(req: AiRequest): Promise<AiResult> {
  const apiKey = process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('Kein API-Key. Bitte NEXT_PUBLIC_ANTHROPIC_API_KEY in .env.local setzen.');
  }

  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });

  const message = await client.messages.create({
    model:      CLAUDE_MODEL,
    max_tokens: 1024,
    messages:   [{ role: 'user', content: buildPrompt(req) }],
  });

  const raw = message.content
    .filter(b => b.type === 'text')
    .map(b => (b as { type: 'text'; text: string }).text)
    .join('\n');

  return { mode: req.mode, items: parseResponse(req.mode, raw) };
}

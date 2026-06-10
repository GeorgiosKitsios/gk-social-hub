'use client';
import { useState } from 'react';
import { generateAiContent, AiMode, AiTone } from '@/lib/aiService';
import { useMediaStore }    from '@/store/useMediaStore';
import { useTemplateStore } from '@/store/useTemplateStore';

interface CaptionVariant {
  hook:     string;
  text:     string;
  hashtags: string;
  cta:      string;
}

const MODE_BUTTONS: { mode: AiMode; label: string; hint: string }[] = [
  { mode:'text',     label:'Text generieren', hint:'1 fertiger Post'      },
  { mode:'variants', label:'3 Varianten',     hint:'3 verschiedene Texte' },
  { mode:'hooks',    label:'Hooks',           hint:'5 Eröffnungssätze'    },
  { mode:'hashtags', label:'Hashtags',        hint:'15–20 Hashtags'       },
];
const MODE_COLORS: Record<AiMode,string> = {
  text:     'bg-blue-500/10  text-blue-400  border-blue-500/40',
  variants: 'bg-purple-500/10 text-purple-400 border-purple-500/40',
  hooks:    'bg-amber-500/10 text-amber-400  border-amber-500/40',
  hashtags: 'bg-teal-500/10  text-teal-400  border-teal-500/40',
};

export default function AiAssistant({ brandName, tone, platforms, language='de', onInsert, brandId, mediaIds = [] }: { brandName: string; tone: AiTone; platforms: string[]; language?: string; onInsert: (text: string) => void; brandId?: string; mediaIds?: string[] }) {
  const [prompt, setPrompt]   = useState('');
  const [loading, setLoading] = useState<AiMode|null>(null);
  const [results, setResults] = useState<{ mode: AiMode; items: string[] }|null>(null);
  const [error, setError]     = useState<string|null>(null);
  const [open, setOpen]       = useState(false);

  // Caption-aus-Bild State
  const [captionLoading, setCaptionLoading] = useState(false);
  const [captionResults, setCaptionResults] = useState<CaptionVariant[]|null>(null);

  const { getById: getMediaById }  = useMediaStore();
  const { getTemplatesForBrand }   = useTemplateStore();

  // Erstes Bild aus den Post-Medien (nur Bilder mit HTTPS-URL sind für Vision nutzbar)
  const firstImage = mediaIds
    .map(id => getMediaById(id))
    .find(m => m?.type === 'image' && m.url?.startsWith('https://'));

  async function run(mode: AiMode) {
    if (!prompt.trim()) { setError('Bitte zuerst einen Kontext eingeben.'); return; }
    setError(null); setLoading(mode); setResults(null);
    try {
      const res = await generateAiContent({ prompt:prompt.trim(), mode, tone, brand:brandName, platforms, language });
      setResults(res);
    } catch(e: unknown) { setError(e instanceof Error ? e.message : 'Unbekannter Fehler.'); }
    finally { setLoading(null); }
  }

  async function runCaptionFromImage() {
    if (!firstImage) return;
    setError(null); setCaptionLoading(true); setCaptionResults(null); setResults(null);
    try {
      const templates = brandId
        ? getTemplatesForBrand(brandId).map(t => ({ type: t.type, name: t.name, content: t.content }))
        : [];

      const res  = await fetch('/api/ai/captions', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl: firstImage.url,
          brandId,
          brandName,
          tone,
          platforms,
          templates,
        }),
      });
      const data = await res.json();

      if (!res.ok || data.error) throw new Error(String(data.error ?? `HTTP ${res.status}`));
      if (!Array.isArray(data.variants) || data.variants.length === 0) {
        throw new Error('Keine Varianten erhalten.');
      }
      setCaptionResults(data.variants);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Bild-Analyse fehlgeschlagen.');
    } finally {
      setCaptionLoading(false);
    }
  }

  function insertCaptionVariant(v: CaptionVariant) {
    const parts = [v.hook, v.text].filter(Boolean).join('\n\n');
    const full  = v.hashtags ? `${parts}\n\n${v.hashtags}` : parts;
    onInsert(full);
  }

  return (
    <div className="border border-neutral-700 rounded-xl overflow-hidden">
      <button onClick={() => setOpen(o=>!o)} className="w-full flex items-center justify-between px-4 py-3 bg-neutral-800 text-sm text-neutral-300 hover:text-white transition-colors">
        <div className="flex items-center gap-2"><span className="text-base">✦</span><span>KI-Assistent</span>{!open&&results&&<span className="text-xs text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full">{results.items.length} Vorschläge</span>}</div>
        <span className="text-neutral-500">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="bg-neutral-900 p-4 flex flex-col gap-4">
          <div>
            <label className="block text-xs text-neutral-400 mb-1.5">Kontext / Thema</label>
            <input type="text" value={prompt} onChange={e=>{setPrompt(e.target.value);setError(null);}} onKeyDown={e=>e.key==='Enter'&&!loading&&run('text')} placeholder='z. B. „Spieltagsankündigung"' className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-blue-500" disabled={!!loading} />
            {error && <p className="text-xs text-red-400 mt-1.5">{error}</p>}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {MODE_BUTTONS.map(({mode,label,hint}) => (
              <button key={mode} onClick={() => run(mode)} disabled={!!loading} className={`flex flex-col items-start px-3 py-2.5 rounded-lg border text-left transition-all ${loading===mode ? MODE_COLORS[mode]+' animate-pulse' : loading ? 'border-neutral-700 text-neutral-600 cursor-not-allowed' : `${MODE_COLORS[mode]} hover:brightness-125`}`}>
                <span className="text-xs font-medium">{loading===mode ? 'Generiere...' : label}</span>
                <span className="text-xs opacity-60 mt-0.5">{hint}</span>
              </button>
            ))}
          </div>
          {/* Caption aus Bild – nur wenn ein Bild am Post hängt */}
          {firstImage && (
            <button
              onClick={runCaptionFromImage}
              disabled={captionLoading || !!loading}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-all ${
                captionLoading
                  ? 'bg-pink-500/10 text-pink-400 border-pink-500/40 animate-pulse'
                  : loading
                  ? 'border-neutral-700 text-neutral-600 cursor-not-allowed'
                  : 'bg-pink-500/10 text-pink-400 border-pink-500/40 hover:brightness-125'
              }`}
            >
              <img src={firstImage.thumbnailUrl || firstImage.url} alt="" className="w-8 h-8 rounded object-cover shrink-0" />
              <div className="flex flex-col">
                <span className="text-xs font-medium">{captionLoading ? 'Bild wird analysiert…' : '📸 Caption aus Bild'}</span>
                <span className="text-xs opacity-60 mt-0.5">3 Varianten mit Hook, Hashtags &amp; CTA</span>
              </div>
            </button>
          )}

          {loading && <div className="flex items-center gap-2 text-xs text-neutral-400"><div className="w-3 h-3 border border-blue-500 border-t-transparent rounded-full animate-spin" />Claude denkt nach...</div>}
          {captionLoading && <div className="flex items-center gap-2 text-xs text-neutral-400"><div className="w-3 h-3 border border-pink-500 border-t-transparent rounded-full animate-spin" />Bild wird analysiert – Claude erstellt 3 Caption-Varianten…</div>}

          {/* Caption-Varianten */}
          {captionResults && !captionLoading && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-neutral-400 font-medium">{captionResults.length} Caption-Varianten aus Bild</span>
                <button onClick={() => setCaptionResults(null)} className="text-xs text-neutral-600 hover:text-neutral-400 transition-colors">Verwerfen</button>
              </div>
              <div className="flex flex-col gap-2 max-h-96 overflow-y-auto">
                {captionResults.map((v, i) => (
                  <div key={i} className="p-3 rounded-lg border bg-pink-500/10 border-pink-500/40 flex flex-col gap-2">
                    <p className="text-xs font-semibold text-white">{v.hook}</p>
                    <p className="text-xs text-neutral-300 leading-relaxed whitespace-pre-wrap line-clamp-4">{v.text}</p>
                    {v.cta && <p className="text-xs text-pink-300">{v.cta}</p>}
                    {v.hashtags && <p className="text-xs text-teal-400 break-words">{v.hashtags}</p>}
                    <button onClick={() => insertCaptionVariant(v)} className="self-end text-xs px-3 py-1 rounded-md bg-white/10 hover:bg-white/20 text-white transition-colors">↩ Übernehmen</button>
                  </div>
                ))}
              </div>
            </div>
          )}
          {results && !loading && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between"><span className="text-xs text-neutral-400 font-medium">{results.items.length} Vorschläge · {MODE_BUTTONS.find(b=>b.mode===results.mode)?.label}</span><button onClick={()=>setResults(null)} className="text-xs text-neutral-600 hover:text-neutral-400 transition-colors">Verwerfen</button></div>
              <div className={`flex flex-col gap-2 ${results.items.length>3 ? 'max-h-64 overflow-y-auto' : ''}`}>
                {results.items.map((item,i) => (
                  <div key={i} className={`p-3 rounded-lg border ${MODE_COLORS[results.mode]} flex flex-col gap-2`}>
                    <p className={`text-xs text-white leading-relaxed ${results.mode==='hashtags' ? '' : 'whitespace-pre-wrap line-clamp-4'}`}>{item}</p>
                    <button onClick={() => onInsert(item)} className="self-end text-xs px-3 py-1 rounded-md bg-white/10 hover:bg-white/20 text-white transition-colors">↩ Übernehmen</button>
                  </div>
                ))}
              </div>
            </div>
          )}
          <p className="text-xs text-neutral-700">Tonalität: <span className="text-neutral-500">{tone}</span> · Marke: <span className="text-neutral-500">{brandName}</span></p>
        </div>
      )}
    </div>
  );
}

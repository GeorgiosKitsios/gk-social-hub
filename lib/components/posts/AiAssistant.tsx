DATEI: components/posts/AiAssistant.tsx
// ============================================================
'use client';
import { useState } from 'react';
import { generateAiContent, AiMode, AiTone } from '@/lib/aiService';

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

export default function AiAssistant({ brandName, tone, platforms, language='de', onInsert }: { brandName: string; tone: AiTone; platforms: string[]; language?: string; onInsert: (text: string) => void }) {
  const [prompt, setPrompt]   = useState('');
  const [loading, setLoading] = useState<AiMode|null>(null);
  const [results, setResults] = useState<{ mode: AiMode; items: string[] }|null>(null);
  const [error, setError]     = useState<string|null>(null);
  const [open, setOpen]       = useState(false);

  async function run(mode: AiMode) {
    if (!prompt.trim()) { setError('Bitte zuerst einen Kontext eingeben.'); return; }
    setError(null); setLoading(mode); setResults(null);
    try {
      const res = await generateAiContent({ prompt:prompt.trim(), mode, tone, brand:brandName, platforms, language });
      setResults(res);
    } catch(e: unknown) { setError(e instanceof Error ? e.message : 'Unbekannter Fehler.'); }
    finally { setLoading(null); }
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
          {loading && <div className="flex items-center gap-2 text-xs text-neutral-400"><div className="w-3 h-3 border border-blue-500 border-t-transparent rounded-full animate-spin" />Claude denkt nach...</div>}
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

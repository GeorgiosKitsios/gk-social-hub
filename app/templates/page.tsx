'use client';
import { useState } from 'react';
import { useTemplateStore } from '@/store/useTemplateStore';
import { useBrandStore }    from '@/store/useBrandStore';
import { Template, TemplateType } from '@/lib/types';
import TemplateModal from '@/components/templates/TemplateModal';

const TABS: { value: TemplateType | 'all'; label: string }[] = [
  { value: 'all', label: 'Alle' }, { value: 'footer', label: 'Footer' },
  { value: 'hashtag_set', label: 'Hashtag-Sets' }, { value: 'text', label: 'Texte' }, { value: 'cta', label: 'CTAs' },
];
const TYPE_LABEL: Record<TemplateType, string> = { footer: 'Footer', hashtag_set: 'Hashtag-Set', text: 'Text', cta: 'CTA' };
const TYPE_COLOR: Record<TemplateType, string> = { footer: 'bg-neutral-700 text-neutral-300', hashtag_set: 'bg-blue-500/20 text-blue-400', text: 'bg-purple-500/20 text-purple-400', cta: 'bg-amber-500/20 text-amber-400' };

function TemplateCard({ template, brandName, onEdit }: { template: Template; brandName?: string; onEdit: (t: Template) => void }) {
  const [copied, setCopied] = useState(false);
  function handleCopy() { navigator.clipboard.writeText(template.content); setCopied(true); setTimeout(() => setCopied(false), 1500); }
  return (
    <div className="bg-neutral-800 border border-neutral-700 rounded-xl p-4 flex flex-col gap-3 hover:border-neutral-500 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-medium text-white truncate">{template.name}</div>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            <span className={`text-xs px-2 py-0.5 rounded-full ${TYPE_COLOR[template.type]}`}>{TYPE_LABEL[template.type]}</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-neutral-700 text-neutral-400 truncate max-w-[120px]">{template.scope === 'global' ? 'Global' : (brandName ?? 'Marke')}</span>
          </div>
        </div>
        <button onClick={() => onEdit(template)} className="text-neutral-500 hover:text-white text-sm shrink-0 transition-colors px-1">✎</button>
      </div>
      <p className="text-xs text-neutral-400 leading-relaxed line-clamp-3 whitespace-pre-wrap">{template.content}</p>
      <div className="flex items-center justify-between gap-2 mt-auto">
        <div className="flex gap-1">{template.platforms.map(p => <span key={p} className="text-xs px-1.5 py-0.5 rounded bg-neutral-700 text-neutral-400">{p==='facebook'?'FB':p==='instagram'?'IG':'TK'}</span>)}</div>
        <button onClick={handleCopy} className={`text-xs px-3 py-1 rounded-md border transition-colors ${copied ? 'border-green-500 text-green-400' : 'border-neutral-600 text-neutral-400 hover:text-white hover:border-neutral-400'}`}>{copied ? '✓ Kopiert' : 'Kopieren'}</button>
      </div>
    </div>
  );
}

export default function TemplatesPage() {
  const { templates } = useTemplateStore();
  const { brands, activeBrandId } = useBrandStore();
  const [activeTab, setActiveTab]   = useState<TemplateType | 'all'>('all');
  const [scopeFilter, setScopeFilter] = useState<'all' | 'global' | 'brand'>('all');
  const [modalMode, setModalMode]   = useState<Template | 'new' | null>(null);
  const activeBrand = brands.find(b => b.id === activeBrandId);

  const filtered = templates.filter(t => {
    const matchTab   = activeTab === 'all' || t.type === activeTab;
    const matchScope = scopeFilter==='all' ? true : scopeFilter==='global' ? t.scope==='global' : t.brandId===activeBrandId;
    return matchTab && matchScope;
  });

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-xl font-semibold text-white">Vorlagen</h1><p className="text-sm text-neutral-400 mt-0.5">{filtered.length} Vorlagen</p></div>
        <button onClick={() => setModalMode('new')} className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">+ Neue Vorlage</button>
      </div>
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="flex gap-1 bg-neutral-800 p-1 rounded-lg">
          {TABS.map(tab => <button key={tab.value} onClick={() => setActiveTab(tab.value)} className={`px-3 py-1 text-xs rounded-md transition-colors ${activeTab===tab.value ? 'bg-neutral-600 text-white' : 'text-neutral-400 hover:text-white'}`}>{tab.label}</button>)}
        </div>
        <div className="flex gap-1 bg-neutral-800 p-1 rounded-lg">
          {([['all','Alle'],['global','Global'],['brand', activeBrand?.name ?? 'Marke']] as const).map(([v, l]) => (
            <button key={v} onClick={() => setScopeFilter(v)} className={`px-3 py-1 text-xs rounded-md transition-colors max-w-[140px] truncate ${scopeFilter===v ? 'bg-neutral-600 text-white' : 'text-neutral-400 hover:text-white'}`}>{l}</button>
          ))}
        </div>
      </div>
      {filtered.length > 0
        ? <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{filtered.map(t => <TemplateCard key={t.id} template={t} brandName={brands.find(b=>b.id===t.brandId)?.name} onEdit={t => setModalMode(t)} />)}</div>
        : <div className="text-center py-16 text-neutral-500"><p className="text-sm">Keine Vorlagen gefunden.</p><button onClick={() => setModalMode('new')} className="mt-3 text-sm text-blue-400 hover:text-blue-300">Erste Vorlage anlegen →</button></div>
      }
      <TemplateModal mode={modalMode} onClose={() => setModalMode(null)} />
    </div>
  );
}

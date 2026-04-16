'use client';
import { Brand } from '@/lib/types';
import { useBrandStore } from '@/store/useBrandStore';
import { BrandAvatar } from '@/components/layout/Topbar';

const PLATFORM_LABEL: Record<string,string> = { facebook:'FB', instagram:'IG', tiktok:'TK' };

export default function BrandCard({ brand, onEdit }: { brand: Brand; onEdit: (b: Brand) => void }) {
  const { setActiveBrand, activeBrandId } = useBrandStore();
  const isActive = brand.id === activeBrandId;
  return (
    <div className="bg-neutral-800 border border-neutral-700 rounded-xl p-4 flex flex-col gap-3 hover:border-neutral-500 transition-colors" style={{ borderLeftColor: brand.color, borderLeftWidth: 3 }}>
      <div className="flex items-center gap-3">
        <BrandAvatar brand={brand} size={36} />
        <div className="min-w-0"><div className="text-sm font-medium text-white truncate">{brand.name}</div><div className="text-xs text-neutral-400">{brand.industry}</div></div>
      </div>
      <div className="flex gap-1.5 flex-wrap">
        {brand.platforms.map(p => <span key={p} className="text-xs px-2 py-0.5 rounded-full bg-neutral-700 text-neutral-300">{PLATFORM_LABEL[p]}</span>)}
        {brand.platforms.length===0 && <span className="text-xs text-neutral-500">Keine Plattformen</span>}
      </div>
      <div className="flex gap-2 mt-auto pt-1">
        <button onClick={() => setActiveBrand(brand.id)} className={`flex-1 text-xs py-1.5 rounded-md border transition-colors ${isActive ? 'border-blue-500 bg-blue-500/10 text-blue-400' : 'border-neutral-600 text-neutral-400 hover:text-white hover:border-neutral-400'}`}>{isActive ? '✓ Aktiv' : 'Aktivieren'}</button>
        <button onClick={() => onEdit(brand)} className="px-3 text-xs py-1.5 rounded-md border border-neutral-600 text-neutral-400 hover:text-white hover:border-neutral-400 transition-colors">✎ Bearbeiten</button>
      </div>
    </div>
  );
}

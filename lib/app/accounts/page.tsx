DATEI: app/accounts/page.tsx
// ============================================================
'use client';
import { useBrandStore } from '@/store/useBrandStore';
import { BrandAvatar }   from '@/components/layout/Topbar';

const PLATFORMS = [{ id: 'facebook', label: 'Facebook' }, { id: 'instagram', label: 'Instagram' }, { id: 'tiktok', label: 'TikTok' }];

export default function AccountsPage() {
  const { brands } = useBrandStore();
  const active = brands.filter(b => !b.archived);
  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-8"><h1 className="text-xl font-semibold text-white">Konten & Verbindungen</h1><p className="text-sm text-neutral-400 mt-0.5">Social-Media-Accounts pro Marke</p></div>
      <div className="flex flex-col gap-4">
        {active.map(brand => (
          <div key={brand.id} className="bg-neutral-800 border border-neutral-700 rounded-xl p-4" style={{ borderLeftColor: brand.color, borderLeftWidth: 3 }}>
            <div className="flex items-center gap-3 mb-4"><BrandAvatar brand={brand} size={32} /><div><div className="text-sm font-medium text-white">{brand.name}</div><div className="text-xs text-neutral-400">{brand.industry}</div></div></div>
            <div className="flex flex-col gap-2">
              {PLATFORMS.map(p => {
                const connected = brand.platforms.includes(p.id as 'facebook'|'instagram'|'tiktok');
                return (
                  <div key={p.id} className="flex items-center justify-between py-2 border-t border-neutral-700/50">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-neutral-300 w-20">{p.label}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${connected ? 'bg-green-500/20 text-green-400' : 'bg-neutral-700 text-neutral-500'}`}>{connected ? '✓ Aktiv' : '– Nicht verbunden'}</span>
                    </div>
                    <span className="text-xs text-neutral-600 italic">OAuth folgt in Phase 2</span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-6 bg-neutral-800/40 border border-dashed border-neutral-700 rounded-xl p-5 text-center">
        <p className="text-sm text-neutral-500">Echte Plattform-Verbindungen folgen in Phase 2.</p>
      </div>
    </div>
  );
}

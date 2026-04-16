'use client';

import { useState } from 'react';
import { useBrandStore } from '@/store/useBrandStore';
import { Brand } from '@/lib/types';
import BrandCard from '@/components/brands/BrandCard';
import BrandModal from '@/components/brands/BrandModal';

type ModalMode = Brand | 'new' | null;

export default function BrandsPage() {
  const { brands } = useBrandStore();
  const [modalMode, setModalMode] = useState<ModalMode>(null);

  const visible  = brands.filter(b => !b.archived);
  const archived = brands.filter(b =>  b.archived);

  return (
    <div className="p-6 max-w-5xl mx-auto">

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-white">Marken</h1>
          <p className="text-sm text-neutral-400 mt-0.5">
            {visible.length} aktive {visible.length === 1 ? 'Marke' : 'Marken'}
          </p>
        </div>
        <button
          onClick={() => setModalMode('new')}
          className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          + Neue Marke
        </button>
      </div>

      {visible.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {visible.map(brand => (
            <BrandCard key={brand.id} brand={brand} onEdit={b => setModalMode(b)} />
          ))}
          <button
            onClick={() => setModalMode('new')}
            className="border-2 border-dashed border-neutral-700 hover:border-neutral-500 rounded-xl p-4 flex flex-col items-center justify-center gap-2 text-neutral-500 hover:text-neutral-300 transition-colors min-h-[140px]"
          >
            <span className="text-2xl leading-none">+</span>
            <span className="text-sm">Neue Marke anlegen</span>
          </button>
        </div>
      ) : (
        <div className="text-center py-16 text-neutral-500">
          <p className="text-sm">Noch keine Marken vorhanden.</p>
          <button
            onClick={() => setModalMode('new')}
            className="mt-4 text-sm text-blue-400 hover:text-blue-300"
          >
            Erste Marke anlegen →
          </button>
        </div>
      )}

      {archived.length > 0 && (
        <details className="mt-4">
          <summary className="text-xs text-neutral-500 cursor-pointer hover:text-neutral-300 select-none">
            {archived.length} archivierte {archived.length === 1 ? 'Marke' : 'Marken'} anzeigen
          </summary>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4 opacity-50">
            {archived.map(brand => (
              <BrandCard key={brand.id} brand={brand} onEdit={b => setModalMode(b)} />
            ))}
          </div>
        </details>
      )}

      <BrandModal mode={modalMode} onClose={() => setModalMode(null)} />
    </div>
  );
}

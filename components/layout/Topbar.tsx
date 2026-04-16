'use client';
import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useBrandStore } from '@/store/useBrandStore';
import { Brand } from '@/lib/types';

function getInitials(name: string) { return name.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,3); }
function getTextColor(hex: string) {
  const r=parseInt(hex.slice(1,3),16), g=parseInt(hex.slice(3,5),16), b=parseInt(hex.slice(5,7),16);
  return (0.299*r+0.587*g+0.114*b)/255 > 0.5 ? '#1a1a1a' : '#ffffff';
}

export function BrandAvatar({ brand, size=28 }: { brand: Brand; size?: number }) {
  return (
    <div style={{ width:size, height:size, backgroundColor:brand.color, color:getTextColor(brand.color), borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:size*0.35, fontWeight:600, flexShrink:0 }}>
      {getInitials(brand.name)}
    </div>
  );
}

export default function Topbar() {
  const { brands, activeBrandId, activeBrand, setActiveBrand } = useBrandStore();
  const current = activeBrand();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const visibleBrands = brands.filter(b => !b.archived);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) { if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="h-14 border-b border-neutral-800 bg-neutral-950 flex items-center px-4 gap-4 z-50 sticky top-0">
      <Link href="/" className="text-white font-semibold text-sm tracking-tight shrink-0">GK Social Hub</Link>
      <div className="w-px h-5 bg-neutral-700" />
      <div className="relative" ref={dropdownRef}>
        <button onClick={() => setOpen(o=>!o)} className="flex items-center gap-2 px-2.5 py-1.5 rounded-md hover:bg-neutral-800 transition-colors text-sm">
          {current ? <><BrandAvatar brand={current} size={22} /><span className="text-white font-medium max-w-[160px] truncate">{current.name}</span></> : <span className="text-neutral-400">Marke wählen</span>}
          <span className="text-neutral-500 text-xs ml-1">▾</span>
        </button>
        {open && (
          <div className="absolute top-full left-0 mt-1 w-64 bg-neutral-900 border border-neutral-700 rounded-lg shadow-xl z-50 py-1 overflow-hidden">
            <div className="px-3 py-1.5 text-xs text-neutral-500 font-medium uppercase tracking-wide">Meine Marken</div>
            {visibleBrands.map(brand => (
              <button key={brand.id} onClick={() => { setActiveBrand(brand.id); setOpen(false); }} className={`w-full flex items-center gap-2.5 px-3 py-2 hover:bg-neutral-800 transition-colors text-left ${brand.id===activeBrandId ? 'bg-neutral-800' : ''}`}>
                <BrandAvatar brand={brand} size={26} />
                <div className="min-w-0"><div className="text-sm text-white truncate">{brand.name}</div><div className="text-xs text-neutral-400">{brand.industry}</div></div>
                {brand.id===activeBrandId && <span className="ml-auto text-blue-400 text-xs">✓</span>}
              </button>
            ))}
            <div className="border-t border-neutral-800 mt-1 pt-1">
              <Link href="/brands" onClick={() => setOpen(false)} className="flex items-center gap-2 px-3 py-2 text-sm text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors">
                <span className="text-lg leading-none">⊞</span>Alle Marken verwalten
              </Link>
            </div>
          </div>
        )}
      </div>
      <div className="flex-1" />
      <Link href="/posts/new" className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-3 py-1.5 rounded-md transition-colors">+ Neuer Post</Link>
      <Link href="/settings" className="text-neutral-400 hover:text-white text-sm px-2 py-1.5 rounded-md hover:bg-neutral-800 transition-colors">⚙</Link>
    </header>
  );
}

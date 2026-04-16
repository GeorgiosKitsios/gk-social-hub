DATEI: components/layout/Sidebar.tsx
// ============================================================
'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  { label: 'Dashboard', href: '/',          icon: '⊞' },
  { label: 'Marken',    href: '/brands',    icon: '◈' },
  { label: 'Kalender',  href: '/calendar',  icon: '▦' },
  { label: 'Board',     href: '/board',     icon: '⊟' },
  { label: 'Posts',     href: '/posts',     icon: '≡' },
  { label: 'Medien',    href: '/media',     icon: '⊡' },
  { label: 'Vorlagen',  href: '/templates', icon: '❒' },
  { label: 'Konten',    href: '/accounts',  icon: '⊕' },
];

export default function Sidebar() {
  const pathname = usePathname();
  function isActive(href: string) { return href==='/' ? pathname==='/' : pathname.startsWith(href); }
  return (
    <aside className="w-44 shrink-0 border-r border-neutral-800 bg-neutral-950 flex flex-col pt-2 pb-4">
      <nav className="flex flex-col gap-0.5 px-2">
        {NAV_ITEMS.map(item => (
          <Link key={item.href} href={item.href} className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${isActive(item.href) ? 'bg-neutral-800 text-white font-medium' : 'text-neutral-400 hover:text-white hover:bg-neutral-800/60'}`}>
            <span className="text-base leading-none w-4 text-center">{item.icon}</span>{item.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}

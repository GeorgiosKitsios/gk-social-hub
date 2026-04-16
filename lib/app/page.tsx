DATEI: app/page.tsx  (Dashboard)
// ============================================================
'use client';
import Link from 'next/link';
import { useBrandStore } from '@/store/useBrandStore';
import { usePostStore }  from '@/store/usePostStore';
import { BrandAvatar }   from '@/components/layout/Topbar';
import { Brand }         from '@/lib/types';

const PLATFORM_LABEL: Record<string, string> = { facebook: 'FB', instagram: 'IG', tiktok: 'TK' };
const STATUS_STYLE: Record<string, string> = {
  draft:     'bg-neutral-700 text-neutral-300',
  scheduled: 'bg-blue-500/20 text-blue-400',
  published: 'bg-green-500/20 text-green-400',
  error:     'bg-red-500/20 text-red-400',
};
const STATUS_LABEL: Record<string, string> = { draft: 'Entwurf', scheduled: 'Geplant', published: 'Gepostet', error: 'Fehler' };

function StatCard({ value, label }: { value: number | string; label: string }) {
  return (
    <div className="bg-neutral-800 rounded-xl px-4 py-3 flex flex-col gap-0.5">
      <span className="text-2xl font-semibold text-white">{value}</span>
      <span className="text-xs text-neutral-400">{label}</span>
    </div>
  );
}

function BrandRow({ brand }: { brand: Brand }) {
  const { setActiveBrand } = useBrandStore();
  return (
    <div className="flex items-center gap-3 py-3 border-b border-neutral-800 last:border-0">
      <div className="w-1 self-stretch rounded-full shrink-0" style={{ backgroundColor: brand.color }} />
      <BrandAvatar brand={brand} size={32} />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-white truncate">{brand.name}</div>
        <div className="text-xs text-neutral-400">{brand.industry}</div>
      </div>
      <div className="flex gap-1 shrink-0">
        {brand.platforms.map(p => (
          <span key={p} className="text-xs px-1.5 py-0.5 rounded bg-neutral-700 text-neutral-300">{PLATFORM_LABEL[p]}</span>
        ))}
      </div>
      <button onClick={() => setActiveBrand(brand.id)} className="text-xs text-neutral-500 hover:text-blue-400 transition-colors shrink-0">
        Aktivieren →
      </button>
    </div>
  );
}

export default function DashboardPage() {
  const { brands } = useBrandStore();
  const { posts }  = usePostStore();
  const active = brands.filter(b => !b.archived);

  const activeBrandIds = new Set(active.map(b => b.id));
  const allPosts = posts.filter(p => activeBrandIds.has(p.brandId));

  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
  weekStart.setHours(0, 0, 0, 0);

  const postsThisWeek  = allPosts.filter(p => p.scheduledAt && new Date(p.scheduledAt) >= weekStart).length;
  const scheduledCount = allPosts.filter(p => p.status === 'scheduled').length;
  const errorCount     = allPosts.filter(p => p.status === 'error').length;

  const recentPosts = [...allPosts].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 5);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-white">Dashboard</h1>
        <p className="text-sm text-neutral-400 mt-0.5">Überblick über alle Marken und Aktivitäten</p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        <StatCard value={active.length}  label="Aktive Marken"    />
        <StatCard value={postsThisWeek}  label="Posts diese Woche" />
        <StatCard value={scheduledCount} label="Geplante Posts"    />
        <StatCard value={errorCount}     label="Fehler"            />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-neutral-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium text-white">Meine Marken</h2>
            <Link href="/brands" className="text-xs text-neutral-400 hover:text-white transition-colors">Alle verwalten →</Link>
          </div>
          {active.length > 0
            ? active.map(brand => <BrandRow key={brand.id} brand={brand} />)
            : <div className="py-8 text-center text-neutral-500 text-sm"><p>Noch keine Marken.</p><Link href="/brands" className="mt-2 inline-block text-blue-400 text-xs">Erste Marke anlegen →</Link></div>
          }
        </div>
        <div className="bg-neutral-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium text-white">Letzte Aktivität</h2>
            <Link href="/posts" className="text-xs text-neutral-400 hover:text-white transition-colors">Alle Posts →</Link>
          </div>
          <div className="flex flex-col gap-2">
            {recentPosts.length === 0
              ? <p className="text-xs text-neutral-500 text-center py-4">Noch keine Posts.</p>
              : recentPosts.map(post => {
                  const brand = brands.find(b => b.id === post.brandId);
                  return (
                    <div key={post.id} className="flex items-center gap-3 p-3 bg-neutral-900 rounded-lg">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: brand?.color ?? '#888' }} />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs text-neutral-400 mb-0.5">{brand?.name}</div>
                        <div className="text-sm text-white truncate">{post.title || 'Ohne Titel'}</div>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${STATUS_STYLE[post.status]}`}>{STATUS_LABEL[post.status]}</span>
                    </div>
                  );
                })
            }
          </div>
        </div>
      </div>
      <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: '+ Neuer Post', href: '/posts/new' },
          { label: '⊞ Kalender',   href: '/calendar'  },
          { label: '⊟ Board',      href: '/board'     },
          { label: '⊡ Medien',     href: '/media'     },
        ].map(item => (
          <Link key={item.href} href={item.href} className="bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded-xl px-4 py-3 text-sm text-neutral-300 hover:text-white text-center transition-colors">
            {item.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

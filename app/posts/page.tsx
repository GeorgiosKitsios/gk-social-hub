'use client';

import Link from 'next/link';
import { useState } from 'react';
import { usePostStore }  from '@/store/usePostStore';
import { useBrandStore } from '@/store/useBrandStore';
import { PostStatus }    from '@/lib/types';

const STATUS_STYLE: Record<PostStatus, string> = {
  draft:     'bg-neutral-700 text-neutral-300',
  scheduled: 'bg-blue-500/20 text-blue-400',
  published: 'bg-green-500/20 text-green-400',
  error:     'bg-red-500/20 text-red-400',
};

const STATUS_LABEL: Record<PostStatus, string> = {
  draft:     'Entwurf',
  scheduled: 'Geplant',
  published: 'Gepostet',
  error:     'Fehler',
};

const PLATFORM_LABEL: Record<string, string> = {
  facebook: 'FB', instagram: 'IG', tiktok: 'TK',
};

function formatDate(iso?: string) {
  if (!iso) return '–';
  return new Date(iso).toLocaleDateString('de-DE', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function PostsPage() {
  const { posts, deletePost } = usePostStore();
  const { brands, activeBrandId } = useBrandStore();
  const [statusFilter, setStatusFilter] = useState<PostStatus | 'all'>('all');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const brandPosts = posts.filter(p => p.brandId === activeBrandId);
  const filtered   = statusFilter === 'all'
    ? brandPosts
    : brandPosts.filter(p => p.status === statusFilter);

  const activeBrand = brands.find(b => b.id === activeBrandId);

  const counts = {
    all:       brandPosts.length,
    draft:     brandPosts.filter(p => p.status === 'draft').length,
    scheduled: brandPosts.filter(p => p.status === 'scheduled').length,
    published: brandPosts.filter(p => p.status === 'published').length,
    error:     brandPosts.filter(p => p.status === 'error').length,
  };

  function handleDelete(id: string) {
    if (confirmDelete === id) { deletePost(id); setConfirmDelete(null); }
    else setConfirmDelete(id);
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-white">Posts</h1>
          <p className="text-sm text-neutral-400 mt-0.5">
            {activeBrand?.name ?? '–'} · {counts.all} Posts
          </p>
        </div>
        <Link
          href="/posts/new"
          className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          + Neuer Post
        </Link>
      </div>

      <div className="flex gap-1 bg-neutral-800 p-1 rounded-lg w-fit mb-6 flex-wrap">
        {([
          ['all',       `Alle (${counts.all})`],
          ['draft',     `Entwurf (${counts.draft})`],
          ['scheduled', `Geplant (${counts.scheduled})`],
          ['published', `Gepostet (${counts.published})`],
          ['error',     `Fehler (${counts.error})`],
        ] as const).map(([v, l]) => (
          <button
            key={v}
            onClick={() => setStatusFilter(v)}
            className={`px-3 py-1 text-xs rounded-md transition-colors ${
              statusFilter === v ? 'bg-neutral-600 text-white' : 'text-neutral-400 hover:text-white'
            }`}
          >
            {l}
          </button>
        ))}
      </div>

      {filtered.length > 0 ? (
        <div className="bg-neutral-800 rounded-xl overflow-hidden border border-neutral-700">
          <div className="grid grid-cols-[1fr_80px_140px_90px_80px] gap-4 px-4 py-2 border-b border-neutral-700 text-xs text-neutral-500 font-medium">
            <span>Titel</span><span>Plattform</span><span>Datum</span><span>Status</span><span></span>
          </div>
          {filtered.map(post => (
            <div
              key={post.id}
              className="grid grid-cols-[1fr_80px_140px_90px_80px] gap-4 px-4 py-3 border-b border-neutral-700/50 last:border-0 items-center hover:bg-neutral-700/30 transition-colors"
            >
              <div className="min-w-0">
                <Link
                  href={`/posts/${post.id}`}
                  className="text-sm text-white hover:text-blue-400 transition-colors truncate block"
                >
                  {post.title || <span className="text-neutral-500 italic">Ohne Titel</span>}
                </Link>
                {post.notes && (
                  <p className="text-xs text-neutral-500 truncate mt-0.5">{post.notes}</p>
                )}
              </div>
              <div className="flex gap-1">
                {post.platforms.map(p => (
                  <span key={p} className="text-xs px-1.5 py-0.5 rounded bg-neutral-700 text-neutral-300">
                    {PLATFORM_LABEL[p]}
                  </span>
                ))}
              </div>
              <span className="text-xs text-neutral-400">
                {post.status === 'published'
                  ? formatDate(post.publishedAt)
                  : post.scheduledAt
                  ? formatDate(post.scheduledAt)
                  : '–'}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full w-fit ${STATUS_STYLE[post.status]}`}>
                {STATUS_LABEL[post.status]}
              </span>
              <div className="flex gap-1.5 justify-end">
                <Link
                  href={`/posts/${post.id}`}
                  className="text-xs px-2 py-1 rounded border border-neutral-600 text-neutral-400 hover:text-white hover:border-neutral-400 transition-colors"
                >
                  ✎
                </Link>
                <button
                  onClick={() => handleDelete(post.id)}
                  className={`text-xs px-2 py-1 rounded border transition-colors ${
                    confirmDelete === post.id
                      ? 'border-red-500 text-red-400'
                      : 'border-neutral-600 text-neutral-500 hover:text-red-400 hover:border-red-500'
                  }`}
                >
                  {confirmDelete === post.id ? '?' : '✕'}
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 text-neutral-500">
          <p className="text-sm">Keine Posts gefunden.</p>
          <Link
            href="/posts/new"
            className="mt-3 inline-block text-sm text-blue-400 hover:text-blue-300"
          >
            Ersten Post anlegen →
          </Link>
        </div>
      )}
    </div>
  );
}

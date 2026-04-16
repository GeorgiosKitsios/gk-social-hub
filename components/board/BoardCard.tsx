'use client';
import Link from 'next/link';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Post } from '@/lib/types';

const PLATFORM_LABEL: Record<string,string> = { facebook:'FB', instagram:'IG', tiktok:'TK' };
function formatDate(iso?: string) { if(!iso)return null; return new Date(iso).toLocaleDateString('de-DE',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}); }

export default function BoardCard({ post, brandColor }: { post: Post; brandColor: string }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: post.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };
  const date  = post.scheduledAt ?? post.publishedAt;
  return (
    <div ref={setNodeRef} style={style} className="bg-neutral-800 border border-neutral-700 rounded-lg overflow-hidden hover:border-neutral-500 transition-colors">
      <div {...attributes} {...listeners} className="h-1 w-full cursor-grab active:cursor-grabbing" style={{ backgroundColor: brandColor }} />
      <Link href={`/posts/${post.id}`} className="block p-3">
        <p className="text-sm text-white font-medium leading-snug line-clamp-2 mb-2">{post.title||<span className="text-neutral-500 italic">Ohne Titel</span>}</p>
        {post.mainText && <p className="text-xs text-neutral-500 line-clamp-2 mb-2">{post.mainText}</p>}
        <div className="flex items-center justify-between gap-2 mt-auto">
          <div className="flex gap-1">{post.platforms.map(p=><span key={p} className="text-xs px-1.5 py-0.5 rounded bg-neutral-700 text-neutral-400">{PLATFORM_LABEL[p]}</span>)}</div>
          {date && <span className="text-xs text-neutral-500 shrink-0">{formatDate(date)}</span>}
        </div>
        {post.notes && <div className="mt-2 text-xs text-neutral-600 flex items-center gap-1"><span>✎</span><span className="truncate">{post.notes}</span></div>}
      </Link>
    </div>
  );
}

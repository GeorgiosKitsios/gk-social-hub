DATEI: components/calendar/CalendarPostChip.tsx
// ============================================================
'use client';
import Link from 'next/link';
import { Post, PostStatus } from '@/lib/types';
import { formatTime } from './calendarUtils';

const PLATFORM_SHORT: Record<string,string> = { facebook:'FB', instagram:'IG', tiktok:'TK' };
const STATUS_BG: Record<PostStatus,string> = { draft:'bg-neutral-700 text-neutral-300', scheduled:'bg-blue-600/80 text-blue-100', published:'bg-green-700/80 text-green-100', error:'bg-red-700/80 text-red-100' };

export default function CalendarPostChip({ post, brandColor, compact }: { post: Post; brandColor: string; compact?: boolean }) {
  const time  = post.scheduledAt ? formatTime(post.scheduledAt) : null;
  const plats = post.platforms.map(p=>PLATFORM_SHORT[p]).join(' ');
  if (compact) {
    return <Link href={`/posts/${post.id}`} className={`block w-full truncate text-left px-1.5 py-0.5 rounded text-xs leading-snug transition-opacity hover:opacity-80 ${STATUS_BG[post.status]}`} style={{borderLeft:`2px solid ${brandColor}`}} title={post.title||'Ohne Titel'}>{time&&<span className="opacity-70 mr-1">{time}</span>}{post.title||<span className="italic opacity-60">Ohne Titel</span>}</Link>;
  }
  return (
    <Link href={`/posts/${post.id}`} className={`block w-full text-left px-2 py-1.5 rounded-lg text-xs leading-snug transition-all hover:brightness-110 ${STATUS_BG[post.status]}`} style={{borderLeft:`3px solid ${brandColor}`}}>
      <div className="font-medium truncate">{post.title||<span className="italic opacity-60">Ohne Titel</span>}</div>
      <div className="flex items-center gap-1.5 mt-0.5 opacity-75">{time&&<span>{time}</span>}{time&&<span>·</span>}<span>{plats}</span></div>
    </Link>
  );
}

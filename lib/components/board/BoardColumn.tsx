DATEI: components/board/BoardColumn.tsx
// ============================================================
'use client';
import Link from 'next/link';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Post } from '@/lib/types';
import BoardCard from './BoardCard';

export interface ColumnDef { id: string; label: string; color: string; }

export default function BoardColumn({ column, posts, brandColor }: { column: ColumnDef; posts: Post[]; brandColor: string }) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  return (
    <div className="flex flex-col w-60 shrink-0">
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full" style={{backgroundColor:column.color}} /><span className="text-xs font-medium text-neutral-300">{column.label}</span><span className="text-xs text-neutral-600 bg-neutral-800 px-1.5 py-0.5 rounded-full">{posts.length}</span></div>
        <Link href="/posts/new" className="text-neutral-600 hover:text-white text-sm transition-colors leading-none" title="Neuer Post">+</Link>
      </div>
      <div ref={setNodeRef} className={`flex flex-col gap-2 flex-1 min-h-[120px] p-2 rounded-xl border border-dashed transition-colors ${isOver ? 'border-blue-500 bg-blue-500/5' : 'border-neutral-700/50 bg-neutral-800/30'}`}>
        <SortableContext items={posts.map(p=>p.id)} strategy={verticalListSortingStrategy}>
          {posts.map(post => <BoardCard key={post.id} post={post} brandColor={brandColor} />)}
        </SortableContext>
        {posts.length===0 && <div className="flex-1 flex items-center justify-center"><p className="text-xs text-neutral-700">Leer</p></div>}
      </div>
    </div>
  );
}

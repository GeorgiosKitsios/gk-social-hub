DATEI: app/board/page.tsx
// ============================================================
'use client';
import { useState } from 'react';
import Link from 'next/link';
import { DndContext, DragEndEvent, DragOverEvent, DragOverlay, DragStartEvent, PointerSensor, useSensor, useSensors, closestCorners } from '@dnd-kit/core';
import { usePostStore }  from '@/store/usePostStore';
import { useBrandStore } from '@/store/useBrandStore';
import { Post, PostStatus } from '@/lib/types';
import BoardColumn, { ColumnDef } from '@/components/board/BoardColumn';
import BoardCard from '@/components/board/BoardCard';

const COLUMNS: ColumnDef[] = [
  { id:'draft',      label:'Idee / Entwurf', color:'#888780' },
  { id:'draft_wip',  label:'In Bearbeitung', color:'#BA7517' },
  { id:'draft_done', label:'Fertig',         color:'#7F77DD' },
  { id:'scheduled',  label:'Geplant',        color:'#378ADD' },
  { id:'published',  label:'Gepostet',       color:'#639922' },
  { id:'error',      label:'Fehler',         color:'#E24B4A' },
];

type ColId = 'draft'|'draft_wip'|'draft_done'|'scheduled'|'published'|'error';

function getDefaultCol(status: PostStatus): ColId {
  if (status==='scheduled') return 'scheduled';
  if (status==='published') return 'published';
  if (status==='error')     return 'error';
  return 'draft';
}

function colToStatus(colId: ColId): PostStatus {
  if (colId==='scheduled') return 'scheduled';
  if (colId==='published') return 'published';
  if (colId==='error')     return 'error';
  return 'draft';
}

export default function BoardPage() {
  const { posts, updatePost } = usePostStore();
  const { activeBrandId, activeBrand } = useBrandStore();
  const brand      = activeBrand();
  const brandColor = brand?.color ?? '#378ADD';
  const brandPosts = posts.filter(p => p.brandId===activeBrandId);

  const [colMap, setColMap] = useState<Record<string,ColId>>(() => {
    const m: Record<string,ColId> = {};
    brandPosts.forEach(p => { m[p.id] = (p.boardColumn as ColId) ?? getDefaultCol(p.status); });
    return m;
  });
  brandPosts.forEach(p => { if(!colMap[p.id]) colMap[p.id]=(p.boardColumn as ColId)??getDefaultCol(p.status); });

  function postsForCol(colId: ColId): Post[] { return brandPosts.filter(p => (colMap[p.id]??getDefaultCol(p.status))===colId); }

  const [activePost, setActivePost] = useState<Post|null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  function onDragStart({ active }: DragStartEvent) { setActivePost(brandPosts.find(p=>p.id===active.id)??null); }
  function onDragOver({ active, over }: DragOverEvent) {
    if (!over) return;
    const activeId=active.id as string, overId=over.id as string;
    const activeCol=colMap[activeId]??getDefaultCol(brandPosts.find(p=>p.id===activeId)?.status??'draft');
    const targetCol=COLUMNS.find(c=>c.id===overId)?(overId as ColId):(colMap[overId]??activeCol);
    if (activeCol!==targetCol) { setColMap(m=>({...m,[activeId]:targetCol})); updatePost(activeId,{status:colToStatus(targetCol),boardColumn:targetCol}); }
  }
  function onDragEnd() { setActivePost(null); }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 shrink-0">
        <div><h1 className="text-xl font-semibold text-white">Board</h1><p className="text-sm text-neutral-400 mt-0.5">{brand?.name??'–'} · {brandPosts.length} Posts</p></div>
        <Link href="/posts/new" className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">+ Neuer Post</Link>
      </div>
      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd}>
          <div className="flex gap-4 p-6 h-full min-h-0">
            {COLUMNS.map(col => <BoardColumn key={col.id} column={col} posts={postsForCol(col.id as ColId)} brandColor={brandColor} />)}
          </div>
          <DragOverlay>{activePost && <div className="rotate-1 shadow-2xl opacity-90"><BoardCard post={activePost} brandColor={brandColor} /></div>}</DragOverlay>
        </DndContext>
      </div>
    </div>
  );
}

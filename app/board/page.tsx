'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from '@dnd-kit/core';
import { usePostStore }  from '@/store/usePostStore';
import { useBrandStore } from '@/store/useBrandStore';
import { Post, PostStatus } from '@/lib/types';
import BoardColumn, { ColumnDef } from '@/components/board/BoardColumn';
import BoardCard from '@/components/board/BoardCard';

const COLUMNS: ColumnDef[] = [
  { id: 'draft',      label: 'Idee / Entwurf', color: '#888780' },
  { id: 'draft_wip',  label: 'In Bearbeitung',  color: '#BA7517' },
  { id: 'draft_done', label: 'Fertig',           color: '#7F77DD' },
  { id: 'scheduled',  label: 'Geplant',          color: '#378ADD' },
  { id: 'published',  label: 'Gepostet',         color: '#639922' },
  { id: 'error',      label: 'Fehler',           color: '#E24B4A' },
];

type ColId = 'draft' | 'draft_wip' | 'draft_done' | 'scheduled' | 'published' | 'error';

function getDefaultCol(status: PostStatus): ColId {
  if (status === 'scheduled') return 'scheduled';
  if (status === 'published') return 'published';
  if (status === 'error')     return 'error';
  return 'draft';
}

function colToStatus(colId: ColId): PostStatus {
  if (colId === 'scheduled') return 'scheduled';
  if (colId === 'published') return 'published';
  if (colId === 'error')     return 'error';
  return 'draft';
}

export default function BoardPage() {
  const { posts, updatePost } = usePostStore();
  const { activeBrandId, activeBrand } = useBrandStore();

  const brand      = activeBrand();
  const brandColor = brand?.color ?? '#378ADD';
  const brandPosts = posts.filter(p => p.brandId === activeBrandId);

  // colMap: initialisiert aus boardColumn (persistent) oder Status
  const [colMap, setColMap] = useState<Record<string, ColId>>(() => {
    const m: Record<string, ColId> = {};
    brandPosts.forEach(p => {
      m[p.id] = (p.boardColumn as ColId) ?? getDefaultCol(p.status);
    });
    return m;
  });

  // Neue Posts die noch nicht im colMap sind hinzufügen
  brandPosts.forEach(p => {
    if (colMap[p.id] === undefined) {
      colMap[p.id] = (p.boardColumn as ColId) ?? getDefaultCol(p.status);
    }
  });

  const [activePost, setActivePost] = useState<Post | null>(null);
  const [activeId,   setActiveId]   = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  );

  function postsForCol(colId: ColId): Post[] {
    return brandPosts.filter(p => (colMap[p.id] ?? getDefaultCol(p.status)) === colId);
  }

  const onDragStart = useCallback(({ active }: DragStartEvent) => {
    const id = active.id as string;
    setActiveId(id);
    setActivePost(brandPosts.find(p => p.id === id) ?? null);
  }, [brandPosts]);

  const onDragEnd = useCallback(({ active, over }: DragEndEvent) => {
    setActivePost(null);
    setActiveId(null);

    if (!over) return;

    const postId  = active.id as string;
    const overId  = over.id as string;

    // Ziel-Spalte ermitteln: entweder direkt eine Spalte oder eine Karte in einer Spalte
    const targetCol = COLUMNS.find(c => c.id === overId)
      ? (overId as ColId)
      : (colMap[overId] ?? getDefaultCol(brandPosts.find(p => p.id === overId)?.status ?? 'draft'));

    const currentCol = colMap[postId] ?? getDefaultCol(brandPosts.find(p => p.id === postId)?.status ?? 'draft');

    if (targetCol === currentCol) return; // keine Änderung nötig

    // 1. Lokalen State sofort aktualisieren (optimistisch)
    setColMap(prev => ({ ...prev, [postId]: targetCol }));

    // 2. Store persistieren
    updatePost(postId, {
      status:      colToStatus(targetCol),
      boardColumn: targetCol,
    });
  }, [colMap, brandPosts, updatePost]);

  return (
    <div className="flex flex-col h-full">

      <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 shrink-0">
        <div>
          <h1 className="text-xl font-semibold text-white">Board</h1>
          <p className="text-sm text-neutral-400 mt-0.5">
            {brand?.name ?? '–'} · {brandPosts.length} Posts
          </p>
        </div>
        <Link
          href="/posts/new"
          className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          + Neuer Post
        </Link>
      </div>

      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
        >
          <div className="flex gap-4 p-6 h-full">
            {COLUMNS.map(col => (
              <BoardColumn
                key={col.id}
                column={col}
                posts={postsForCol(col.id as ColId)}
                brandColor={brandColor}
                activeId={activeId}
              />
            ))}
          </div>

          <DragOverlay dropAnimation={null}>
            {activePost && (
              <div className="rotate-1 shadow-2xl opacity-90 w-60">
                <BoardCard post={activePost} brandColor={brandColor} />
              </div>
            )}
          </DragOverlay>
        </DndContext>
      </div>

      {brandPosts.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center text-neutral-600">
            <div className="text-4xl mb-3">⊟</div>
            <p className="text-sm">Noch keine Posts für diese Marke.</p>
          </div>
        </div>
      )}
    </div>
  );
}

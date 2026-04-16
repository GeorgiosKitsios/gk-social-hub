DATEI: app/posts/new/page.tsx
// ============================================================
'use client';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import PostEditor from '@/components/posts/PostEditor';

function NewPostInner() {
  const params     = useSearchParams();
  const presetDate = params.get('date') ?? undefined;
  return <PostEditor presetDate={presetDate} />;
}

export default function NewPostPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-full text-neutral-500 text-sm">Lade Editor...</div>}>
      <NewPostInner />
    </Suspense>
  );
}

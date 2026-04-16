'use client';

import { use } from 'react';
import PostEditor from '@/components/posts/PostEditor';

interface Props {
  params: Promise<{ id: string }>;
}

export default function EditPostPage({ params }: Props) {
  const { id } = use(params);

  // Sicherheitscheck: 'new' darf nie als postId übergeben werden
  if (!id || id === 'new') {
    return <PostEditor />;
  }

  return <PostEditor postId={id} />;
}

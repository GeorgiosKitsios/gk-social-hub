'use client';
import { use } from 'react';
import PostEditor from '@/components/posts/PostEditor';

interface Props { params: Promise<{ id: string }> }

export default function EditPostPage({ params }: Props) {
  const { id } = use(params);
  return <PostEditor postId={id} />;
}

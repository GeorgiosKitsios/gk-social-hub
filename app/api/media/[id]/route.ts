import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { storagePath } = await req.json();

  await supabase.storage.from('media').remove([storagePath]);

  const { error } = await supabase
    .from('media_items')
    .delete()
    .eq('id', params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

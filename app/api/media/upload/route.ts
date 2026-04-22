import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get('file') as File;
  const brandId = formData.get('brandId') as string;
  const tags = JSON.parse(formData.get('tags') as string ?? '[]');

  const ext = file.name.split('.').pop();
  const path = `${brandId}/${crypto.randomUUID()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from('media')
    .upload(path, file);

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: { publicUrl } } = supabase.storage
    .from('media')
    .getPublicUrl(path);

  const { data, error: dbError } = await supabase
    .from('media_items')
    .insert({
      brand_id: brandId,
      file_name: file.name,
      file_url: publicUrl,
      storage_path: path,
      media_type: file.type.startsWith('video') ? 'video' : 'image',
      mime_type: file.type,
      tags,
    })
    .select()
    .single();

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

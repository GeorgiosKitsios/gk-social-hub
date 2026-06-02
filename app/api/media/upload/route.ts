import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file     = formData.get('file')    as File;
    const brandId  = formData.get('brandId') as string;
    const tags: string[] = JSON.parse((formData.get('tags') as string) ?? '[]');

    if (!file || !brandId) {
      return NextResponse.json({ error: 'file und brandId sind erforderlich.' }, { status: 400 });
    }

    const ext  = file.name.split('.').pop() ?? 'bin';
    const path = `${brandId}/${crypto.randomUUID()}.${ext}`;

    // 1. Datei in Supabase Storage hochladen
    const { error: uploadError } = await supabase.storage
      .from('media')
      .upload(path, file);

    if (uploadError) {
      console.error('[media/upload] Storage error:', uploadError.message);
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    // 2. Öffentliche URL ermitteln
    const { data: { publicUrl } } = supabase.storage
      .from('media')
      .getPublicUrl(path);

    // 3. Metadaten in Datenbank speichern
    const { data, error: dbError } = await supabase
      .from('media_items')
      .insert({
        brand_id:     brandId,
        file_name:    file.name,
        file_url:     publicUrl,
        storage_path: path,
        media_type:   file.type.startsWith('video') ? 'video' : 'image',
        mime_type:    file.type,
        size_bytes:   file.size,
        tags,
      })
      .select()
      .single();

    if (dbError) {
      console.error('[media/upload] DB error:', dbError.message);
      return NextResponse.json({ error: dbError.message }, { status: 500 });
    }

    // 4. Antwort als camelCase zurückgeben (passend zum Media-Type im Store)
    return NextResponse.json({
      id:           data.id,
      brandId:      data.brand_id,
      type:         data.media_type as 'image' | 'video',
      filename:     data.file_name,
      url:          data.file_url,
      thumbnailUrl: data.file_url,
      sizeBytes:    data.size_bytes ?? file.size,
      tags:         data.tags ?? [],
      uploadedAt:   data.created_at ?? new Date().toISOString(),
    });

  } catch (err) {
    console.error('[media/upload] Unexpected error:', err);
    return NextResponse.json({ error: 'Interner Serverfehler.' }, { status: 500 });
  }
}

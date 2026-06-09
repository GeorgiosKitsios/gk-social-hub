import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, hasSupabaseAdminConfig } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  if (!hasSupabaseAdminConfig()) {
    return NextResponse.json(
      { error: 'SUPABASE_SERVICE_ROLE_KEY fehlt – Metadaten können nicht gespeichert werden.' },
      { status: 500 }
    );
  }

  let brandId: string, fileName: string, fileUrl: string, storagePath: string,
      mediaType: string, mimeType: string, sizeBytes: number, tags: string[];

  try {
    const body = await req.json();
    ({ brandId, fileName, fileUrl, storagePath, mediaType, mimeType, sizeBytes } = body);
    tags = Array.isArray(body.tags) ? body.tags : [];
  } catch {
    return NextResponse.json({ error: 'Ungültiger Request-Body.' }, { status: 400 });
  }

  if (!brandId || !fileUrl || !storagePath) {
    return NextResponse.json(
      { error: 'brandId, fileUrl und storagePath sind erforderlich.' },
      { status: 400 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from('media_items')
    .insert({ brand_id: brandId, file_name: fileName, file_url: fileUrl,
              storage_path: storagePath, media_type: mediaType, mime_type: mimeType,
              size_bytes: sizeBytes, tags })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: 500 });
  }

  // Gleiche Antwortform wie /api/media/upload, damit der Store-Code unverändert bleibt.
  const createdAt = data.created_at ?? new Date().toISOString();
  return NextResponse.json({
    id:           data.id,
    brandId:      data.brand_id,
    fileName:     data.file_name,
    fileUrl:      data.file_url,
    mediaType:    data.media_type,
    tags:         Array.isArray(data.tags) ? data.tags : [],
    createdAt,
    updatedAt:    data.updated_at ?? createdAt,
    uploadedAt:   createdAt,
    type:         data.media_type,
    filename:     data.file_name,
    url:          data.file_url,
    thumbnailUrl: data.file_url,
    sizeBytes:    data.size_bytes ?? sizeBytes,
    storagePath:  data.storage_path,
  });
}

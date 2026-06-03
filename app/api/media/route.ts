import { NextRequest, NextResponse } from 'next/server';
import { hasSupabaseAdminConfig, supabaseAdmin } from '@/lib/supabase';

type MediaItemRow = {
  id: string;
  brand_id: string;
  file_name: string;
  file_url: string;
  storage_path?: string | null;
  media_type?: 'image' | 'video' | string | null;
  mime_type?: string | null;
  size_bytes?: number | null;
  tags?: unknown;
  created_at?: string | null;
  updated_at?: string | null;
};

function toMediaResponse(row: MediaItemRow) {
  const mediaType = row.media_type ?? 'image';
  const createdAt = row.created_at ?? new Date().toISOString();
  const updatedAt = row.updated_at ?? createdAt;

  return {
    id: row.id,
    brandId: row.brand_id,
    fileName: row.file_name,
    fileUrl: row.file_url,
    mediaType,
    tags: Array.isArray(row.tags) ? row.tags : [],
    createdAt,
    updatedAt,
    uploadedAt: createdAt,

    // Bestehende Frontend-/Store-Felder beibehalten, damit kein Upload-Code
    // oder bestehende UI-Verwendung angepasst werden muss.
    type: mediaType,
    filename: row.file_name,
    url: row.file_url,
    thumbnailUrl: row.file_url,
    sizeBytes: row.size_bytes ?? 0,
    storagePath: row.storage_path ?? '',
  };
}

export async function GET(req: NextRequest) {
  const brandId = req.nextUrl.searchParams.get('brandId');

  if (!brandId) {
    return NextResponse.json({ error: 'brandId ist erforderlich.' }, { status: 400 });
  }

  if (!hasSupabaseAdminConfig()) {
    return NextResponse.json({
      step: 'env',
      error: 'SUPABASE_SERVICE_ROLE_KEY fehlt. Serverseitige Media-API benötigt den Service Role Key, damit RLS Uploads und DB-Abfragen nicht blockiert.',
    }, { status: 500 });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('media_items')
      .select('*')
      .eq('brand_id', brandId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[api/media] Supabase error:', error);
      return NextResponse.json({
        step: 'db_select',
        error: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      }, { status: 500 });
    }

    return NextResponse.json((Array.isArray(data) ? data : []).map(toMediaResponse));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[api/media] Unexpected error:', err);
    return NextResponse.json({ step: 'unexpected', error: msg }, { status: 500 });
  }
}

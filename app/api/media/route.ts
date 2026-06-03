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

type CreateMediaRequest = {
  brandId?: unknown;
  fileName?: unknown;
  fileType?: unknown;
  fileSize?: unknown;
  storagePath?: unknown;
  tags?: unknown;
};

const MAX_UPLOAD_SIZE_BYTES = 50 * 1024 * 1024;
const ALLOWED_FILE_TYPES = new Set(['image/jpeg', 'image/png', 'video/mp4', 'video/quicktime']);

function validateCreateRequest({ brandId, fileName, fileType, fileSize, storagePath }: CreateMediaRequest) {
  if (typeof brandId !== 'string' || !brandId.trim()) return 'brandId ist erforderlich.';
  if (typeof fileName !== 'string' || !fileName.trim()) return 'Dateiname ist erforderlich.';
  if (typeof fileType !== 'string' || !ALLOWED_FILE_TYPES.has(fileType)) return 'Dateityp nicht erlaubt. Erlaubt sind JPG, PNG, MP4 und MOV.';
  if (typeof fileSize !== 'number' || !Number.isFinite(fileSize) || fileSize <= 0) return 'Dateigröße ist erforderlich.';
  if (fileSize > MAX_UPLOAD_SIZE_BYTES) return 'Datei zu groß (max. 50 MB).';
  if (typeof storagePath !== 'string' || !storagePath.trim()) return 'Storage-Pfad ist erforderlich.';

  const expectedPrefix = `${brandId.trim()}/`;
  if (!storagePath.startsWith(expectedPrefix)) return 'Storage-Pfad passt nicht zur brandId.';

  return null;
}

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

export async function POST(req: NextRequest) {
  let body: CreateMediaRequest;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ step: 'validation', error: 'Ungültige Media-Anfrage.' }, { status: 400 });
  }

  const validationError = validateCreateRequest(body);
  if (validationError) {
    return NextResponse.json({ step: 'validation', error: validationError }, { status: 400 });
  }

  if (!hasSupabaseAdminConfig()) {
    return NextResponse.json({
      step: 'env',
      error: 'SUPABASE_SERVICE_ROLE_KEY fehlt. Serverseitige Media-API benötigt den Service Role Key, damit RLS Uploads und DB-Inserts nicht blockiert.',
    }, { status: 500 });
  }

  const brandId = (body.brandId as string).trim();
  const fileName = (body.fileName as string).trim();
  const fileType = body.fileType as string;
  const fileSize = body.fileSize as number;
  const storagePath = (body.storagePath as string).trim();
  const tags = Array.isArray(body.tags) ? body.tags.filter((tag): tag is string => typeof tag === 'string') : [];
  const { data: { publicUrl } } = supabaseAdmin.storage.from('media').getPublicUrl(storagePath);

  const { data, error } = await supabaseAdmin
    .from('media_items')
    .insert({
      brand_id: brandId,
      file_name: fileName,
      file_url: publicUrl,
      storage_path: storagePath,
      media_type: fileType.startsWith('video') ? 'video' : 'image',
      mime_type: fileType,
      size_bytes: fileSize,
      tags,
    })
    .select()
    .single();

  if (error) {
    console.error('[api/media] DB Insert fehlgeschlagen:', error);
    return NextResponse.json({
      step: 'db_insert',
      error: `DB Insert fehlgeschlagen: ${error.message}`,
      code: error.code,
      details: error.details,
      hint: error.hint ?? 'Prüfe, ob die Tabelle "media_items" existiert und alle Spalten stimmen.',
    }, { status: 500 });
  }

  return NextResponse.json(toMediaResponse(data), { status: 201 });
}


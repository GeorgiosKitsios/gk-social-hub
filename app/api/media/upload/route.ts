import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  console.log('[upload] ── POST /api/media/upload gestartet ──');

  // ── Schritt 1: FormData lesen ────────────────────────────────
  let file: File, brandId: string, tags: string[];
  try {
    const formData = await req.formData();
    file    = formData.get('file')    as File;
    brandId = formData.get('brandId') as string ?? '';

    const tagsRaw = formData.get('tags') as string | null;
    try {
      const parsed = tagsRaw && tagsRaw !== 'undefined' ? JSON.parse(tagsRaw) : [];
      tags = Array.isArray(parsed) ? parsed : [];
    } catch { tags = []; }

    console.log('[upload] Schritt 1 – FormData:', {
      fileName: file?.name, fileType: file?.type,
      fileSize: file?.size, brandId, tags,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[upload] Schritt 1 FEHLER – FormData:', msg);
    return NextResponse.json({ step: 'formdata', error: msg }, { status: 400 });
  }

  if (!file || !brandId) {
    console.error('[upload] Schritt 1 FEHLER – file oder brandId fehlt');
    return NextResponse.json({ step: 'validation', error: 'file und brandId sind erforderlich.' }, { status: 400 });
  }

  // ── Schritt 2: Env-Variablen prüfen ─────────────────────────
  const supabaseUrl    = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  console.log('[upload] Schritt 2 – Env-Variablen:', {
    SUPABASE_URL_set:     !!supabaseUrl,
    SERVICE_ROLE_KEY_set: !!serviceRoleKey,
    SUPABASE_URL_prefix:  supabaseUrl?.slice(0, 30) ?? '(fehlt)',
  });
  if (!supabaseUrl) {
    console.error('[upload] Schritt 2 FEHLER – NEXT_PUBLIC_SUPABASE_URL fehlt!');
    return NextResponse.json({
      step: 'env', error: 'NEXT_PUBLIC_SUPABASE_URL fehlt. In Hostinger Env-Variablen setzen.',
    }, { status: 500 });
  }
  if (!serviceRoleKey) {
    console.warn('[upload] Schritt 2 WARNUNG – SUPABASE_SERVICE_ROLE_KEY fehlt (RLS könnte blockieren).');
  }

  // ── Schritt 3: Datei direkt in Supabase Storage hochladen ────
  const ext         = file.name.split('.').pop()?.toLowerCase() ?? 'bin';
  const storagePath = `${brandId}/${crypto.randomUUID()}.${ext}`;
  console.log('[upload] Schritt 3 – Storage Upload:', { path: storagePath, type: file.type, size: file.size });

  const { error: uploadError } = await supabaseAdmin.storage
    .from('media')
    .upload(storagePath, file, { contentType: file.type });

  if (uploadError) {
    console.error('[upload] Schritt 3 FEHLER – Storage Upload:', {
      message:    uploadError.message,
      statusCode: (uploadError as { statusCode?: string }).statusCode,
    });
    return NextResponse.json({
      step:       'storage_upload',
      error:      uploadError.message,
      statusCode: (uploadError as { statusCode?: string }).statusCode,
      hint:       'Prüfe ob der Bucket "media" in Supabase existiert und öffentlich ist.',
    }, { status: 500 });
  }
  console.log('[upload] Schritt 3 OK – Datei hochgeladen:', storagePath);

  // ── Schritt 4: Öffentliche URL ───────────────────────────────
  const { data: { publicUrl } } = supabaseAdmin.storage.from('media').getPublicUrl(storagePath);
  console.log('[upload] Schritt 4 – Public URL:', publicUrl);

  // ── Schritt 5: Datenbank-Insert ──────────────────────────────
  const insertPayload = {
    brand_id:     brandId,
    file_name:    file.name,
    file_url:     publicUrl,
    storage_path: storagePath,
    media_type:   file.type.startsWith('video') ? 'video' : 'image',
    mime_type:    file.type,
    size_bytes:   file.size,
    tags,
  };
  console.log('[upload] Schritt 5 – DB Insert:', insertPayload);

  const { data, error: dbError } = await supabaseAdmin
    .from('media_items')
    .insert(insertPayload)
    .select()
    .single();

  if (dbError) {
    console.error('[upload] Schritt 5 FEHLER – DB Insert:', {
      message: dbError.message, code: dbError.code,
      details: dbError.details, hint: dbError.hint,
    });
    return NextResponse.json({
      step:    'db_insert',
      error:   dbError.message,
      code:    dbError.code,
      details: dbError.details,
      hint:    dbError.hint ?? 'Prüfe ob die Tabelle "media_items" existiert und alle Spalten stimmen.',
    }, { status: 500 });
  }
  console.log('[upload] Schritt 5 OK – DB-Eintrag:', data.id);

  // ── Schritt 6: Erfolg – camelCase zurückgeben ────────────────
  const result = {
    id:           data.id,
    brandId:      data.brand_id,
    type:         (data.media_type ?? 'image') as 'image' | 'video',
    filename:     data.file_name,
    url:          data.file_url,
    thumbnailUrl: data.file_url,
    sizeBytes:    data.size_bytes ?? file.size,
    tags:         Array.isArray(data.tags) ? data.tags : [],
    uploadedAt:   data.created_at ?? new Date().toISOString(),
  };
  console.log('[upload] ── Erfolgreich abgeschlossen ──', result.id);
  return NextResponse.json(result);
}

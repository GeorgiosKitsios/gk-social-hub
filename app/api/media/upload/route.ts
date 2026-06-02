import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  console.log('[upload] ── POST /api/media/upload gestartet ──');

  // ── Schritt 1: JSON-Body lesen ───────────────────────────────
  let brandId: string, fileName: string, fileType: string,
      fileSize: number, fileBase64: string, tags: string[];
  try {
    const body = await req.json();
    brandId    = body.brandId    ?? '';
    fileName   = body.fileName   ?? '';
    fileType   = body.fileType   ?? 'application/octet-stream';
    fileSize   = body.fileSize   ?? 0;
    fileBase64 = body.fileBase64 ?? '';
    tags       = Array.isArray(body.tags) ? body.tags : [];
    console.log('[upload] Schritt 1 – JSON Body:', {
      brandId, fileName, fileType, fileSize,
      base64Length: fileBase64.length,
      tags,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[upload] Schritt 1 FEHLER – JSON konnte nicht gelesen werden:', msg);
    return NextResponse.json({ step: 'json_parse', error: msg }, { status: 400 });
  }

  if (!fileBase64 || !brandId || !fileName) {
    console.error('[upload] Schritt 1 FEHLER – Pflichtfelder fehlen:', { fileBase64: !!fileBase64, brandId, fileName });
    return NextResponse.json({ step: 'validation', error: 'fileBase64, brandId und fileName sind erforderlich.' }, { status: 400 });
  }

  // ── Schritt 2: Env-Variablen prüfen ─────────────────────────
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  console.log('[upload] Schritt 2 – Env-Variablen:', {
    SUPABASE_URL_set:    !!supabaseUrl,
    SUPABASE_KEY_set:    !!supabaseKey,
    SUPABASE_URL_prefix: supabaseUrl?.slice(0, 30) ?? '(fehlt)',
  });
  if (!supabaseUrl || !supabaseKey) {
    console.error('[upload] Schritt 2 FEHLER – Supabase Env-Variablen nicht gesetzt!');
    return NextResponse.json({
      step: 'env',
      error: 'Supabase Umgebungsvariablen fehlen. NEXT_PUBLIC_SUPABASE_URL und NEXT_PUBLIC_SUPABASE_ANON_KEY in Hostinger setzen.',
    }, { status: 500 });
  }

  // ── Schritt 3: Base64 → Buffer → Supabase Storage ───────────
  const ext        = fileName.split('.').pop()?.toLowerCase() ?? 'bin';
  const storagePath = `${brandId}/${crypto.randomUUID()}.${ext}`;
  let fileBuffer: Buffer;
  try {
    fileBuffer = Buffer.from(fileBase64, 'base64');
    console.log('[upload] Schritt 3 – Buffer erzeugt:', { bytes: fileBuffer.length, path: storagePath });
  } catch (err) {
    console.error('[upload] Schritt 3 FEHLER – Base64 Dekodierung:', err);
    return NextResponse.json({ step: 'base64_decode', error: 'Base64 konnte nicht dekodiert werden.' }, { status: 400 });
  }

  const { error: uploadError } = await supabase.storage
    .from('media')
    .upload(storagePath, fileBuffer, { contentType: fileType });

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
  const { data: { publicUrl } } = supabase.storage.from('media').getPublicUrl(storagePath);
  console.log('[upload] Schritt 4 – Public URL:', publicUrl);

  // ── Schritt 5: Datenbank-Insert ──────────────────────────────
  const insertPayload = {
    brand_id:     brandId,
    file_name:    fileName,
    file_url:     publicUrl,
    storage_path: storagePath,
    media_type:   fileType.startsWith('video') ? 'video' : 'image',
    mime_type:    fileType,
    size_bytes:   fileSize,
    tags,
  };
  console.log('[upload] Schritt 5 – DB Insert:', insertPayload);

  const { data, error: dbError } = await supabase
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
    sizeBytes:    data.size_bytes ?? fileSize,
    tags:         Array.isArray(data.tags) ? data.tags : [],
    uploadedAt:   data.created_at ?? new Date().toISOString(),
  };
  console.log('[upload] ── Erfolgreich abgeschlossen ──', result.id);
  return NextResponse.json(result);
}

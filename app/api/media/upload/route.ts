import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  console.log('[upload] ── POST /api/media/upload gestartet ──');

  // ── Schritt 1: FormData lesen ────────────────────────────────
  let file: File, brandId: string, tags: string[];
  try {
    const formData = await req.formData();
    file    = formData.get('file')    as File;
    brandId = formData.get('brandId') as string;
    tags    = JSON.parse((formData.get('tags') as string) ?? '[]');
    console.log('[upload] Schritt 1 – FormData:', {
      fileName:  file?.name,
      fileType:  file?.type,
      fileSize:  file?.size,
      brandId,
      tags,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[upload] Schritt 1 FEHLER – FormData konnte nicht gelesen werden:', msg);
    return NextResponse.json({ step: 'formdata', error: msg }, { status: 400 });
  }

  if (!file || !brandId) {
    console.error('[upload] Schritt 1 FEHLER – file oder brandId fehlt:', { file: !!file, brandId });
    return NextResponse.json({ step: 'validation', error: 'file und brandId sind erforderlich.' }, { status: 400 });
  }

  // ── Schritt 2: Env-Variablen prüfen ─────────────────────────
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  console.log('[upload] Schritt 2 – Env-Variablen:', {
    SUPABASE_URL_set:  !!supabaseUrl,
    SUPABASE_KEY_set:  !!supabaseKey,
    SUPABASE_URL_prefix: supabaseUrl?.slice(0, 30) ?? '(fehlt)',
  });
  if (!supabaseUrl || !supabaseKey) {
    console.error('[upload] Schritt 2 FEHLER – Supabase Env-Variablen nicht gesetzt!');
    return NextResponse.json({ step: 'env', error: 'Supabase Umgebungsvariablen fehlen. Bitte NEXT_PUBLIC_SUPABASE_URL und NEXT_PUBLIC_SUPABASE_ANON_KEY in Hostinger setzen.' }, { status: 500 });
  }

  // ── Schritt 3: Supabase Storage Upload ──────────────────────
  const ext  = file.name.split('.').pop() ?? 'bin';
  const path = `${brandId}/${crypto.randomUUID()}.${ext}`;
  console.log('[upload] Schritt 3 – Storage Upload:', { bucket: 'media', path });

  const { error: uploadError } = await supabase.storage
    .from('media')
    .upload(path, file);

  if (uploadError) {
    console.error('[upload] Schritt 3 FEHLER – Storage Upload:', {
      message:    uploadError.message,
      statusCode: (uploadError as { statusCode?: string }).statusCode,
      error:      uploadError,
    });
    return NextResponse.json({
      step:        'storage_upload',
      error:       uploadError.message,
      statusCode:  (uploadError as { statusCode?: string }).statusCode,
      hint:        'Prüfe ob der Bucket "media" in Supabase existiert und Public ist.',
    }, { status: 500 });
  }
  console.log('[upload] Schritt 3 OK – Datei hochgeladen:', path);

  // ── Schritt 4: Öffentliche URL ───────────────────────────────
  const { data: { publicUrl } } = supabase.storage.from('media').getPublicUrl(path);
  console.log('[upload] Schritt 4 – Public URL:', publicUrl);

  // ── Schritt 5: Datenbank-Insert ──────────────────────────────
  const insertPayload = {
    brand_id:     brandId,
    file_name:    file.name,
    file_url:     publicUrl,
    storage_path: path,
    media_type:   file.type.startsWith('video') ? 'video' : 'image',
    mime_type:    file.type,
    size_bytes:   file.size,
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
      message: dbError.message,
      code:    dbError.code,
      details: dbError.details,
      hint:    dbError.hint,
    });
    return NextResponse.json({
      step:    'db_insert',
      error:   dbError.message,
      code:    dbError.code,
      details: dbError.details,
      hint:    dbError.hint ?? 'Prüfe ob die Tabelle "media_items" in Supabase existiert und alle Spalten korrekt sind.',
    }, { status: 500 });
  }
  console.log('[upload] Schritt 5 OK – DB-Eintrag erstellt:', data.id);

  // ── Schritt 6: Erfolg ────────────────────────────────────────
  const result = {
    id:           data.id,
    brandId:      data.brand_id,
    type:         data.media_type as 'image' | 'video',
    filename:     data.file_name,
    url:          data.file_url,
    thumbnailUrl: data.file_url,
    sizeBytes:    data.size_bytes ?? file.size,
    tags:         data.tags ?? [],
    uploadedAt:   data.created_at ?? new Date().toISOString(),
  };
  console.log('[upload] ── Erfolgreich abgeschlossen ──', result.id);
  return NextResponse.json(result);
}

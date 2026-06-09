import { NextRequest, NextResponse } from 'next/server';
import type { UploadApiResponse, UploadApiOptions } from 'cloudinary';
import { hasSupabaseAdminConfig, supabaseAdmin } from '@/lib/supabase';
import { cloudinary, hasCloudinaryConfig } from '@/lib/cloudinary';

/** Buffer per Upload-Stream zu Cloudinary hochladen (Bild oder Video). */
function uploadToCloudinary(buffer: Buffer, options: UploadApiOptions): Promise<UploadApiResponse> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (error, result) => {
      if (error || !result) reject(error ?? new Error('Cloudinary lieferte kein Ergebnis.'));
      else resolve(result);
    });
    stream.end(buffer);
  });
}

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
  console.log('[upload] Schritt 2 – Config-Check:', {
    cloudinary_set: hasCloudinaryConfig(),
    supabase_set:   hasSupabaseAdminConfig(),
  });
  if (!hasCloudinaryConfig()) {
    console.error('[upload] Schritt 2 FEHLER – Cloudinary-Env fehlt!');
    return NextResponse.json({
      step:  'env',
      error: 'Cloudinary ist nicht konfiguriert. Bitte CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY und CLOUDINARY_API_SECRET in den Env-Variablen setzen.',
    }, { status: 500 });
  }
  if (!hasSupabaseAdminConfig()) {
    console.error('[upload] Schritt 2 FEHLER – SUPABASE_SERVICE_ROLE_KEY fehlt!');
    return NextResponse.json({
      step:  'env',
      error: 'SUPABASE_SERVICE_ROLE_KEY fehlt. Die Medien-Metadaten werden in Supabase (media_items) gespeichert.',
    }, { status: 500 });
  }

  // ── Schritt 3: Datei zu Cloudinary hochladen ─────────────────
  const isVideo = file.type.startsWith('video');
  let upload: UploadApiResponse;
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    console.log('[upload] Schritt 3 – Cloudinary Upload:', { folder: `gk-social-hub/${brandId}`, type: file.type, size: file.size });

    upload = await uploadToCloudinary(buffer, {
      folder:        `gk-social-hub/${brandId}`,
      resource_type: 'auto', // Bild oder Video automatisch erkennen
    });
    console.log('[upload] Schritt 3 OK – Cloudinary:', { public_id: upload.public_id, url: upload.secure_url });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[upload] Schritt 3 FEHLER – Cloudinary Upload:', msg);
    return NextResponse.json({
      step:  'cloudinary_upload',
      error: msg,
      hint:  'Prüfe die Cloudinary-Credentials und das Upload-Limit deines Accounts.',
    }, { status: 500 });
  }

  // ── Schritt 4: Datenbank-Insert (Metadaten + Cloudinary-URL) ─
  const insertPayload = {
    brand_id:     brandId,
    file_name:    file.name,
    file_url:     upload.secure_url,  // öffentliche HTTPS-URL von Cloudinary
    storage_path: upload.public_id,   // Cloudinary public_id (zum Löschen)
    media_type:   isVideo ? 'video' : 'image',
    mime_type:    file.type,
    size_bytes:   file.size,
    tags,
  };
  console.log('[upload] Schritt 4 – DB Insert:', insertPayload);

  const { data, error: dbError } = await supabaseAdmin
    .from('media_items')
    .insert(insertPayload)
    .select()
    .single();

  if (dbError) {
    console.error('[upload] Schritt 4 FEHLER – DB Insert:', {
      message: dbError.message, code: dbError.code,
      details: dbError.details, hint: dbError.hint,
    });
    // Verwaiste Cloudinary-Datei wieder entfernen, damit nichts hängen bleibt.
    try {
      await cloudinary.uploader.destroy(upload.public_id, {
        resource_type: isVideo ? 'video' : 'image',
      });
    } catch (cleanupErr) {
      console.warn('[upload] Cleanup der Cloudinary-Datei fehlgeschlagen:', cleanupErr);
    }
    return NextResponse.json({
      step:    'db_insert',
      error:   dbError.message,
      code:    dbError.code,
      details: dbError.details,
      hint:    dbError.hint ?? 'Prüfe ob die Tabelle "media_items" existiert und alle Spalten stimmen.',
    }, { status: 500 });
  }
  console.log('[upload] Schritt 4 OK – DB-Eintrag:', data.id);

  // ── Schritt 5: Erfolg – camelCase zurückgeben ────────────────
  const mediaType = (data.media_type ?? (isVideo ? 'video' : 'image')) as 'image' | 'video';
  const createdAt = data.created_at ?? new Date().toISOString();
  const result = {
    id:           data.id,
    brandId:      data.brand_id,
    fileName:     data.file_name,
    fileUrl:      data.file_url,
    mediaType,
    tags:         Array.isArray(data.tags) ? data.tags : [],
    createdAt,
    updatedAt:    data.updated_at ?? createdAt,
    uploadedAt:   createdAt,

    // Bestehende Frontend-/Store-Felder beibehalten.
    type:         mediaType,
    filename:     data.file_name,
    url:          data.file_url,
    thumbnailUrl: data.file_url,
    sizeBytes:    data.size_bytes ?? file.size,
    storagePath:  data.storage_path ?? upload.public_id,
  };
  console.log('[upload] ── Erfolgreich abgeschlossen ──', result.id);
  return NextResponse.json(result);
}

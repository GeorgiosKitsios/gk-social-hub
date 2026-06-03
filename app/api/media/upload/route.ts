import { NextRequest, NextResponse } from 'next/server';
import { hasSupabaseAdminConfig, supabaseAdmin } from '@/lib/supabase';

const MAX_UPLOAD_SIZE_BYTES = 50 * 1024 * 1024;
const ALLOWED_FILE_TYPES = new Set(['image/jpeg', 'image/png', 'video/mp4', 'video/quicktime']);
const EXTENSIONS_BY_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
};

type SignedUploadRequest = {
  brandId?: unknown;
  fileName?: unknown;
  fileType?: unknown;
  fileSize?: unknown;
};

function getValidationError({ brandId, fileName, fileType, fileSize }: SignedUploadRequest) {
  if (typeof brandId !== 'string' || !brandId.trim()) {
    return 'brandId ist erforderlich.';
  }

  if (typeof fileName !== 'string' || !fileName.trim()) {
    return 'Dateiname ist erforderlich.';
  }

  if (typeof fileType !== 'string' || !ALLOWED_FILE_TYPES.has(fileType)) {
    return 'Dateityp nicht erlaubt. Erlaubt sind JPG, PNG, MP4 und MOV.';
  }

  if (typeof fileSize !== 'number' || !Number.isFinite(fileSize) || fileSize <= 0) {
    return 'Dateigröße ist erforderlich.';
  }

  if (fileSize > MAX_UPLOAD_SIZE_BYTES) {
    return 'Datei zu groß (max. 50 MB).';
  }

  return null;
}

export async function POST(req: NextRequest) {
  let body: SignedUploadRequest;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ step: 'validation', error: 'Ungültige Upload-Anfrage.' }, { status: 400 });
  }

  const validationError = getValidationError(body);
  if (validationError) {
    return NextResponse.json({ step: 'validation', error: validationError }, { status: 400 });
  }

  if (!hasSupabaseAdminConfig()) {
    return NextResponse.json({
      step: 'env',
      error: 'SUPABASE_SERVICE_ROLE_KEY fehlt. Signed Upload URLs müssen serverseitig mit dem Service Role Key erstellt werden.',
    }, { status: 500 });
  }

  const brandId = (body.brandId as string).trim();
  const fileType = body.fileType as string;
  const storagePath = `${brandId}/${crypto.randomUUID()}.${EXTENSIONS_BY_TYPE[fileType]}`;

  const { data, error } = await supabaseAdmin.storage
    .from('media')
    .createSignedUploadUrl(storagePath);

  if (error || !data?.token) {
    console.error('[api/media/upload] Signed URL konnte nicht erstellt werden:', error);
    return NextResponse.json({
      step: 'signed_upload_url',
      error: `Signed URL konnte nicht erstellt werden${error?.message ? `: ${error.message}` : '.'}`,
      hint: 'Prüfe, ob der Supabase Storage Bucket "media" existiert.',
    }, { status: 500 });
  }

  return NextResponse.json({
    bucket: 'media',
    storagePath: data.path,
    signedUrl: data.signedUrl,
    token: data.token,
  });
}

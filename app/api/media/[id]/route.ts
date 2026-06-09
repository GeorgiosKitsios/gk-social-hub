import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { cloudinary } from '@/lib/cloudinary';

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  // Optionaler Fallback-public_id aus dem Body (Store schickt storagePath mit).
  let bodyPublicId: string | undefined;
  try {
    const body = await req.json();
    bodyPublicId = body?.storagePath || undefined;
  } catch { /* kein Body – ok */ }

  // Zeile laden, um public_id + media_type (image/video) zu bestimmen.
  const { data: row } = await supabaseAdmin
    .from('media_items')
    .select('storage_path, media_type')
    .eq('id', params.id)
    .maybeSingle();

  const publicId     = (row?.storage_path as string | undefined) ?? bodyPublicId;
  const resourceType = row?.media_type === 'video' ? 'video' : 'image';

  // Datei aus Cloudinary entfernen (Fehler nicht fatal – DB-Eintrag soll trotzdem weg).
  if (publicId) {
    try {
      await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
    } catch (err) {
      console.warn('[media delete] Cloudinary destroy fehlgeschlagen:', err);
    }
  }

  const { error } = await supabaseAdmin
    .from('media_items')
    .delete()
    .eq('id', params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

/**
 * app/api/cron/sync/route.ts
 *
 * Synchronisiert geplante Posts und Facebook-Pages aus dem Client (localStorage)
 * in Supabase, damit der Cron-Job unter /api/cron/publish sie verarbeiten kann.
 *
 * Wird vom PostEditor aufgerufen, wenn ein Post geplant wird.
 *
 * POST /api/cron/sync
 * Body: { posts: Post[], facebookPages: FacebookPage[] }
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, hasSupabaseAdminConfig } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

interface PostPayload {
  id:             string;
  brandId:        string;
  title:          string;
  mainText:       string;
  platformTexts?: Record<string, string>;
  platforms:      string[];
  mediaIds:       string[];
  status:         string;
  scheduledAt?:   string | null;
  publishedAt?:   string | null;
  errorMessage?:  string | null;
  createdAt:      string;
  updatedAt:      string;
}

interface FbPagePayload {
  id:           string;
  name:         string;
  access_token: string;
  brand_id?:    string;
}

export async function POST(req: NextRequest) {
  console.log('[SYNC] ── sync job gestartet ──');

  if (!hasSupabaseAdminConfig()) {
    return NextResponse.json({ error: 'Supabase nicht konfiguriert.' }, { status: 500 });
  }

  let posts: PostPayload[] = [];
  let facebookPages: FbPagePayload[] = [];

  try {
    const body       = await req.json();
    posts            = Array.isArray(body.posts)         ? body.posts         : [];
    facebookPages    = Array.isArray(body.facebookPages) ? body.facebookPages : [];
  } catch {
    return NextResponse.json({ error: 'Ungültiger Request-Body.' }, { status: 400 });
  }

  console.log(`[SYNC] ${posts.length} Posts, ${facebookPages.length} FB-Pages`);

  // ── Posts upserten ──────────────────────────────────────────────────────────
  const postRows = posts.map(p => ({
    id:             p.id,
    brand_id:       p.brandId,
    title:          p.title,
    main_text:      p.mainText,
    platform_texts: p.platformTexts ?? null,
    platforms:      p.platforms,
    media_ids:      p.mediaIds,
    status:         p.status,
    scheduled_at:   p.scheduledAt   ?? null,
    published_at:   p.publishedAt   ?? null,
    error_message:  p.errorMessage  ?? null,
    created_at:     p.createdAt,
    updated_at:     p.updatedAt,
  }));

  const { error: postError } = await supabaseAdmin
    .from('posts')
    .upsert(postRows, { onConflict: 'id' });

  if (postError) {
    console.error('[SYNC] Post-Upsert Fehler:', postError);
    return NextResponse.json({
      error:  `Post-Sync fehlgeschlagen: ${postError.message}`,
      hint:   'Prüfe ob die Tabelle "posts" in Supabase existiert.',
    }, { status: 500 });
  }
  console.log(`[SYNC] ${postRows.length} Posts gespeichert`);

  // ── Facebook-Pages upserten ─────────────────────────────────────────────────
  if (facebookPages.length > 0) {
    const pageRows = facebookPages.map(p => ({
      page_id:      p.id,
      name:         p.name,
      access_token: p.access_token,
      brand_id:     p.brand_id ?? null,
    }));

    const { error: pageError } = await supabaseAdmin
      .from('facebook_pages')
      .upsert(pageRows, { onConflict: 'page_id' });

    if (pageError) {
      console.warn('[SYNC] FB-Pages Fehler (nicht kritisch):', pageError.message);
    } else {
      console.log(`[SYNC] ${pageRows.length} FB-Pages gespeichert`);
    }
  }

  return NextResponse.json({
    success:     true,
    postsSynced: postRows.length,
    pagesSynced: facebookPages.length,
  });
}

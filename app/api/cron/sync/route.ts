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
  igPostType?:    'feed' | 'story' | null;
  createdAt:      string;
  updatedAt:      string;
}

interface FbPagePayload {
  id:           string;
  name:         string;
  access_token: string;
  brand_id?:    string;
}

interface IgAccountPayload {
  id:          string;  // = Facebook Page ID (PK in instagram_accounts)
  name:        string;
  accountId:   string;  // IG Business Account ID
  accessToken: string;
}

export async function POST(req: NextRequest) {
  console.log('[SYNC] ── sync job gestartet ──');

  if (!hasSupabaseAdminConfig()) {
    return NextResponse.json({ error: 'Supabase nicht konfiguriert.' }, { status: 500 });
  }

  let posts: PostPayload[] = [];
  let facebookPages: FbPagePayload[] = [];
  let instagramAccounts: IgAccountPayload[] = [];

  try {
    const body        = await req.json();
    posts             = Array.isArray(body.posts)             ? body.posts             : [];
    facebookPages     = Array.isArray(body.facebookPages)     ? body.facebookPages     : [];
    instagramAccounts = Array.isArray(body.instagramAccounts) ? body.instagramAccounts : [];
  } catch {
    return NextResponse.json({ error: 'Ungültiger Request-Body.' }, { status: 400 });
  }

  console.log(`[SYNC] ${posts.length} Posts, ${facebookPages.length} FB-Pages, ${instagramAccounts.length} IG-Accounts`);

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
    ig_post_type:   p.igPostType    ?? 'feed',
    created_at:     p.createdAt,
    updated_at:     p.updatedAt,
  }));

  let { error: postError } = await supabaseAdmin
    .from('posts')
    .upsert(postRows, { onConflict: 'id' });

  // Fallback: Spalte ig_post_type existiert noch nicht (SQL-Migration ausstehend)
  if (postError && postError.code === '42703') {
    console.warn('[SYNC] Spalte ig_post_type fehlt – Retry ohne das Feld. SQL-Migration ausführen:',
      "ALTER TABLE posts ADD COLUMN ig_post_type TEXT DEFAULT 'feed';");
    const rowsWithoutIgType = postRows.map(({ ig_post_type: _omit, ...rest }) => rest);
    ({ error: postError } = await supabaseAdmin
      .from('posts')
      .upsert(rowsWithoutIgType, { onConflict: 'id' }));
  }

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
    // brand_id nur einschließen wenn explizit gesetzt – so werden korrekt gesetzte
    // Werte in Supabase nicht durch null aus dem localStorage überschrieben.
    const pageRows = facebookPages.map(p => {
      const row: Record<string, unknown> = {
        page_id:      p.id,
        name:         p.name,
        access_token: p.access_token,
      };
      if (p.brand_id != null) row.brand_id = p.brand_id;
      return row;
    });

    const { error: pageError } = await supabaseAdmin
      .from('facebook_pages')
      .upsert(pageRows, { onConflict: 'page_id' });

    if (pageError) {
      console.warn('[SYNC] FB-Pages Fehler (nicht kritisch):', pageError.message);
    } else {
      console.log(`[SYNC] ${pageRows.length} FB-Pages gespeichert`);
    }
  }

  // ── Instagram-Accounts upserten ────────────────────────────────────────────
  // id = Facebook Page ID, dient als Join-Schlüssel im Cron-Job
  // (instagram_accounts.id = facebook_pages.page_id → Brand-Zuordnung)
  let igAccountsSynced = 0;
  if (instagramAccounts.length > 0) {
    const igRows = instagramAccounts.map(a => ({
      id:           a.id,
      name:         a.name,
      account_id:   a.accountId,
      access_token: a.accessToken,
      updated_at:   new Date().toISOString(),
    }));

    const { error: igError } = await supabaseAdmin
      .from('instagram_accounts')
      .upsert(igRows, { onConflict: 'id' });

    if (igError) {
      console.error('[SYNC] IG-Accounts Upsert FEHLER:', igError.message, '| Code:', igError.code, '| Details:', igError.details);
      return NextResponse.json({
        success:     false,
        error:       `IG-Sync fehlgeschlagen: ${igError.message}`,
        code:        igError.code,
        postsSynced: postRows.length,
        pagesSynced: facebookPages.length,
        igAccountsSynced: 0,
      }, { status: 500 });
    }

    igAccountsSynced = igRows.length;
    console.log(`[SYNC] ${igRows.length} IG-Accounts gespeichert (IDs: ${igRows.map(r => r.id).join(', ')})`);
  }

  return NextResponse.json({
    success:          true,
    postsSynced:      postRows.length,
    pagesSynced:      facebookPages.length,
    igAccountsSynced,
  });
}

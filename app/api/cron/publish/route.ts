/**
 * app/api/cron/publish/route.ts
 *
 * Automatischer Publish-Job – wird von Hostinger Cron Jobs alle 5 Minuten aufgerufen:
 *   GET https://deine-domain.com/api/cron/publish?secret=DEIN_CRON_SECRET
 *
 * Benötigte Supabase-Tabellen:
 *   posts         – id, brand_id, title, main_text, platform_texts(jsonb),
 *                   platforms(text[]), media_ids(text[]), status(text),
 *                   scheduled_at(timestamptz), published_at(timestamptz),
 *                   error_message(text), created_at, updated_at
 *
 *   facebook_pages – id, brand_id, name(text), page_id(text), access_token(text)
 *
 * Posts aus dem localStorage-Store werden über POST /api/cron/sync in Supabase
 * synchronisiert, damit dieser Cron-Job sie findet.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, hasSupabaseAdminConfig } from '@/lib/supabase';

const FB_API = 'https://graph.facebook.com/v19.0';

// Erzwinge serverseitiges Rendering — kein statisches Caching
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// ── Typen ─────────────────────────────────────────────────────────────────────

interface PostRow {
  id:              string;
  brand_id:        string;
  title?:          string | null;
  main_text?:      string | null;
  platform_texts?: Record<string, string> | null;
  platforms?:      string[] | null;
  media_ids?:      string[] | null;
  status:          string;
  scheduled_at?:   string | null;
}

interface FbPageRow {
  brand_id:     string;
  name:         string;
  page_id:      string;
  access_token: string;
}

interface MediaRow {
  id:          string;
  file_url:    string;
  media_type?: string | null;
}

// ── GET-Handler ───────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const startTime = Date.now();
  console.log('[CRON] ── publish job gestartet ──', new Date().toISOString());

  // ── 1. CRON_SECRET prüfen ───────────────────────────────────────────────────
  const providedSecret = req.nextUrl.searchParams.get('secret')
    ?? req.headers.get('x-cron-secret')
    ?? '';
  const cronSecret = process.env.CRON_SECRET ?? '';

  if (!cronSecret) {
    console.error('[CRON] FEHLER – CRON_SECRET Env-Variable nicht gesetzt!');
    return NextResponse.json({
      error: 'CRON_SECRET ist nicht konfiguriert. Bitte in Hostinger Env-Variablen setzen.',
    }, { status: 500 });
  }
  if (providedSecret !== cronSecret) {
    console.warn('[CRON] Ungültiger Secret-Key – Zugriff verweigert');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ── 2. Supabase-Verbindung prüfen ───────────────────────────────────────────
  if (!hasSupabaseAdminConfig()) {
    console.error('[CRON] FEHLER – Supabase Admin nicht konfiguriert');
    return NextResponse.json({
      error: 'SUPABASE_SERVICE_ROLE_KEY fehlt. Bitte in Hostinger Env-Variablen setzen.',
    }, { status: 500 });
  }

  const now = new Date().toISOString();
  console.log(`[CRON] Suche Posts mit status=scheduled und scheduled_at ≤ ${now}`);

  // ── 3. Fällige Posts aus Supabase laden ─────────────────────────────────────
  const { data: rawPosts, error: queryError } = await supabaseAdmin
    .from('posts')
    .select('id, brand_id, title, main_text, platform_texts, platforms, media_ids, status, scheduled_at')
    .eq('status', 'scheduled')
    .lte('scheduled_at', now)
    .order('scheduled_at', { ascending: true });

  if (queryError) {
    console.error('[CRON] Datenbankfehler:', queryError);
    return NextResponse.json({
      error:   `Datenbankfehler: ${queryError.message}`,
      code:    queryError.code,
      hint:    'Prüfe ob die Tabelle "posts" in Supabase existiert.',
    }, { status: 500 });
  }

  const posts = (rawPosts ?? []) as PostRow[];
  console.log(`[CRON] ${posts.length} fällige Post(s) gefunden`);

  if (posts.length === 0) {
    return NextResponse.json({
      message:    'Keine fälligen Posts.',
      processed:  0,
      runAt:      now,
      durationMs: Date.now() - startTime,
    });
  }

  // ── 4. Facebook-Pages aus Supabase laden ────────────────────────────────────
  const { data: rawPages } = await supabaseAdmin
    .from('facebook_pages')
    .select('brand_id, name, page_id, access_token');
  const fbPages = (rawPages ?? []) as FbPageRow[];
  console.log(`[CRON] ${fbPages.length} Facebook-Page(s) geladen`);

  // ── 5. Posts verarbeiten ────────────────────────────────────────────────────
  const results: Array<{
    id:        string;
    title:     string;
    success:   boolean;
    fbResults: Array<{ page: string; success: boolean; postId?: string; error?: string }>;
    errorMessage?: string;
  }> = [];

  for (const post of posts) {
    console.log(`\n[CRON] ── Post ${post.id} – "${post.title ?? '–'}" ──`);

    const fbResults: Array<{ page: string; success: boolean; postId?: string; error?: string }> = [];
    let anySuccess        = false;
    let anyError          = false;
    const errorMessages: string[] = [];

    // ── Facebook ──────────────────────────────────────────────────────────────
    if (post.platforms?.includes('facebook')) {
      const pagesForBrand = fbPages.filter(p => p.brand_id === post.brand_id);
      console.log(`[CRON]   FB: ${pagesForBrand.length} Page(s) für Brand ${post.brand_id}`);

      if (pagesForBrand.length === 0) {
        const msg = `Keine Facebook-Page für Brand "${post.brand_id}" in Supabase gefunden.`;
        console.warn(`[CRON]   ⚠ ${msg}`);
        errorMessages.push(msg);
        anyError = true;
      }

      for (const page of pagesForBrand) {
        const message = (post.platform_texts as Record<string, string> | null)?.facebook
          ?? post.main_text
          ?? '';

        console.log(`[CRON]   → ${page.name} (${page.page_id}) | Text: ${message.slice(0, 40)}…`);

        try {
          // Erstes Bild laden, falls vorhanden
          let imageUrl: string | undefined;
          if (post.media_ids && post.media_ids.length > 0) {
            const { data: mediaRow } = await supabaseAdmin
              .from('media_items')
              .select('id, file_url, media_type')
              .eq('id', post.media_ids[0])
              .maybeSingle();
            const media = mediaRow as MediaRow | null;
            if (media?.media_type === 'image' && media.file_url?.startsWith('https://')) {
              imageUrl = media.file_url;
              console.log(`[CRON]   Bild: ${imageUrl.slice(0, 60)}…`);
            }
          }

          let fbRes: Response;

          if (imageUrl) {
            // Bild-Post: Bild von Supabase laden und an Facebook hochladen
            const imgFetch = await fetch(imageUrl);
            if (!imgFetch.ok) throw new Error(`Bild konnte nicht geladen werden (${imgFetch.status})`);
            const imgBuffer = await imgFetch.arrayBuffer();
            const blob       = new Blob([imgBuffer], {
              type: imgFetch.headers.get('content-type') ?? 'image/jpeg',
            });
            const formData = new FormData();
            formData.append('source',       blob, 'image.jpg');
            formData.append('message',      message);
            formData.append('access_token', page.access_token);
            fbRes = await fetch(`${FB_API}/${page.page_id}/photos`, {
              method: 'POST', body: formData,
            });
          } else {
            // Text-Post
            fbRes = await fetch(`${FB_API}/${page.page_id}/feed`, {
              method:  'POST',
              headers: { 'Content-Type': 'application/json' },
              body:    JSON.stringify({ message, access_token: page.access_token }),
            });
          }

          const fbData = await fbRes.json();

          if (fbData.error) {
            const errMsg = fbData.error.message ?? 'Unbekannter Facebook-Fehler';
            console.error(`[CRON]   ✕ ${page.name}: ${errMsg} (Code ${fbData.error.code})`);
            fbResults.push({ page: page.name, success: false, error: errMsg });
            errorMessages.push(`FB ${page.name}: ${errMsg}`);
            anyError = true;
          } else {
            console.log(`[CRON]   ✓ ${page.name}: veröffentlicht, Post-ID ${fbData.id}`);
            fbResults.push({ page: page.name, success: true, postId: fbData.id });
            anySuccess = true;
          }

        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          console.error(`[CRON]   ✕ ${page.name} Fehler:`, errMsg);
          fbResults.push({ page: page.name, success: false, error: errMsg });
          errorMessages.push(`FB ${page.name}: ${errMsg}`);
          anyError = true;
        }
      }
    }

    // ── Status in Supabase aktualisieren ──────────────────────────────────────
    const newStatus = anySuccess ? 'published' : (anyError ? 'error' : 'error');
    const updatePayload: Record<string, unknown> = {
      status:     newStatus,
      updated_at: new Date().toISOString(),
    };
    if (anySuccess)         updatePayload.published_at  = new Date().toISOString();
    if (!anySuccess)        updatePayload.error_message = errorMessages.join(' | ');
    if (anySuccess)         updatePayload.error_message = null;

    const { error: updateError } = await supabaseAdmin
      .from('posts')
      .update(updatePayload)
      .eq('id', post.id);

    if (updateError) {
      console.error(`[CRON] Status-Update fehlgeschlagen für Post ${post.id}:`, updateError.message);
    } else {
      console.log(`[CRON] Post ${post.id} → status: ${newStatus}`);
    }

    results.push({
      id:           post.id,
      title:        post.title ?? '',
      success:      anySuccess,
      fbResults,
      errorMessage: errorMessages.length > 0 ? errorMessages.join(' | ') : undefined,
    });
  }

  // ── 6. Ergebnis zurückgeben ─────────────────────────────────────────────────
  const durationMs = Date.now() - startTime;
  const successful = results.filter(r => r.success).length;
  console.log(`\n[CRON] ── Job abgeschlossen: ${successful}/${results.length} erfolgreich | ${durationMs}ms ──`);

  return NextResponse.json({
    processed:  results.length,
    successful,
    failed:     results.length - successful,
    results,
    runAt:      now,
    durationMs,
  });
}

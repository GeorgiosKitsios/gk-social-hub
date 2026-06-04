/**
 * app/api/cron/publish/route.ts
 *
 * Automatischer Publish-Job – wird von GitHub Actions/Hostinger Cron Jobs aufgerufen:
 *   POST https://deine-domain.com/api/cron/publish
 *   Authorization: Bearer DEIN_CRON_SECRET
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
export const revalidate = 0;
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

// ── GET-/POST-Handler ─────────────────────────────────────────────────────────

function getBearerToken(req: NextRequest) {
  const authHeader = req.headers.get('authorization') ?? '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? '';
}

async function runPublishJob(req: NextRequest) {
  const startTime = Date.now();
  const runAt     = new Date().toISOString();
  console.log('[CRON] ── publish job gestartet ──', runAt);

  // Hilfsfunktion: immer 200 zurückgeben mit ok:false bei Fehlern
  // → GitHub Actions schlägt nicht fehl, Fehlerdetails sind im Body sichtbar
  function cronError(reason: string, detail?: Record<string, unknown>) {
    console.error('[CRON] FEHLER:', reason, detail ?? '');
    return NextResponse.json({ ok: false, error: reason, runAt, durationMs: Date.now() - startTime, ...detail });
  }

  // Äußerer try/catch – fängt alle unerwarteten Fehler ab
  try {

    // ── 1. CRON_SECRET prüfen ─────────────────────────────────────────────────
    const providedSecret = getBearerToken(req);
    const cronSecret = process.env.CRON_SECRET ?? '';

    console.log('[CRON] Schritt 1 – Secret-Check:', {
      secret_env_set:      !!cronSecret,
      secret_provided_set: !!providedSecret,
    });

    if (!cronSecret) {
      // 500 erlaubt hier: Konfigurationsfehler, kein normaler Betrieb
      return NextResponse.json({
        ok: false,
        error: 'CRON_SECRET ist nicht konfiguriert. Bitte in Hostinger Env-Variablen setzen.',
        runAt,
      }, { status: 500 });
    }
    if (providedSecret !== cronSecret) {
      console.warn('[CRON] Ungültiger Secret-Key');
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    // ── 2. Supabase-Verbindung prüfen ─────────────────────────────────────────
    const supabaseUrl    = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    console.log('[CRON] Schritt 2 – Supabase-Config:', {
      url_set:  !!supabaseUrl,
      key_set:  !!serviceRoleKey,
      url_prefix: supabaseUrl?.slice(0, 30) ?? '(fehlt)',
    });

    if (!hasSupabaseAdminConfig()) {
      return cronError(
        'SUPABASE_SERVICE_ROLE_KEY fehlt. Bitte in Hostinger Env-Variablen setzen.',
        { hint: 'Ohne Service Role Key können Supabase-Tabellen nicht abgefragt werden.' }
      );
    }

    const now = new Date().toISOString();

    // ── 3. Fällige Posts aus Supabase laden ───────────────────────────────────
    console.log(`[CRON] Schritt 3 – Lade Posts (status=scheduled, scheduled_at ≤ ${now})`);

    const { data: rawPosts, error: queryError } = await supabaseAdmin
      .from('posts')
      .select('id, brand_id, title, main_text, platform_texts, platforms, media_ids, status, scheduled_at')
      .eq('status', 'scheduled')
      .lte('scheduled_at', now)
      .order('scheduled_at', { ascending: true });

    if (queryError) {
      return cronError(`Datenbankfehler beim Laden der Posts: ${queryError.message}`, {
        code:    queryError.code,
        details: queryError.details,
        hint:    'Prüfe ob die Tabelle "posts" in Supabase existiert.',
      });
    }

    const posts = (rawPosts ?? []) as PostRow[];
    console.log(`[CRON] Schritt 3 OK – ${posts.length} fällige Post(s) gefunden`);

    if (posts.length === 0) {
      return NextResponse.json({ ok: true, message: 'Keine fälligen Posts.', processed: 0, runAt, durationMs: Date.now() - startTime });
    }

    // ── 4. Facebook-Pages aus Supabase laden ──────────────────────────────────
    console.log('[CRON] Schritt 4 – Lade Facebook-Pages');

    const { data: rawPages, error: pagesError } = await supabaseAdmin
      .from('facebook_pages')
      .select('brand_id, name, page_id, access_token');

    if (pagesError) {
      console.warn('[CRON] Schritt 4 WARNUNG – Facebook-Pages konnten nicht geladen werden:', pagesError.message);
    }

    const fbPages = (rawPages ?? []) as FbPageRow[];
    console.log(`[CRON] Schritt 4 – ${fbPages.length} Facebook-Page(s) geladen`);

    // ── 5. Posts verarbeiten ──────────────────────────────────────────────────
    const results: Array<{
      id:           string;
      title:        string;
      success:      boolean;
      fbResults:    Array<{ page: string; success: boolean; postId?: string; error?: string }>;
      errorMessage?: string;
    }> = [];

    for (const post of posts) {
      console.log(`\n[CRON] ── Post ${post.id} – "${post.title ?? '–'}" (brand: ${post.brand_id}) ──`);

      const fbResults: Array<{ page: string; success: boolean; postId?: string; error?: string }> = [];
      let anySuccess      = false;
      const errorMessages: string[] = [];

      // ── Facebook ────────────────────────────────────────────────────────────
      if (post.platforms?.includes('facebook')) {
        const pagesForBrand = fbPages.filter(p => p.brand_id === post.brand_id);
        console.log(`[CRON]   FB: ${pagesForBrand.length} Page(s) für Brand ${post.brand_id}`);

        if (pagesForBrand.length === 0) {
          const msg = `Keine Facebook-Page für Brand "${post.brand_id}" in Tabelle facebook_pages gefunden.`;
          console.warn(`[CRON]   ⚠ ${msg}`);
          errorMessages.push(msg);
        }

        for (const page of pagesForBrand) {
          const message = (post.platform_texts as Record<string, string> | null)?.facebook
            ?? post.main_text
            ?? '';

          console.log(`[CRON]   → ${page.name} (${page.page_id})`);
          console.log(`[CRON]     Text: "${message.slice(0, 60)}${message.length > 60 ? '…' : ''}"`);

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
                console.log(`[CRON]     Bild: ${imageUrl.slice(0, 70)}…`);
              } else {
                console.log(`[CRON]     Kein verwendbares Bild (media_type=${media?.media_type ?? 'null'})`);
              }
            }

            let fbRes: Response;

            if (imageUrl) {
              const imgFetch = await fetch(imageUrl);
              if (!imgFetch.ok) throw new Error(`Bild konnte nicht geladen werden (HTTP ${imgFetch.status})`);
              const imgBuffer = await imgFetch.arrayBuffer();
              const blob       = new Blob([imgBuffer], { type: imgFetch.headers.get('content-type') ?? 'image/jpeg' });
              const formData   = new FormData();
              formData.append('source',       blob, 'image.jpg');
              formData.append('message',      message);
              formData.append('access_token', page.access_token);
              console.log(`[CRON]     → POST ${FB_API}/${page.page_id}/photos`);
              fbRes = await fetch(`${FB_API}/${page.page_id}/photos`, { method: 'POST', body: formData });
            } else {
              console.log(`[CRON]     → POST ${FB_API}/${page.page_id}/feed`);
              fbRes = await fetch(`${FB_API}/${page.page_id}/feed`, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ message, access_token: page.access_token }),
              });
            }

            const fbData = await fbRes.json();
            console.log(`[CRON]     FB-Antwort (HTTP ${fbRes.status}):`, JSON.stringify(fbData).slice(0, 120));

            if (fbData.error) {
              const errMsg = `${fbData.error.message ?? 'FB-Fehler'} (Code ${fbData.error.code ?? '?'})`;
              console.error(`[CRON]   ✕ ${page.name}: ${errMsg}`);
              fbResults.push({ page: page.name, success: false, error: errMsg });
              errorMessages.push(`FB ${page.name}: ${errMsg}`);
            } else {
              console.log(`[CRON]   ✓ ${page.name}: Post-ID ${fbData.id}`);
              fbResults.push({ page: page.name, success: true, postId: fbData.id });
              anySuccess = true;
            }

          } catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err);
            console.error(`[CRON]   ✕ ${page.name} Exception:`, errMsg);
            fbResults.push({ page: page.name, success: false, error: errMsg });
            errorMessages.push(`FB ${page.name}: ${errMsg}`);
          }
        }
      } else {
        console.log(`[CRON]   Post hat keine Facebook-Plattform. Plattformen: ${(post.platforms ?? []).join(', ')}`);
        // Post ohne Facebook-Plattform → direkt auf published setzen
        anySuccess = true;
      }

      // ── Status in Supabase aktualisieren ──────────────────────────────────
      const newStatus = anySuccess ? 'published' : 'error';
      const updatePayload: Record<string, unknown> = {
        status:     newStatus,
        updated_at: new Date().toISOString(),
      };
      if (anySuccess) {
        updatePayload.published_at  = new Date().toISOString();
        updatePayload.error_message = null;
      } else {
        updatePayload.error_message = errorMessages.join(' | ');
      }

      const { error: updateError } = await supabaseAdmin
        .from('posts')
        .update(updatePayload)
        .eq('id', post.id);

      if (updateError) {
        console.error(`[CRON] Status-Update FEHLER für Post ${post.id}:`, updateError.message);
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

    // ── 6. Zusammenfassung zurückgeben ────────────────────────────────────────
    const durationMs = Date.now() - startTime;
    const successful = results.filter(r => r.success).length;
    console.log(`\n[CRON] ── Job abgeschlossen: ${successful}/${results.length} erfolgreich | ${durationMs}ms ──`);

    return NextResponse.json({
      ok:         true,
      processed:  results.length,
      successful,
      failed:     results.length - successful,
      results,
      runAt,
      durationMs,
    });

  } catch (unexpectedErr) {
    // Letzter Fallback – verhindert unkontrollierte 500-Fehler
    const msg = unexpectedErr instanceof Error ? unexpectedErr.message : String(unexpectedErr);
    console.error('[CRON] UNERWARTETER FEHLER:', unexpectedErr);
    return NextResponse.json({
      ok:         false,
      error:      `Unerwarteter Fehler: ${msg}`,
      runAt,
      durationMs: Date.now() - startTime,
    });
    // Bewusst kein status: 500 → GitHub Actions soll nicht fehlschlagen
  }
}

export async function GET(req: NextRequest) {
  return runPublishJob(req);
}

export async function POST(req: NextRequest) {
  return runPublishJob(req);
}

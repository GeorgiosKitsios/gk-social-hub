/**
 * app/api/cron/publish/route.ts
 *
 * Automatischer Publish-Job – wird von GitHub Actions/Hostinger Cron Jobs aufgerufen:
 *   POST https://deine-domain.com/api/cron/publish
 *   Authorization: Bearer DEIN_CRON_SECRET
 *
 * Benötigte Supabase-Tabellen:
 *   posts              – id, brand_id, title, main_text, platform_texts(jsonb),
 *                        platforms(text[]), media_ids(text[]), status(text),
 *                        scheduled_at(timestamptz), published_at(timestamptz),
 *                        error_message(text), created_at, updated_at
 *
 *   facebook_pages     – id, brand_id, name(text), page_id(text), access_token(text)
 *
 *   instagram_accounts – id(text PK = facebook page_id), name(text),
 *                        account_id(text), access_token(text), updated_at(timestamptz)
 *                        SQL-Migration: supabase/migrations/create_instagram_accounts.sql
 *
 * IG-Retry-Mechanismus:
 *   Wenn ein Instagram-Video noch nicht verarbeitet ist (status=pending), wird
 *   error_message auf '__IGP__' gesetzt und status bleibt 'scheduled'. Beim
 *   nächsten Cron-Lauf erkennt die Route diesen Zustand und überspringt Facebook
 *   (bereits erfolgreich gepostet), führt nur den IG-Teil erneut durch.
 *
 * Posts aus dem localStorage-Store werden über POST /api/cron/sync in Supabase
 * synchronisiert, damit dieser Cron-Job sie findet.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, hasSupabaseAdminConfig } from '@/lib/supabase';
import { publishInstagram } from '@/lib/instagram';

const FB_API = 'https://graph.facebook.com/v19.0';

// Prefix in error_message → Post bleibt 'scheduled', beim nächsten Cron nur IG-Retry
const IG_PENDING_PREFIX = '__IGP__';

// Erzwinge serverseitiges Rendering — kein statisches Caching
export const dynamic   = 'force-dynamic';
export const revalidate = 0;
export const runtime   = 'nodejs';

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
  error_message?:  string | null;
  ig_post_type?:   'feed' | 'story' | null;
}

interface FbPageRow {
  brand_id:     string;
  name:         string;
  page_id:      string;
  access_token: string;
}

interface IgAccountRow {
  id:           string;  // = Facebook Page ID (Join-Schlüssel für Brand-Zuordnung)
  name:         string;
  account_id:   string;  // IG Business Account ID
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
    // Inkl. Posts mit error_message='__IGP__' (IG-Retry) — bleiben status='scheduled'
    console.log(`[CRON] Schritt 3 – Lade Posts (status=scheduled, scheduled_at ≤ ${now})`);

    const BASE_COLUMNS = 'id, brand_id, title, main_text, platform_texts, platforms, media_ids, status, scheduled_at, error_message';

    async function loadDuePosts(columns: string) {
      return supabaseAdmin
        .from('posts')
        .select(columns)
        .eq('status', 'scheduled')
        .lte('scheduled_at', now)
        .order('scheduled_at', { ascending: true });
    }

    let { data: rawPosts, error: queryError } = await loadDuePosts(`${BASE_COLUMNS}, ig_post_type`);

    // Fallback: Spalte ig_post_type existiert noch nicht (SQL-Migration ausstehend)
    if (queryError && queryError.code === '42703') {
      console.warn('[CRON] Spalte ig_post_type fehlt – Retry ohne das Feld (Stories werden als Feed gepostet).');
      ({ data: rawPosts, error: queryError } = await loadDuePosts(BASE_COLUMNS));
    }

    if (queryError) {
      return cronError(`Datenbankfehler beim Laden der Posts: ${queryError.message}`, {
        code:    queryError.code,
        details: queryError.details,
        hint:    'Prüfe ob die Tabelle "posts" in Supabase existiert.',
      });
    }

    const posts = (rawPosts ?? []) as unknown as PostRow[];
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

    // ── 4b. Instagram-Accounts aus Supabase laden ─────────────────────────────
    // Nicht kritisch – Tabelle fehlt möglicherweise noch (SQL-Migration ausstehend)
    let igAccounts: IgAccountRow[] = [];
    try {
      const { data: rawIG, error: igError } = await supabaseAdmin
        .from('instagram_accounts')
        .select('id, name, account_id, access_token');
      if (igError) {
        console.warn('[CRON] Schritt 4b – IG-Accounts Fehler (Tabelle fehlt?):', igError.message);
      } else {
        igAccounts = (rawIG ?? []) as IgAccountRow[];
        console.log(`[CRON] Schritt 4b – ${igAccounts.length} IG-Account(s) geladen`);
      }
    } catch (e) {
      console.warn('[CRON] Schritt 4b – IG-Accounts Exception:', e);
    }

    // ── 5. Posts verarbeiten ──────────────────────────────────────────────────
    const results: Array<{
      id:            string;
      title:         string;
      success:       boolean;
      fbResults:     Array<{ page:    string; success: boolean; postId?: string; error?: string }>;
      igResults:     Array<{ account: string; success: boolean; postId?: string; error?: string; pending?: boolean }>;
      errorMessage?: string;
    }> = [];

    for (const post of posts) {
      console.log(`\n[CRON] ── Post ${post.id} – "${post.title ?? '–'}" (brand: ${post.brand_id}) ──`);

      // Erkennt IG-Retry-Modus: FB bereits gepostet, nur IG erneut versuchen
      const isIgRetry = (post.error_message ?? '').startsWith(IG_PENDING_PREFIX);
      if (isIgRetry) {
        console.log('[CRON]   IG-Retry-Modus: FB überspringen, nur Instagram versuchen');
      }

      const fbResults: Array<{ page:    string; success: boolean; postId?: string; error?: string }> = [];
      const igResults: Array<{ account: string; success: boolean; postId?: string; error?: string; pending?: boolean }> = [];
      const errorMessages: string[] = [];

      let fbDone       = false;  // true = FB erfolgreich (oder nicht in Plattformen)
      let igDone       = false;  // true = IG erfolgreich (oder nicht in Plattformen)
      let igHasPending = false;  // true = mind. ein IG-Video noch nicht verarbeitet

      // ── Facebook ────────────────────────────────────────────────────────────
      if (post.platforms?.includes('facebook')) {
        if (isIgRetry) {
          // FB wurde in einem früheren Cron-Lauf bereits erfolgreich gepostet
          fbDone = true;
          console.log('[CRON]   FB: Übersprungen (IG-Retry, FB war bereits erfolgreich)');
        } else {
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
                fbDone = true;
              }

            } catch (err) {
              const errMsg = err instanceof Error ? err.message : String(err);
              console.error(`[CRON]   ✕ ${page.name} Exception:`, errMsg);
              fbResults.push({ page: page.name, success: false, error: errMsg });
              errorMessages.push(`FB ${page.name}: ${errMsg}`);
            }
          }
        }
      } else {
        fbDone = true; // kein Facebook in den Plattformen
        console.log(`[CRON]   Post hat keine Facebook-Plattform. Plattformen: ${(post.platforms ?? []).join(', ')}`);
      }

      // ── Instagram ────────────────────────────────────────────────────────────
      if (post.platforms?.includes('instagram')) {
        // Brand-Zuordnung: instagram_accounts.id = facebook_pages.page_id
        const brandFbPageIds     = fbPages.filter(p => p.brand_id === post.brand_id).map(p => p.page_id);
        const igAccountsForBrand = igAccounts.filter(a => brandFbPageIds.includes(a.id));

        console.log(`[CRON]   IG: ${igAccountsForBrand.length} Account(s) für Brand ${post.brand_id}`);

        if (igAccountsForBrand.length === 0) {
          const msg = igAccounts.length === 0
            ? 'Keine Instagram-Accounts in instagram_accounts-Tabelle (SQL-Migration ausführen).'
            : `Keine Instagram-Accounts für Brand "${post.brand_id}" gefunden (instagram_accounts.id muss = facebook_pages.page_id sein).`;
          console.warn(`[CRON]   ⚠ ${msg}`);
          errorMessages.push(`IG: ${msg}`);
          // igDone bleibt false
        } else {
          // Medium laden (Bild oder Video)
          let igImageUrl: string | undefined;
          let igVideoUrl: string | undefined;

          if (post.media_ids && post.media_ids.length > 0) {
            const { data: mediaRow } = await supabaseAdmin
              .from('media_items')
              .select('id, file_url, media_type')
              .eq('id', post.media_ids[0])
              .maybeSingle();
            const media = mediaRow as MediaRow | null;
            if (media?.media_type === 'video' && media.file_url?.startsWith('https://')) {
              igVideoUrl = media.file_url;
              console.log(`[CRON]   IG: Video ${igVideoUrl.slice(0, 70)}…`);
            } else if (media?.media_type === 'image' && media.file_url?.startsWith('https://')) {
              igImageUrl = media.file_url;
              console.log(`[CRON]   IG: Bild ${igImageUrl.slice(0, 70)}…`);
            } else {
              console.log(`[CRON]   IG: Kein verwendbares Medium (media_type=${media?.media_type ?? 'null'})`);
            }
          }

          if (!igImageUrl && !igVideoUrl) {
            const msg = 'Instagram benötigt ein Bild oder Video – kein gültiges Medium gefunden.';
            console.warn(`[CRON]   ⚠ IG: ${msg}`);
            errorMessages.push(`IG: ${msg}`);
            // igDone bleibt false
          } else {
            const igCaption    = (post.platform_texts as Record<string, string> | null)?.instagram ?? post.main_text ?? '';
            const igPostType   = post.ig_post_type === 'story' ? 'story' as const : 'feed' as const;
            let allIgSucceeded = true;

            console.log(`[CRON]   IG-Format: ${igPostType === 'story' ? 'Story' : 'Feed-Post'}`);

            for (const igAccount of igAccountsForBrand) {
              console.log(`[CRON]   → IG: ${igAccount.name} (account_id: ${igAccount.account_id})`);
              try {
                // maxPollMs=10_000 → max 2×5s Polls, sicher unter 60s curl-Limit
                const result = await publishInstagram({
                  accountId:   igAccount.account_id,
                  accessToken: igAccount.access_token,
                  caption:     igCaption,
                  imageUrl:    igImageUrl,
                  videoUrl:    igVideoUrl,
                  postType:    igPostType,
                  maxPollMs:   10_000,
                  logPrefix:   '[CRON][IG]',
                });

                if (result.status === 'published') {
                  console.log(`[CRON]   ✓ IG ${igAccount.name}: Post-ID ${result.postId}`);
                  igResults.push({ account: igAccount.name, success: true, postId: result.postId });
                } else if (result.status === 'pending') {
                  console.log(`[CRON]   ⏳ IG ${igAccount.name}: Video noch nicht verarbeitet → Retry beim nächsten Lauf`);
                  igResults.push({ account: igAccount.name, success: false, pending: true });
                  igHasPending  = true;
                  allIgSucceeded = false;
                } else {
                  const errMsg = result.error ?? 'IG-Fehler';
                  console.error(`[CRON]   ✕ IG ${igAccount.name}: ${errMsg}`);
                  igResults.push({ account: igAccount.name, success: false, error: errMsg });
                  errorMessages.push(`IG ${igAccount.name}: ${errMsg}`);
                  allIgSucceeded = false;
                }
              } catch (err) {
                const errMsg = err instanceof Error ? err.message : String(err);
                console.error(`[CRON]   ✕ IG ${igAccount.name} Exception:`, errMsg);
                igResults.push({ account: igAccount.name, success: false, error: errMsg });
                errorMessages.push(`IG ${igAccount.name}: ${errMsg}`);
                allIgSucceeded = false;
              }
            }

            if (allIgSucceeded) igDone = true;
          }
        }
      } else {
        igDone = true; // kein Instagram in den Plattformen
      }

      // ── Status in Supabase aktualisieren ──────────────────────────────────────
      const updatePayload: Record<string, unknown> = { updated_at: new Date().toISOString() };
      let newStatus: string;

      // Status pro Plattform getrennt (jsonb-Spalte platform_status)
      const platformStatus: Record<string, string> = {};
      if (post.platforms?.includes('facebook')) {
        platformStatus.facebook = fbDone ? 'published' : 'error';
      }
      if (post.platforms?.includes('instagram')) {
        platformStatus.instagram = igHasPending ? 'pending' : (igDone ? 'published' : 'error');
      }
      updatePayload.platform_status = platformStatus;
      console.log(`[CRON] Plattform-Status:`, platformStatus);

      if (igHasPending) {
        // Video wird noch verarbeitet – Post bleibt 'scheduled' für den nächsten Cron-Lauf.
        // __IGP__ teilt dem nächsten Lauf mit, dass FB bereits erledigt ist.
        newStatus = 'scheduled';
        updatePayload.status        = newStatus;
        updatePayload.error_message = IG_PENDING_PREFIX;
        console.log(`[CRON] Post ${post.id} → status: scheduled (IG-Pending, Retry beim nächsten Lauf)`);
      } else {
        const allDone        = fbDone && igDone;
        const partialSuccess = (fbDone || igDone) && errorMessages.length > 0;

        if (allDone) {
          // Alle Plattformen erfolgreich
          newStatus = 'published';
          updatePayload.status        = newStatus;
          updatePayload.published_at  = new Date().toISOString();
          updatePayload.error_message = null;
        } else if (partialSuccess) {
          // Mindestens eine Plattform erfolgreich, aber nicht alle
          newStatus = 'published';
          updatePayload.status        = newStatus;
          updatePayload.published_at  = new Date().toISOString();
          updatePayload.error_message = errorMessages.join(' | ');
        } else {
          // Alle Plattformen fehlgeschlagen
          newStatus = 'error';
          updatePayload.status        = newStatus;
          updatePayload.error_message = errorMessages.join(' | ');
        }

        console.log(`[CRON] Post ${post.id} → status: ${newStatus}${errorMessages.length > 0 ? ` | ${errorMessages.join('; ')}` : ''}`);
      }

      let { error: updateError } = await supabaseAdmin
        .from('posts')
        .update(updatePayload)
        .eq('id', post.id);

      // Fallback: Spalte platform_status existiert noch nicht (SQL-Migration ausstehend)
      if (updateError && updateError.code === '42703') {
        console.warn('[CRON] Spalte platform_status fehlt – Retry ohne das Feld. SQL-Migration:',
          'ALTER TABLE posts ADD COLUMN platform_status JSONB;');
        const { platform_status: _omit, ...payloadWithoutPs } = updatePayload;
        ({ error: updateError } = await supabaseAdmin
          .from('posts')
          .update(payloadWithoutPs)
          .eq('id', post.id));
      }

      if (updateError) {
        console.error(`[CRON] Status-Update FEHLER für Post ${post.id}:`, updateError.message);
      }

      const anySuccess = fbDone || igDone || igHasPending;
      results.push({
        id:           post.id,
        title:        post.title ?? '',
        success:      anySuccess,
        fbResults,
        igResults,
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

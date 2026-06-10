/**
 * Gemeinsame Instagram-Publishing-Logik für manuelle Posts (/api/instagram/publish)
 * und zeitgesteuerte Cron-Posts (/api/cron/publish).
 *
 * Beide Wege nutzen dieselben Funktionen – kein duplizierter API-Aufruf-Code.
 */

const IG_API = 'https://graph.facebook.com/v19.0';

/**
 * Fügt einer Cloudinary-Video-URL die Transformation f_mp4,vc_h264 hinzu.
 * Nicht-Cloudinary-URLs werden unverändert zurückgegeben.
 */
export function toH264Url(url: string): string {
  if (!url.includes('res.cloudinary.com') || !url.includes('/video/upload/')) return url;
  return url.replace('/video/upload/', '/video/upload/f_mp4,vc_h264/');
}

export interface IgPublishParams {
  accountId:   string;          // IG Business Account ID
  accessToken: string;          // Page Access Token
  caption:     string;
  imageUrl?:   string;
  videoUrl?:   string;
  postType:    'feed' | 'story';
  /**
   * Maximale Polling-Zeit in ms (Standard: 60 000 für manuelle Posts).
   * Im Cron kleiner wählen (z. B. 10 000), damit der Request nicht in das
   * curl-Timeout läuft. Wenn das Video nach maxPollMs noch nicht FINISHED ist,
   * wird 'pending' zurückgegeben.
   */
  maxPollMs?:  number;
  /** Präfix für Console-Logs (z. B. '[IG]' oder '[CRON][IG]'). */
  logPrefix?:  string;
}

export type IgPublishResult =
  | { status: 'published'; postId: string }
  | { status: 'pending';   creationId: string }  // Video noch nicht verarbeitet
  | { status: 'error';     error: string; igCode?: number };

/**
 * Vollständiger Instagram-Publish-Ablauf:
 * Container erstellen → Video-Status pollen → Container veröffentlichen.
 * Gibt 'pending' zurück, wenn das Video nach maxPollMs noch nicht fertig ist.
 */
export async function publishInstagram(params: IgPublishParams): Promise<IgPublishResult> {
  const {
    accountId, accessToken, caption, imageUrl, videoUrl,
    postType, maxPollMs = 60_000, logPrefix = '[IG]',
  } = params;

  // ── Container-Body aufbauen ─────────────────────────────────────────────────
  const containerBody: Record<string, string> = { access_token: accessToken };
  if (postType === 'feed') containerBody.caption = caption;
  if (imageUrl) {
    containerBody.image_url = imageUrl;
    if (postType === 'story') containerBody.media_type = 'STORIES';
  } else if (videoUrl) {
    containerBody.video_url  = toH264Url(videoUrl);  // H.264 für HEVC-Kompatibilität
    containerBody.media_type = postType === 'story' ? 'STORIES' : 'REELS';
  }

  // ── Schritt 1: Media-Container erstellen ────────────────────────────────────
  let containerData: Record<string, unknown>;
  try {
    const res = await fetch(`${IG_API}/${accountId}/media`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(containerBody),
    });
    containerData = await res.json();
  } catch (err) {
    return { status: 'error', error: `Netzwerkfehler Container: ${err instanceof Error ? err.message : String(err)}` };
  }

  if (containerData.error) {
    const e = containerData.error as { message?: string; code?: number };
    return { status: 'error', error: e.message ?? 'Container-Erstellung fehlgeschlagen', igCode: e.code };
  }

  const creationId = containerData.id as string;
  if (!creationId) {
    return { status: 'error', error: 'Keine Container-ID von Instagram erhalten' };
  }
  console.log(`${logPrefix} Container erstellt: ${creationId}`);

  // ── Schritt 2: Video-Status pollen (nur bei Videos) ─────────────────────────
  if (videoUrl) {
    const pollInterval = 5_000;
    const maxPolls     = Math.max(1, Math.floor(maxPollMs / pollInterval));
    console.log(`${logPrefix} Video-Polling (max ${maxPolls} × ${pollInterval / 1000}s = ${maxPolls * pollInterval / 1000}s)…`);

    for (let i = 0; i < maxPolls; i++) {
      await new Promise(r => setTimeout(r, pollInterval));
      try {
        const statusRes  = await fetch(
          `${IG_API}/${creationId}?fields=status_code&access_token=${accessToken}`
        );
        const statusData = await statusRes.json() as { status_code?: string; error?: unknown };
        console.log(`${logPrefix} Poll ${i + 1}/${maxPolls}: status_code=${statusData.status_code}`);

        if (statusData.status_code === 'FINISHED') { console.log(`${logPrefix} Video fertig.`); break; }
        if (statusData.status_code === 'ERROR') {
          return { status: 'error', error: 'Video-Verarbeitung durch Instagram fehlgeschlagen' };
        }
        // Letzter Poll ohne FINISHED → pending zurückgeben
        if (i === maxPolls - 1) {
          console.log(`${logPrefix} Video nach ${maxPolls * pollInterval / 1000}s noch nicht fertig → pending`);
          return { status: 'pending', creationId };
        }
      } catch {
        // Poll-Fehler ignorieren – nächster Versuch im nächsten Loop-Schritt
      }
    }
  }

  // ── Schritt 3: Container veröffentlichen ────────────────────────────────────
  let publishData: Record<string, unknown>;
  try {
    const res = await fetch(`${IG_API}/${accountId}/media_publish`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ creation_id: creationId, access_token: accessToken }),
    });
    publishData = await res.json();
  } catch (err) {
    return { status: 'error', error: `Netzwerkfehler Publish: ${err instanceof Error ? err.message : String(err)}` };
  }

  if (publishData.error) {
    const e = publishData.error as { message?: string; code?: number };
    return { status: 'error', error: e.message ?? 'Veröffentlichung fehlgeschlagen', igCode: e.code };
  }

  console.log(`${logPrefix} Veröffentlicht! Post-ID: ${publishData.id}`);
  return { status: 'published', postId: publishData.id as string };
}

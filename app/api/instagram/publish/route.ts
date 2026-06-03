import { NextRequest, NextResponse } from 'next/server';

const IG_API = 'https://graph.facebook.com/v19.0';

export async function POST(req: NextRequest) {
  console.log('[IG] ── POST /api/instagram/publish gestartet ──');

  // ── Schritt 1: Request lesen ─────────────────────────────────
  let accountId: string, accessToken: string, caption: string,
      imageUrl: string | undefined, videoUrl: string | undefined;
  try {
    const body = await req.json();
    accountId   = body.accountId   ?? '';
    accessToken = body.accessToken ?? '';
    caption     = body.caption     ?? '';
    imageUrl    = body.imageUrl;
    videoUrl    = body.videoUrl;
  } catch (err) {
    console.error('[IG] Request-Body konnte nicht gelesen werden:', err);
    return NextResponse.json({ error: 'Ungültiger Request-Body.' }, { status: 400 });
  }

  console.log('[IG] Schritt 1 – Parameter:', {
    accountId,
    accessToken_set:    !!accessToken,
    accessToken_prefix: accessToken ? accessToken.slice(0, 8) + '…' : '(fehlt)',
    caption_length:     caption.length,
    imageUrl_type:      imageUrl?.startsWith('data:')  ? 'BASE64 ⚠️ Instagram braucht HTTPS-URL!' :
                        imageUrl?.startsWith('https:') ? 'HTTPS ✓' :
                        imageUrl?.startsWith('http:')  ? 'HTTP (kein HTTPS!) ⚠️' :
                        imageUrl ? 'unbekannt' : '(kein Bild)',
    imageUrl_prefix:    imageUrl ? imageUrl.slice(0, 60) : '(kein Bild)',
    videoUrl_set:       !!videoUrl,
  });

  if (!accountId || !accessToken) {
    console.error('[IG] FEHLER – accountId oder accessToken fehlt');
    return NextResponse.json({ error: 'accountId und accessToken sind erforderlich.' }, { status: 400 });
  }
  if (!imageUrl && !videoUrl) {
    console.error('[IG] FEHLER – kein Bild und kein Video übergeben');
    return NextResponse.json({ error: 'Instagram benötigt ein Bild oder Video.' }, { status: 400 });
  }
  if (imageUrl?.startsWith('data:')) {
    console.error('[IG] FEHLER – imageUrl ist eine base64 Data-URL. Instagram benötigt eine öffentliche HTTPS-URL!');
    return NextResponse.json({
      error: 'Das Bild muss als öffentliche HTTPS-URL vorliegen. Bitte zuerst in die Medienbibliothek hochladen.',
    }, { status: 400 });
  }

  // ── Schritt 2: Media-Container erstellen ─────────────────────
  const containerBody: Record<string, string> = {
    caption:      caption,
    access_token: accessToken,
  };
  if (imageUrl) {
    containerBody.image_url = imageUrl;
  } else if (videoUrl) {
    containerBody.video_url  = videoUrl;
    containerBody.media_type = 'REELS';
  }

  console.log('[IG] Schritt 2 – Container erstellen:', {
    endpoint:  `${IG_API}/${accountId}/media`,
    mediaType: imageUrl ? 'IMAGE' : 'VIDEO/REELS',
  });

  let containerData: Record<string, unknown>;
  try {
    const containerRes = await fetch(`${IG_API}/${accountId}/media`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(containerBody),
    });
    containerData = await containerRes.json();
    console.log('[IG] Schritt 2 – Container-Antwort:', {
      httpStatus: containerRes.status,
      id:         containerData.id,
      error:      containerData.error,
    });
  } catch (err) {
    console.error('[IG] Schritt 2 FEHLER – Netzwerkfehler beim Container-Request:', err);
    return NextResponse.json({ error: 'Netzwerkfehler beim Erstellen des Instagram-Containers.' }, { status: 500 });
  }

  if (containerData.error) {
    const igErr = containerData.error as { message?: string; code?: number; type?: string };
    console.error('[IG] Schritt 2 FEHLER – Instagram API:', igErr);
    return NextResponse.json({
      error:    igErr.message ?? 'Container-Erstellung fehlgeschlagen.',
      igCode:   igErr.code,
      igType:   igErr.type,
    }, { status: 400 });
  }

  const creationId = containerData.id as string;
  if (!creationId) {
    console.error('[IG] Schritt 2 FEHLER – keine Container-ID in Antwort:', containerData);
    return NextResponse.json({ error: 'Keine Container-ID von Instagram erhalten.' }, { status: 500 });
  }
  console.log('[IG] Schritt 2 OK – Container-ID:', creationId);

  // ── Schritt 3: Bei Videos auf Fertigstellung warten ──────────
  if (videoUrl) {
    console.log('[IG] Schritt 3 – Video-Status polling (max. 60s)...');
    for (let i = 0; i < 12; i++) {
      await new Promise(r => setTimeout(r, 5000));
      try {
        const statusRes  = await fetch(`${IG_API}/${creationId}?fields=status_code&access_token=${accessToken}`);
        const statusData = await statusRes.json() as { status_code?: string; error?: unknown };
        console.log(`[IG] Schritt 3 – Poll ${i + 1}/12: status_code =`, statusData.status_code);
        if (statusData.status_code === 'FINISHED') { console.log('[IG] Schritt 3 OK – Video fertig.'); break; }
        if (statusData.status_code === 'ERROR') {
          console.error('[IG] Schritt 3 FEHLER – Video-Verarbeitung fehlgeschlagen:', statusData);
          return NextResponse.json({ error: 'Video-Verarbeitung durch Instagram fehlgeschlagen.' }, { status: 400 });
        }
      } catch (pollErr) {
        console.warn('[IG] Schritt 3 – Poll-Fehler (wird ignoriert):', pollErr);
      }
    }
  }

  // ── Schritt 4: Container veröffentlichen ─────────────────────
  console.log('[IG] Schritt 4 – Veröffentlichen:', { accountId, creationId });

  let publishData: Record<string, unknown>;
  try {
    const publishRes = await fetch(`${IG_API}/${accountId}/media_publish`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ creation_id: creationId, access_token: accessToken }),
    });
    publishData = await publishRes.json();
    console.log('[IG] Schritt 4 – Publish-Antwort:', {
      httpStatus: publishRes.status,
      id:         publishData.id,
      error:      publishData.error,
    });
  } catch (err) {
    console.error('[IG] Schritt 4 FEHLER – Netzwerkfehler beim Publish:', err);
    return NextResponse.json({ error: 'Netzwerkfehler beim Veröffentlichen.' }, { status: 500 });
  }

  if (publishData.error) {
    const igErr = publishData.error as { message?: string; code?: number; type?: string };
    console.error('[IG] Schritt 4 FEHLER – Instagram API:', igErr);
    return NextResponse.json({
      error:  igErr.message ?? 'Veröffentlichung fehlgeschlagen.',
      igCode: igErr.code,
      igType: igErr.type,
    }, { status: 400 });
  }

  console.log('[IG] ── Erfolgreich veröffentlicht! Post-ID:', publishData.id, '──');
  return NextResponse.json({ success: true, postId: publishData.id });
}

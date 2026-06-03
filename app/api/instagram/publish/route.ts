import { NextRequest, NextResponse } from 'next/server';

const IG_API = 'https://graph.facebook.com/v19.0';

export async function POST(req: NextRequest) {
  try {
    const { accountId, accessToken, caption, imageUrl, videoUrl } = await req.json();

    if (!accountId || !accessToken) {
      return NextResponse.json({ error: 'accountId und accessToken sind erforderlich.' }, { status: 400 });
    }
    if (!imageUrl && !videoUrl) {
      return NextResponse.json({ error: 'Instagram benötigt ein Bild oder Video.' }, { status: 400 });
    }

    console.log('[instagram/publish] Schritt 1 – Media-Container erstellen:', { accountId, hasImage: !!imageUrl, hasVideo: !!videoUrl });

    // ── Schritt 1: Media-Container erstellen ────────────────────
    const containerBody: Record<string, string> = {
      caption:      caption ?? '',
      access_token: accessToken,
    };
    if (imageUrl) {
      containerBody.image_url = imageUrl;
    } else if (videoUrl) {
      containerBody.video_url  = videoUrl;
      containerBody.media_type = 'REELS';
    }

    const containerRes  = await fetch(`${IG_API}/${accountId}/media`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(containerBody),
    });
    const containerData = await containerRes.json();

    if (containerData.error) {
      console.error('[instagram/publish] Container-Fehler:', containerData.error);
      return NextResponse.json({ error: containerData.error.message }, { status: 400 });
    }

    const creationId = containerData.id as string;
    console.log('[instagram/publish] Schritt 1 OK – Container:', creationId);

    // ── Schritt 2: Bei Videos auf Verarbeitung warten ───────────
    if (videoUrl) {
      console.log('[instagram/publish] Schritt 2 – Video-Status polling...');
      for (let i = 0; i < 12; i++) {
        await new Promise(r => setTimeout(r, 5000));
        const statusRes  = await fetch(`${IG_API}/${creationId}?fields=status_code&access_token=${accessToken}`);
        const statusData = await statusRes.json();
        console.log(`[instagram/publish] Poll ${i + 1}: status_code =`, statusData.status_code);
        if (statusData.status_code === 'FINISHED') break;
        if (statusData.status_code === 'ERROR') {
          return NextResponse.json({ error: 'Video-Verarbeitung durch Instagram fehlgeschlagen.' }, { status: 400 });
        }
      }
    }

    // ── Schritt 3: Container veröffentlichen ────────────────────
    console.log('[instagram/publish] Schritt 3 – Veröffentlichen...');
    const publishRes  = await fetch(`${IG_API}/${accountId}/media_publish`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ creation_id: creationId, access_token: accessToken }),
    });
    const publishData = await publishRes.json();

    if (publishData.error) {
      console.error('[instagram/publish] Publish-Fehler:', publishData.error);
      return NextResponse.json({ error: publishData.error.message }, { status: 400 });
    }

    console.log('[instagram/publish] Erfolgreich veröffentlicht:', publishData.id);
    return NextResponse.json({ success: true, postId: publishData.id });

  } catch (err) {
    console.error('[instagram/publish] Unexpected error:', err);
    return NextResponse.json({ error: 'Instagram-Publish fehlgeschlagen.' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { publishInstagram } from '@/lib/instagram';

export async function POST(req: NextRequest) {
  console.log('[IG] ── POST /api/instagram/publish gestartet ──');

  // ── Schritt 1: Request lesen ─────────────────────────────────
  let accountId: string, accessToken: string, caption: string,
      imageUrl: string | undefined, videoUrl: string | undefined,
      postType: 'feed' | 'story';
  try {
    const body = await req.json();
    accountId   = body.accountId   ?? '';
    accessToken = body.accessToken ?? '';
    caption     = body.caption     ?? '';
    imageUrl    = body.imageUrl;
    videoUrl    = body.videoUrl;
    postType    = body.postType === 'story' ? 'story' : 'feed';
  } catch (err) {
    console.error('[IG] Request-Body konnte nicht gelesen werden:', err);
    return NextResponse.json({ error: 'Ungültiger Request-Body.' }, { status: 400 });
  }

  console.log('[IG] Schritt 1 – Parameter:', {
    accountId,
    postType,
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
    console.error('[IG] FEHLER – imageUrl ist eine base64 Data-URL');
    return NextResponse.json({
      error: 'Das Bild muss als öffentliche HTTPS-URL vorliegen. Bitte zuerst in die Medienbibliothek hochladen.',
    }, { status: 400 });
  }

  // ── Schritt 2–4: Publish via gemeinsamer Lib-Funktion ────────
  // maxPollMs = 60 000 (Standard) → bis zu 12 × 5s Polling für manuelle Posts.
  const result = await publishInstagram({
    accountId, accessToken, caption, imageUrl, videoUrl, postType,
    maxPollMs: 60_000,
    logPrefix: '[IG]',
  });

  if (result.status === 'published') {
    console.log('[IG] ── Erfolgreich veröffentlicht! Post-ID:', result.postId, '──');
    return NextResponse.json({ success: true, postId: result.postId });
  }

  if (result.status === 'pending') {
    // Sollte bei manuellen Posts mit 60s Timeout selten vorkommen.
    console.warn('[IG] Video noch nicht fertig nach 60s (creationId:', result.creationId, ')');
    return NextResponse.json({
      error: 'Das Video wird von Instagram noch verarbeitet. Bitte in 1–2 Minuten erneut versuchen.',
    }, { status: 202 });
  }

  // status === 'error'
  console.error('[IG] Fehler:', result.error, result.igCode ? `(Code ${result.igCode})` : '');
  return NextResponse.json({
    error:  result.error,
    igCode: result.igCode,
  }, { status: 400 });
}

import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { pageId, pageToken, videoBase64, message, postType } = await request.json();

    if (!pageId || !pageToken || !videoBase64) {
      return NextResponse.json({ error: 'pageId, pageToken und videoBase64 erforderlich' }, { status: 400 });
    }

    // Base64 → Buffer
    const base64Data = videoBase64.replace(/^data:video\/\w+;base64,/, '');
    const buffer     = Buffer.from(base64Data, 'base64');
    const mimeMatch  = videoBase64.match(/^data:(video\/\w+);base64,/);
    const mimeType   = mimeMatch ? mimeMatch[1] : 'video/mp4';
    const isReel     = postType === 'reels';

    if (isReel) {
      // ── Reels: 3-stufiger Prozess ──

      // Schritt 1: Upload-Session starten
      const initRes = await fetch(
        `https://graph.facebook.com/v19.0/${pageId}/video_reels`,
        {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            upload_phase: 'start',
            access_token: pageToken,
          }),
        }
      );
      const initData = await initRes.json();

      if (initData.error || !initData.video_id || !initData.upload_url) {
        console.error('Reel init error:', initData);
        return NextResponse.json({ error: initData.error?.message ?? 'Reel-Upload konnte nicht gestartet werden' }, { status: 400 });
      }

      const { video_id, upload_url } = initData;

      // Schritt 2: Video hochladen
      const uploadRes = await fetch(upload_url, {
        method:  'POST',
        headers: {
          'Authorization':        `OAuth ${pageToken}`,
          'Content-Type':         mimeType,
          'offset':               '0',
          'file_size':            buffer.byteLength.toString(),
        },
        body: buffer,
      });

      if (!uploadRes.ok) {
        const errText = await uploadRes.text();
        console.error('Reel upload error:', errText);
        return NextResponse.json({ error: 'Video-Upload fehlgeschlagen' }, { status: 400 });
      }

      // Schritt 3: Veröffentlichen
      const publishRes = await fetch(
        `https://graph.facebook.com/v19.0/${pageId}/video_reels`,
        {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            upload_phase: 'finish',
            video_id,
            video_state:  'PUBLISHED',
            description:  message ?? '',
            access_token: pageToken,
          }),
        }
      );
      const publishData = await publishRes.json();

      if (publishData.error) {
        console.error('Reel publish error:', publishData.error);
        return NextResponse.json({ error: publishData.error.message }, { status: 400 });
      }

      return NextResponse.json({ success: true, postId: video_id, type: 'reel' });

    } else {
      // ── Feed-Video: einfacher Upload ──
      const formData = new FormData();
      const blob     = new Blob([buffer], { type: mimeType });
      formData.append('source',       blob, 'video.mp4');
      formData.append('description',  message ?? '');
      formData.append('access_token', pageToken);

      const uploadRes  = await fetch(
        `https://graph.facebook.com/v19.0/${pageId}/videos`,
        { method: 'POST', body: formData }
      );
      const uploadData = await uploadRes.json();

      if (uploadData.error) {
        console.error('Feed video error:', uploadData.error);
        return NextResponse.json({ error: uploadData.error.message }, { status: 400 });
      }

      return NextResponse.json({ success: true, postId: uploadData.id, type: 'video' });
    }

  } catch (err) {
    console.error('Video upload error:', err);
    return NextResponse.json({ error: 'Video-Upload fehlgeschlagen' }, { status: 500 });
  }
}

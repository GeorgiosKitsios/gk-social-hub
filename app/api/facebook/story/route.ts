import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { pageId, pageToken, imageBase64, videoBase64 } = await request.json();

    if (!pageId || !pageToken) {
      return NextResponse.json({ error: 'pageId und pageToken erforderlich' }, { status: 400 });
    }
    if (!imageBase64 && !videoBase64) {
      return NextResponse.json({ error: 'imageBase64 oder videoBase64 erforderlich – Stories benötigen Medien.' }, { status: 400 });
    }

    // ── Foto-Story ────────────────────────────────────────────────
    if (imageBase64) {
      // Schritt 1: Bild als nicht veröffentlicht hochladen
      let buffer:   Uint8Array<ArrayBuffer>;
      let mimeType: string;

      if (/^https?:\/\//.test(imageBase64)) {
        const imgRes = await fetch(imageBase64);
        if (!imgRes.ok) {
          return NextResponse.json({ error: `Bild konnte nicht geladen werden (HTTP ${imgRes.status})` }, { status: 400 });
        }
        buffer   = new Uint8Array(await imgRes.arrayBuffer());
        mimeType = imgRes.headers.get('content-type') ?? 'image/jpeg';
      } else {
        const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
        buffer           = Uint8Array.from(Buffer.from(base64Data, 'base64'));
        const mimeMatch  = imageBase64.match(/^data:(image\/\w+);base64,/);
        mimeType         = mimeMatch ? mimeMatch[1] : 'image/jpeg';
      }

      const uploadForm = new FormData();
      uploadForm.append('source',       new Blob([buffer], { type: mimeType }), 'image.jpg');
      uploadForm.append('published',    'false');
      uploadForm.append('access_token', pageToken);

      const uploadRes  = await fetch(`https://graph.facebook.com/v19.0/${pageId}/photos`, {
        method: 'POST',
        body:   uploadForm,
      });
      const uploadData = await uploadRes.json();

      if (uploadData.error) {
        console.error('FB photo story upload error:', uploadData.error);
        return NextResponse.json({ error: uploadData.error.message }, { status: 400 });
      }

      const photoId = uploadData.id as string;

      // Schritt 2: Foto als Story veröffentlichen
      const storyRes  = await fetch(`https://graph.facebook.com/v19.0/${pageId}/photo_stories`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ photo_id: photoId, access_token: pageToken }),
      });
      const storyData = await storyRes.json();

      if (storyData.error) {
        console.error('FB photo_stories error:', storyData.error);
        return NextResponse.json({ error: storyData.error.message }, { status: 400 });
      }

      return NextResponse.json({ success: true, postId: storyData.id ?? photoId, type: 'photo_story' });
    }

    // ── Video-Story ───────────────────────────────────────────────
    if (videoBase64) {
      let buffer:   Uint8Array<ArrayBuffer>;
      let mimeType: string;

      if (/^https?:\/\//.test(videoBase64)) {
        const vidRes = await fetch(videoBase64);
        if (!vidRes.ok) {
          return NextResponse.json({ error: `Video konnte nicht geladen werden (HTTP ${vidRes.status})` }, { status: 400 });
        }
        buffer   = new Uint8Array(await vidRes.arrayBuffer());
        mimeType = vidRes.headers.get('content-type') ?? 'video/mp4';
      } else {
        const base64Data = videoBase64.replace(/^data:video\/\w+;base64,/, '');
        buffer           = Uint8Array.from(Buffer.from(base64Data, 'base64'));
        const mimeMatch  = videoBase64.match(/^data:(video\/\w+);base64,/);
        mimeType         = mimeMatch ? mimeMatch[1] : 'video/mp4';
      }

      // Schritt 1: Upload-Session starten
      const initRes  = await fetch(`https://graph.facebook.com/v19.0/${pageId}/video_stories`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ upload_phase: 'start', access_token: pageToken }),
      });
      const initData = await initRes.json();

      if (initData.error || !initData.video_id || !initData.upload_url) {
        console.error('FB video story init error:', initData);
        return NextResponse.json({
          error: initData.error?.message ?? 'Story-Upload konnte nicht gestartet werden',
        }, { status: 400 });
      }

      const { video_id, upload_url } = initData as { video_id: string; upload_url: string };

      // Schritt 2: Video-Bytes hochladen
      const uploadRes = await fetch(upload_url, {
        method:  'POST',
        headers: {
          Authorization: `OAuth ${pageToken}`,
          'Content-Type': mimeType,
          offset:         '0',
          file_size:      buffer.byteLength.toString(),
        },
        body: buffer,
      });

      if (!uploadRes.ok) {
        const errText = await uploadRes.text();
        console.error('FB video story upload error:', errText);
        return NextResponse.json({ error: 'Video-Upload fehlgeschlagen' }, { status: 400 });
      }

      // Schritt 3: Veröffentlichen
      const publishRes  = await fetch(`https://graph.facebook.com/v19.0/${pageId}/video_stories`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          upload_phase: 'finish',
          video_id,
          video_state:  'PUBLISHED',
          access_token: pageToken,
        }),
      });
      const publishData = await publishRes.json();

      if (publishData.error) {
        console.error('FB video story publish error:', publishData.error);
        return NextResponse.json({ error: publishData.error.message }, { status: 400 });
      }

      return NextResponse.json({ success: true, postId: video_id, type: 'video_story' });
    }

  } catch (err) {
    console.error('FB story error:', err);
    return NextResponse.json({ error: 'Story-Veröffentlichung fehlgeschlagen' }, { status: 500 });
  }
}

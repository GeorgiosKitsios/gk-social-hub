import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { pageId, pageToken, imageBase64, message } = await request.json();

    if (!pageId || !pageToken) {
      return NextResponse.json({ error: 'pageId und pageToken erforderlich' }, { status: 400 });
    }

    // Wenn kein Bild → normaler Text-Post
    if (!imageBase64) {
      const res = await fetch(
        `https://graph.facebook.com/v19.0/${pageId}/feed`,
        {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ message, access_token: pageToken }),
        }
      );
      const data = await res.json();
      if (data.error) return NextResponse.json({ error: data.error.message }, { status: 400 });
      return NextResponse.json({ success: true, postId: data.id });
    }

    // Bilddaten beschaffen – entweder von öffentlicher URL (Cloudinary)
    // oder aus einer base64-Data-URL (Fallback für Altdaten).
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

    // Bild direkt als Blob zu Facebook hochladen
    const formData = new FormData();
    const blob     = new Blob([buffer], { type: mimeType });
    formData.append('source',       blob,        'image.jpg');
    formData.append('message',      message ?? '');
    formData.append('access_token', pageToken);

    const res = await fetch(
      `https://graph.facebook.com/v19.0/${pageId}/photos`,
      { method: 'POST', body: formData }
    );

    const data = await res.json();

    if (data.error) {
      console.error('Facebook photo upload error:', data.error);
      return NextResponse.json({ error: data.error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, postId: data.id });

  } catch (err) {
    console.error('Upload error:', err);
    return NextResponse.json({ error: 'Upload fehlgeschlagen' }, { status: 500 });
  }
}



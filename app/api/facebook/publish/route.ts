import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { pageId, pageToken, message, imageUrl } = await request.json();

    if (!pageId || !pageToken || !message) {
      return NextResponse.json({ error: 'pageId, pageToken und message sind erforderlich' }, { status: 400 });
    }

    let endpoint: string;
    let body: Record<string, string>;

    if (imageUrl) {
      // Post mit Bild
      endpoint = `https://graph.facebook.com/v19.0/${pageId}/photos`;
      body = {
        url:          imageUrl,
        caption:      message,
        access_token: pageToken,
      };
    } else {
      // Text-Post
      endpoint = `https://graph.facebook.com/v19.0/${pageId}/feed`;
      body = {
        message,
        access_token: pageToken,
      };
    }

    const res = await fetch(endpoint, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    });

    const data = await res.json();

    if (data.error) {
      console.error('Facebook publish error:', data.error);
      return NextResponse.json({ error: data.error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, postId: data.id });

  } catch (err) {
    console.error('Publish error:', err);
    return NextResponse.json({ error: 'Veröffentlichung fehlgeschlagen' }, { status: 500 });
  }
}

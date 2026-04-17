import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { pageId, pageToken, videoBase64, message, postType } = await request.json();
    // postType: 'feed' | 'reels'

    if (!pageId || !pageToken || !videoBase64) {
      return NextResponse.json({ error: 'pageId, pageToken und videoBase64 erforderlich' }, { status: 400 });
    }

    // Base64 → Buffer
    const base64Data = videoBase64.replace(/^data:video\/\w+;base64,/, '');
    const buffer     = Buffer.from(base64Data, 'base64');
    const mimeMatch  = videoBase64.match(/^data:(video\/\w+);base64,/);
    const mimeType   = mimeMatch ? mimeMatch[1] : 'video/mp4';

    const isReel = postType === 'reels';

    // Endpoint je nach Typ
    const uploadEndpoint = isReel
      ? `https://graph.facebook.com/v19.0/${pageId}/video_reels`
      : `https://graph.facebook.com/v19.0/${pageId}/videos`;

    // FormData mit Video
    const formData = new FormData();
    const blob     = new Blob([buffer], { type: mimeType });
    formData.append('source',       blob, 'video.mp4');
    formData.append('description',  message ?? '');
    formData.append('access_token', pageToken);

    if (isReel) {
      formData.append('upload_phase', 'finish');
    }

    const uploadRes  = await fetch(uploadEndpoint, { method: 'POST', body: formData });
    const uploadData = await uploadRes.json();

    if (uploadData.error) {
      console.error('Facebook video upload error:', uploadData.error);
      return NextResponse.json({ error: uploadData.error.message }, { status: 400 });
    }

    // Bei Reels: Veröffentlichung anstoßen
    if (isReel && uploadData.video_id) {
      const publishRes = await fetch(
        `https://graph.facebook.com/v19.0/${pageId}/video_reels`,
        {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            video_id:     uploadData.video_id,
            upload_phase: 'finish',
            video_state:  'PUBLISHED',
            description:  message ?? '',
            access_token: pageToken,
          }),
        }
      );
      const publishData = await publishRes.json();
      if (publishData.error) {
        return NextResponse.json({ error: publishData.error.message }, { status: 400 });
      }
      return NextResponse.json({ success: true, postId: publishData.id ?? uploadData.video_id, type: 'reel' });
    }

    return NextResponse.json({ success: true, postId: uploadData.id, type: 'video' });

  } catch (err) {
    console.error('Video upload error:', err);
    return NextResponse.json({ error: 'Video-Upload fehlgeschlagen' }, { status: 500 });
  }
}

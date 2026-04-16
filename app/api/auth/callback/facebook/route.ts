import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;

  if (!code) {
    return NextResponse.redirect(`${appUrl}/accounts?error=no_code`);
  }

  const appId       = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID!;
  const appSecret   = process.env.FACEBOOK_APP_SECRET!;
  const redirectUri = `${appUrl}/api/auth/callback/facebook`;

  try {
    // 1. Code gegen User Access Token tauschen
    const tokenRes = await fetch(
      `https://graph.facebook.com/v19.0/oauth/access_token?` +
      new URLSearchParams({
        client_id:     appId,
        client_secret: appSecret,
        redirect_uri:  redirectUri,
        code,
      })
    );
    const tokenData = await tokenRes.json();

    if (!tokenData.access_token) {
      console.error('Token error:', tokenData);
      return NextResponse.redirect(`${appUrl}/accounts?error=token_failed`);
    }

    const userToken = tokenData.access_token;

    // 2. Pages des Users abrufen
    const pagesRes = await fetch(
      `https://graph.facebook.com/v19.0/me/accounts?access_token=${userToken}`
    );
    const pagesData = await pagesRes.json();

    if (!pagesData.data || pagesData.data.length === 0) {
      return NextResponse.redirect(`${appUrl}/accounts?error=no_pages`);
    }

    // 3. Pages als URL-Parameter weitergeben (temporär, wird in accounts-Seite gespeichert)
    const pages = encodeURIComponent(JSON.stringify(pagesData.data));
    return NextResponse.redirect(`${appUrl}/accounts?pages=${pages}`);

  } catch (err) {
    console.error('Facebook OAuth error:', err);
    return NextResponse.redirect(`${appUrl}/accounts?error=oauth_failed`);
  }
}

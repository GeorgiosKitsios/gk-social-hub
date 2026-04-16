import { NextResponse } from 'next/server';

export async function GET() {
  const appId       = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID;
  const redirectUri = process.env.NEXT_PUBLIC_APP_URL + '/api/auth/callback/facebook';

  const params = new URLSearchParams({
    client_id:     appId!,
    redirect_uri:  redirectUri,
    scope:         'pages_show_list,pages_read_engagement,pages_manage_posts,public_profile',
    response_type: 'code',
  });

  const url = `https://www.facebook.com/v19.0/dialog/oauth?${params.toString()}`;
  return NextResponse.redirect(url);
}

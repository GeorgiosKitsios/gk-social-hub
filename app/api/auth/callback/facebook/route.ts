import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code    = searchParams.get('code');
  const appUrl  = process.env.NEXT_PUBLIC_APP_URL!;

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
    const tokenData: { access_token?: string; [key: string]: unknown } = await tokenRes.json();

    if (!tokenData.access_token) {
      console.error('Token error:', tokenData);
      return NextResponse.redirect(`${appUrl}/accounts?error=token_failed`);
    }

    const userToken = tokenData.access_token;

    // 2. Alle Pages des Users abrufen (mit Paging-Support)
    //    'tasks' liefert die Berechtigungen pro Page (z.B. CREATE_CONTENT zum Posten).
    //    'instagram_business_account' liefert den verknüpften IG-Business-Account.
    type FbPage = {
      id:           string;
      name:         string;
      access_token: string;
      tasks?:       string[];
      instagram_business_account?: { id: string; username?: string };
    };
    let allPages: FbPage[] = [];
    let nextUrl: string | null =
      `https://graph.facebook.com/v19.0/me/accounts?fields=name,access_token,tasks,instagram_business_account{id,username}&access_token=${userToken}&limit=100`;

    while (nextUrl) {
      const pagesRes: Response = await fetch(nextUrl);
      const pagesData: { data?: FbPage[]; paging?: { next?: string } } = await pagesRes.json();

      if (pagesData.data) {
        allPages = [...allPages, ...pagesData.data];
      }
      nextUrl = pagesData.paging?.next ?? null;
    }

    if (allPages.length === 0) {
      return NextResponse.redirect(`${appUrl}/accounts?error=no_pages`);
    }

    // 3. Verknüpfte Instagram-Business-Accounts ableiten.
    //    Das Page Access Token funktioniert auch fürs IG-Publishing,
    //    sofern instagram_content_publish erteilt wurde.
    const igAccounts = allPages
      .filter(p => p.instagram_business_account?.id)
      .map(p => {
        const ig = p.instagram_business_account!;
        return {
          id:          `ig_${ig.id}`,
          name:        ig.username ? `${p.name} (@${ig.username})` : p.name,
          accountId:   ig.id,
          accessToken: p.access_token,
        };
      });

    // 4. Pages (und ggf. IG-Accounts) als URL-Parameter weitergeben.
    //    URLSearchParams übernimmt das Encoding einmalig; die Accounts-Seite
    //    parst die Werte direkt (kein zusätzliches decodeURIComponent).
    const params = new URLSearchParams();
    params.set('pages', JSON.stringify(allPages));
    if (igAccounts.length > 0) {
      params.set('igAccounts', JSON.stringify(igAccounts));
    }
    return NextResponse.redirect(`${appUrl}/accounts?${params.toString()}`);

  } catch (err) {
    console.error('Facebook OAuth error:', err);
    return NextResponse.redirect(`${appUrl}/accounts?error=oauth_failed`);
  }
}

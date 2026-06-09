import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const brandId   = searchParams.get('brandId') ?? 'default';

  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  const apiKey    = process.env.CLOUDINARY_API_KEY;
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;

  if (!apiSecret || !apiKey || !cloudName) {
    return NextResponse.json({ error: 'Cloudinary nicht konfiguriert.' }, { status: 500 });
  }

  const timestamp = Math.round(Date.now() / 1000);
  const folder    = `gk-social-hub/${brandId}`;

  // Cloudinary-Signatur: SHA1(alphabetisch sortierte Params + API-Secret).
  // Das Secret verlässt den Server nie.
  const toSign    = `folder=${folder}&timestamp=${timestamp}${apiSecret}`;
  const signature = crypto.createHash('sha1').update(toSign).digest('hex');

  return NextResponse.json({ timestamp, signature, apiKey, cloudName, folder });
}

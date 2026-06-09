import { v2 as cloudinary } from 'cloudinary';

const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
const apiKey    = process.env.CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET;

if (!cloudName) console.error('[Cloudinary] CLOUDINARY_CLOUD_NAME ist nicht gesetzt.');
if (!apiKey)    console.error('[Cloudinary] CLOUDINARY_API_KEY ist nicht gesetzt.');
if (!apiSecret) console.error('[Cloudinary] CLOUDINARY_API_SECRET ist nicht gesetzt – Uploads schlagen fehl.');

cloudinary.config({
  cloud_name: cloudName,
  api_key:    apiKey,
  api_secret: apiSecret,
  secure:     true, // immer https-URLs zurückgeben
});

/** True, wenn alle Cloudinary-Env-Variablen gesetzt sind. */
export function hasCloudinaryConfig(): boolean {
  return Boolean(cloudName && apiKey && apiSecret);
}

export { cloudinary };

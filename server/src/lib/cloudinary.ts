import { v2 as cloudinary } from 'cloudinary';
import { env } from './env.js';

cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME, api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET, secure: true,
});

export type Folder = 'payment-proofs' | 'services' | 'clinic';
export interface Uploaded { url: string; publicId: string }

const isPrivate = (folder: Folder) => folder === 'payment-proofs';
const PROOF_SEGMENT = '/payment-proofs/';

/**
 * Payment proofs are stored with delivery type `authenticated`: the plain URL is not deliverable and the image is only
 * reachable through a signed URL that this server generates for the owner/admin (see proofUrl).
 * For proofs, `Uploaded.url` is that unsigned (unusable) URL: store it if a column needs a value, but never send it to a client.
 */
export function uploadImage(buffer: Buffer, folder: Folder): Promise<Uploaded> {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload_stream(
      {
        folder: `ns-physio/${folder}`, resource_type: 'image', type: isPrivate(folder) ? 'authenticated' : 'upload',
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp'], overwrite: false, unique_filename: true, use_filename: false,
      },
      (err, res) => {
        if (err || !res) return reject(err ?? new Error('Upload failed'));
        // Defence in depth: if a proof was ever stored as public (preset/config change), remove it and fail.
        if (isPrivate(folder) && res.type !== 'authenticated') {
          void cloudinary.uploader.destroy(res.public_id, { type: res.type, invalidate: true }).catch(() => undefined);
          return reject(new Error('Payment proof was not stored privately'));
        }
        resolve({ url: res.secure_url, publicId: res.public_id });
      },
    ).end(buffer);
  });
}

/**
 * Signed, optimised delivery URL for a private payment proof. Only call for a caller you have already authorised
 * (proof owner or admin). Returns null when there is no private proof: legacy public URLs are intentionally NOT returned
 * (migrate them with server/scripts/migrate-proofs-private.ts).
 */
export function proofUrl(publicId: string | null | undefined, width = 1000): string | null {
  if (!publicId || !publicId.includes(PROOF_SEGMENT)) return null;
  return cloudinary.url(publicId, {
    type: 'authenticated', resource_type: 'image', sign_url: true, secure: true,
    transformation: [{ width, crop: 'limit', quality: 'auto', fetch_format: 'auto' }],
  });
}

export async function deleteImage(publicId?: string | null): Promise<void> {
  if (!publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId, { type: publicId.includes(PROOF_SEGMENT) ? 'authenticated' : 'upload', invalidate: true });
  } catch (e) { console.error('[cloudinary] delete failed', publicId, e); }
}
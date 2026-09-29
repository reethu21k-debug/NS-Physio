import multer from 'multer';
import type { RequestHandler } from 'express';
import { HttpError } from '../lib/errors.js';

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MIME_EXT: Record<string, string[]> = { 'image/jpeg': ['jpg', 'jpeg'], 'image/png': ['png'], 'image/webp': ['webp'] };

/** Detects the real image type from magic bytes (never trusts client MIME/filename). */
export function sniffImage(b: Buffer): 'image/jpeg' | 'image/png' | 'image/webp' | null {
  if (b.length > 12 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.length > 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (b.length > 12 && b.subarray(0, 4).toString('ascii') === 'RIFF' && b.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  return null;
}

const mem = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    const ext = file.originalname.split('.').pop()?.toLowerCase() ?? '';
    if (!MIME_EXT[file.mimetype]?.includes(ext)) return cb(new HttpError(400, 'Only JPG, PNG or WebP images are allowed.'));
    cb(null, true);
  },
});

/** Use as: imageUpload('file') — validates size, MIME, extension and magic bytes. */
export const imageUpload = (field: string): RequestHandler[] => [
  mem.single(field),
  (req, _res, next) => {
    if (!req.file) return next(new HttpError(400, 'Please choose an image to upload.'));
    const real = sniffImage(req.file.buffer);
    if (!real || real !== req.file.mimetype) return next(new HttpError(400, 'File content is not a valid JPG, PNG or WebP image.'));
    next();
  },
];

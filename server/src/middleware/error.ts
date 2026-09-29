import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import multer from 'multer';
import { HttpError } from '../lib/errors.js';
import { env } from '../lib/env.js';

export function notFound(_req: Request, res: Response) {
  res.status(404).json({ success: false, message: 'Not found.' });
}
export function errorHandler(err: unknown, _req: Request, res: Response, next: NextFunction) {
  if (res.headersSent) return next(err);
  if (err instanceof HttpError) return void res.status(err.status).json({ success: false, message: err.message, code: err.code });
  if (err instanceof ZodError) {
    return void res.status(400).json({ success: false, message: err.issues[0]?.message ?? 'Invalid input.', errors: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })) });
  }
  if (err instanceof multer.MulterError) {
    const m = err.code === 'LIMIT_FILE_SIZE' ? 'Image is too large (max 5 MB).' : 'Invalid upload.';
    return void res.status(400).json({ success: false, message: m });
  }
  // body-parser (express.json) failures: malformed JSON is a client error (400), never a 500.
  const bp = err as { type?: string; status?: number };
  if (bp?.type === 'entity.parse.failed' || (err instanceof SyntaxError && bp.status === 400 && 'body' in err)) {
    return void res.status(400).json({ success: false, message: 'Malformed JSON in request body.' });
  }
  if (bp?.type === 'entity.too.large') return void res.status(413).json({ success: false, message: 'Request is too large.' });
  if (bp?.type === 'charset.unsupported' || bp?.type === 'encoding.unsupported') return void res.status(415).json({ success: false, message: 'Unsupported request encoding.' });
  if (bp?.type === 'entity.verify.failed' || bp?.type === 'request.size.invalid') return void res.status(400).json({ success: false, message: 'Invalid request body.' });
  // Unknown errors: log server-side only (stack in dev, message only in production) and return a generic 500.
  console.error('[error]', env.NODE_ENV === 'production' ? (err as Error)?.message : err);
  res.status(500).json({ success: false, message: 'Something went wrong. Please try again.' });
}
export const ok = <T>(res: Response, data: T, status = 200) => res.status(status).json({ success: true, data });
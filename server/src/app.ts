import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { env } from './lib/env.js';
import { errorHandler, notFound } from './middleware/error.js';
import { services } from './routes/services.js';
import { appointments } from './routes/appointments.js';
import { payments } from './routes/payments.js';
import { adminRouter } from './routes/admin.js';
import { profile, settings } from './routes/settings.js';

const isProd = env.NODE_ENV === 'production';

function parseOrigins(raw: string): Set<string> {
  const out = new Set<string>();
  for (const part of raw.split(',')) {
    const t = part.trim().replace(/\/+$/, '');
    if (!t) continue;
    if (t === '*') {
      if (isProd) throw new Error('CLIENT_URL must not contain "*" in production.');
      continue; // never a wildcard fallback
    }
    let u: URL;
    try { u = new URL(t); } catch { throw new Error(`Invalid origin in CLIENT_URL: "${t}"`); }
    if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error(`Invalid origin protocol in CLIENT_URL: "${t}"`);
    out.add(u.origin);
  }
  if (!out.size) {
    if (isProd) throw new Error('CLIENT_URL must list at least one allowed origin in production.');
    out.add('http://localhost:5173'); // dev-only default (Vite)
  }
  return out;
}
const allowedOrigins = parseOrigins(env.CLIENT_URL ?? '');

export const app = express();
if (isProd) app.set('trust proxy', 1);
app.use(helmet());
app.use(cors({
  // No Origin header (curl, server-to-server) is not a browser CORS request; every browser origin must match exactly.
  origin: (origin, cb) => cb(null, !origin || allowedOrigins.has(origin)),
  credentials: false, // API uses Bearer tokens, not cookies
  maxAge: 600,
}));

// Rate limits run before body parsing so abusive requests are rejected cheaply.
app.use('/api', rateLimit({ windowMs: 15 * 60_000, limit: 400, standardHeaders: true, legacyHeaders: false }));
app.use('/api/appointments', rateLimit({ windowMs: 60_000, limit: 60, standardHeaders: true, legacyHeaders: false }));
app.use('/api/payments', rateLimit({ windowMs: 15 * 60_000, limit: 60, standardHeaders: true, legacyHeaders: false }));
// Dedicated, tighter cap for endpoints that push files to Cloudinary (cost + abuse surface). Legit users upload a few proofs at most.
const uploadLimiter = rateLimit({
  windowMs: 15 * 60_000, limit: 10, standardHeaders: true, legacyHeaders: false,
  skip: (req) => req.method !== 'POST',
  message: { success: false, message: 'Too many uploads. Please wait a few minutes and try again.' },
});
app.use(['/api/payments/:appointmentId/upload-proof', '/api/services/:id/image'], uploadLimiter);

app.use(express.json({ limit: '50kb' }));

app.get('/api/health', (_req, res) => void res.json({ success: true, data: { status: 'ok' } }));
app.use('/api/services', services);
app.use('/api/settings', settings);
app.use('/api/profile', profile);
app.use('/api/appointments', appointments);
app.use('/api/payments', payments);
app.use('/api/admin', adminRouter);
app.use(notFound);
app.use(errorHandler);

export default app;
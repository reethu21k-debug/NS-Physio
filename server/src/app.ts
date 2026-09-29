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

/**
 * Parse CLIENT_URL into a list of valid origins.
 *
 * Example:
 * CLIENT_URL=https://ns-physio-client.vercel.app
 *
 * Multiple origins:
 * CLIENT_URL=https://ns-physio-client.vercel.app,http://localhost:5173
 */
function parseOrigins(raw: string): Set<string> {
  const origins = new Set<string>();

  for (const part of raw.split(',')) {
    const value = part.trim();

    if (!value) continue;

    // Wildcard is intentionally not allowed in production.
    if (value === '*') {
      if (isProd) {
        throw new Error(
          'CLIENT_URL must not contain "*" in production.'
        );
      }

      continue;
    }

    let url: URL;

    try {
      url = new URL(value);
    } catch {
      throw new Error(
        `Invalid origin in CLIENT_URL: "${value}"`
      );
    }

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error(
        `Invalid origin protocol in CLIENT_URL: "${value}"`
      );
    }

    // Store only the origin:
    // https://example.com
    //
    // This removes paths, query strings and trailing slashes.
    origins.add(url.origin);
  }

  // Development fallback
  if (origins.size === 0) {
    if (isProd) {
      throw new Error(
        'CLIENT_URL must contain at least one allowed origin in production.'
      );
    }

    origins.add('http://localhost:5173');
  }

  return origins;
}

const allowedOrigins = parseOrigins(env.CLIENT_URL ?? '');

console.log(
  `[cors] allowed origins: ${[...allowedOrigins].join(', ')}`
);

export const app = express();

if (isProd) {
  app.set('trust proxy', 1);
}

/**
 * ---------------------------------------------------------
 * SECURITY HEADERS
 * ---------------------------------------------------------
 *
 * The frontend and backend are hosted on different domains,
 * so allow cross-origin resources.
 */
app.use(
  helmet({
    crossOriginResourcePolicy: {
      policy: 'cross-origin',
    },
  })
);

/**
 * ---------------------------------------------------------
 * CORS
 * ---------------------------------------------------------
 *
 * Frontend:
 * https://ns-physio-client.vercel.app
 *
 * Backend:
 * https://ns-physio-server.vercel.app
 *
 * CLIENT_URL controls which frontend origins are allowed.
 */
const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    // Requests without Origin:
    // curl, server-to-server, health checks, etc.
    if (!origin) {
      return callback(null, true);
    }

    // Exact origin match
    if (allowedOrigins.has(origin)) {
      return callback(null, true);
    }

    console.warn(
      `[cors] BLOCKED origin: ${origin}`
    );

    console.warn(
      `[cors] ALLOWED origins: ${[...allowedOrigins].join(', ')}`
    );

    // Return false so Express does not add CORS headers.
    return callback(null, false);
  },

  methods: [
    'GET',
    'POST',
    'PUT',
    'PATCH',
    'DELETE',
    'OPTIONS',
  ],

  allowedHeaders: [
    'Content-Type',
    'Authorization',
  ],

  // You are using Bearer tokens, not cookies.
  credentials: false,

  // Browser can cache successful preflight for 10 minutes.
  maxAge: 600,

  // Do not add wildcard "*" to ACAO.
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));

/**
 * ---------------------------------------------------------
 * RATE LIMITING
 * ---------------------------------------------------------
 */

app.use(
  '/api',
  rateLimit({
    windowMs: 15 * 60_000,
    limit: 400,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

app.use(
  '/api/appointments',
  rateLimit({
    windowMs: 60_000,
    limit: 60,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

app.use(
  '/api/payments',
  rateLimit({
    windowMs: 15 * 60_000,
    limit: 60,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

/**
 * ---------------------------------------------------------
 * UPLOAD RATE LIMIT
 * ---------------------------------------------------------
 *
 * Protects Cloudinary upload endpoints.
 */
const uploadLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,

  skip: (req) => req.method !== 'POST',

  message: {
    success: false,
    message:
      'Too many uploads. Please wait a few minutes and try again.',
  },
});

app.use(
  [
    '/api/payments/:appointmentId/upload-proof',
    '/api/services/:id/image',
  ],
  uploadLimiter
);

/**
 * ---------------------------------------------------------
 * BODY PARSING
 * ---------------------------------------------------------
 */

app.use(
  express.json({
    limit: '50kb',
  })
);

/**
 * ---------------------------------------------------------
 * HEALTH CHECK
 * ---------------------------------------------------------
 */

app.get('/api/health', (_req, res) => {
  return res.json({
    success: true,
    data: {
      status: 'ok',
    },
  });
});

/**
 * ---------------------------------------------------------
 * API ROUTES
 * ---------------------------------------------------------
 */

app.use('/api/services', services);

app.use('/api/settings', settings);

app.use('/api/profile', profile);

app.use('/api/appointments', appointments);

app.use('/api/payments', payments);

app.use('/api/admin', adminRouter);

/**
 * ---------------------------------------------------------
 * 404 + ERROR HANDLING
 * ---------------------------------------------------------
 */

app.use(notFound);

app.use(errorHandler);

export default app;
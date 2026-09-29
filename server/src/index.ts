import { app } from './app.js';
import { env } from './lib/env.js';

// Vercel runs the app as a serverless function, so only listen locally
if (!process.env.VERCEL) {
  app.listen(env.PORT, () => console.log(`NS Physio API listening on :${env.PORT} (${env.NODE_ENV})`));
}

export default app;
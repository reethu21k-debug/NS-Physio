import { app } from './app.js';
import { env } from './lib/env.js';
app.listen(env.PORT, () => console.log(`NS Physio API listening on :${env.PORT} (${env.NODE_ENV})`));

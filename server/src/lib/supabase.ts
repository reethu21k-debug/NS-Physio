import { createClient } from '@supabase/supabase-js';
import { env } from './env.js';

/** Service-role client: server-side ONLY. Bypasses RLS, so every route must authorise explicitly. */
export const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

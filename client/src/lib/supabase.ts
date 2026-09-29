import { createClient } from '@supabase/supabase-js';

/** Reads a required Vite env var; throws a clear, actionable error instead of silently using a placeholder project. */
function required(name: 'VITE_SUPABASE_URL' | 'VITE_SUPABASE_ANON_KEY'): string {
  const v = (import.meta.env[name] as string | undefined)?.trim();
  if (!v) {
    throw new Error(
      `Missing ${name}. Create client/.env (or set it in your host's build environment) with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY ` +
      '(Supabase dashboard -> Project Settings -> API). Restart the Vite dev server after editing .env.',
    );
  }
  return v;
}

const url = required('VITE_SUPABASE_URL');
const key = required('VITE_SUPABASE_ANON_KEY');

try {
  const u = new URL(url);
  if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Error('bad protocol');
} catch { throw new Error('VITE_SUPABASE_URL is not a valid http(s) URL.'); }

// Guard against the classic mistake of shipping the service-role key to the browser.
function isServiceRole(k: string): boolean {
  if (k.startsWith('sb_secret_')) return true;
  const part = k.split('.')[1];
  if (!part) return false;
  try { return (JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/'))) as { role?: string }).role === 'service_role'; } catch { return false; }
}
if (isServiceRole(key)) throw new Error('VITE_SUPABASE_ANON_KEY contains a service-role/secret key. Use the public anon key only; never expose secrets to the browser.');

// Only the public anon key is used in the browser. Authorization happens in the API + RLS.
export const supabase = createClient(url, key);
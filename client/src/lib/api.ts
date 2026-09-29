import { supabase } from './supabase';

export class ApiError extends Error {
  constructor(message: string, public status: number, public code?: string) { super(message); }
}
const BASE = import.meta.env.VITE_API_URL ?? '';

export async function api<T>(path: string, opts: { method?: string; body?: unknown; form?: FormData } = {}): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const headers: Record<string, string> = {};
  if (data.session) headers.Authorization = `Bearer ${data.session.access_token}`;
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  let res: Response;
  try {
    res = await fetch(`${BASE}/api${path}`, {
      method: opts.method ?? (opts.body || opts.form ? 'POST' : 'GET'), headers,
      body: opts.form ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
    });
  } catch { throw new ApiError('Unable to reach the server. Check your connection.', 0); }
  const json = (await res.json().catch(() => null)) as { success: boolean; data?: T; message?: string; code?: string } | null;
  if (!res.ok || !json?.success) throw new ApiError(json?.message ?? 'Something went wrong. Please try again.', res.status, json?.code);
  return json.data as T;
}
export const errMsg = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong. Please try again.');

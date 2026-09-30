import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { env } from '../lib/env.js';
import { supabase } from '../lib/supabase.js';
import { HttpError, fromDbError } from '../lib/errors.js';
import { ok } from '../middleware/error.js';
import { normalizeIndianPhone } from '../lib/phone.js';

export const authRouter = Router();

/** Same message for "no such number" and "wrong password" so the endpoint cannot be used to probe accounts. */
const BAD_CREDENTIALS = 'Incorrect email/mobile number or password.';
const BAD_PHONE = 'Enter a valid 10-digit mobile number.';

const loginSchema = z.object({ phone: z.string().trim().max(30), password: z.string().min(1).max(200) }).strict();
const availableSchema = z.object({ phone: z.string().trim().max(30) }).strict();

/**
 * Mobile + password sign-in. The number is resolved to the account's email on the SERVER and the password is verified by
 * Supabase Auth; the email is never sent back to the browser. The returned tokens are applied client-side with
 * supabase.auth.setSession(), after which the app behaves exactly as after an email login.
 */
authRouter.post('/login-phone', async (req, res) => {
  const v = loginSchema.parse(req.body);
  const phone = normalizeIndianPhone(v.phone);
  if (!phone) throw new HttpError(400, BAD_PHONE);

  const { data: p, error } = await supabase.from('profiles').select('email,is_active').eq('phone_normalized', phone).maybeSingle();
  if (error) throw fromDbError(error);
  if (!p?.email) throw new HttpError(401, BAD_CREDENTIALS);

  // Throwaway client: signing in on the shared service-role client would replace its credentials with the user's session.
  const authClient = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error: signInErr } = await authClient.auth.signInWithPassword({ email: p.email, password: v.password });
  if (signInErr || !data.session) {
    if (signInErr?.message.toLowerCase().includes('email not confirmed')) throw new HttpError(403, 'Please verify your email before signing in.');
    throw new HttpError(401, BAD_CREDENTIALS);
  }
  if (!p.is_active) throw new HttpError(403, 'Your account is not active.');

  ok(res, { session: { access_token: data.session.access_token, refresh_token: data.session.refresh_token } });
});

/** Used by the sign-up form for a friendly "already registered" message (the DB unique index is the real guard). */
authRouter.post('/phone-available', async (req, res) => {
  const { phone } = availableSchema.parse(req.body);
  const n = normalizeIndianPhone(phone);
  if (!n) throw new HttpError(400, BAD_PHONE);
  const { count, error } = await supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('phone_normalized', n);
  if (error) throw fromDbError(error);
  ok(res, { available: (count ?? 0) === 0 });
});
import type { NextFunction, Request, Response } from 'express';
import { supabase } from '../lib/supabase.js';
import { HttpError } from '../lib/errors.js';

export interface AuthUser { id: string; email: string; role: 'user' | 'admin'; full_name: string }
declare global { namespace Express { interface Request { user?: AuthUser } } }

/** Verifies the Supabase access token and loads role from the DB (never from the token/client). */
export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const token = req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null;
    if (!token) throw new HttpError(401, 'Please sign in to continue.');
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) throw new HttpError(401, 'Your session has expired. Please sign in again.');
    const { data: p } = await supabase.from('profiles').select('id,email,role,full_name,is_active').eq('id', data.user.id).single();
    if (!p || !p.is_active) throw new HttpError(403, 'Your account is not active.');
    req.user = { id: p.id, email: p.email, role: p.role, full_name: p.full_name };
    next();
  } catch (e) { next(e); }
}
export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if (req.user?.role !== 'admin') return next(new HttpError(403, 'You do not have permission to do that.'));
  next();
}

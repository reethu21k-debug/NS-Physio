import { z } from 'zod';
import { adminApptQuery, uuid } from './schemas.js';

/** Admin list: adds sort_by (default: newest booking first so fresh website bookings are always on top). */
export const adminListQuery = adminApptQuery.extend({ sort_by: z.enum(['created', 'date']).default('created') });

export const revenueQuery = z.object({ months: z.coerce.number().int().min(1).max(36).default(12) });

/** Bulk price update. Only id / pricing_type / price are accepted; nothing else can be changed here. */
export const priceUpdateSchema = z.object({
  items: z.array(z.object({
    id: uuid,
    pricing_type: z.enum(['fixed', 'starting_from', 'contact']),
    price: z.coerce.number().positive().max(1_000_000).nullable().optional(),
  }).strict().superRefine((v, ctx) => {
    if (v.pricing_type !== 'contact' && !v.price) ctx.addIssue({ code: 'custom', path: ['price'], message: 'Price is required for fixed and starting-from pricing' });
  })).min(1).max(100).refine((a) => new Set(a.map((i) => i.id)).size === a.length, 'Duplicate service ids'),
}).strict();
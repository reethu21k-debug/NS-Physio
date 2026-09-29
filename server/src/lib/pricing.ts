export type PricingType = 'fixed' | 'starting_from' | 'contact';
export interface PricedService { pricing_type: PricingType; price: number | null }

/** Amount the appointment is charged, computed from the DB service row only. null = confirm at clinic. */
export function calculateAmount(svc: PricedService): number | null {
  if (svc.pricing_type === 'contact') return null;
  if (svc.price === null || !(svc.price > 0)) throw new Error('Service has invalid price configuration');
  return svc.price;
}
export function canPayOnline(svc: PricedService): boolean { return calculateAmount(svc) !== null; }

-- Initial data only. No fake users or appointments.
insert into public.clinic_settings (singleton) values (true) on conflict (singleton) do nothing;

insert into public.services (name, description, pricing_type, price, duration_minutes, display_order) values
 ('Dry Cupping','A traditional therapy that uses gentle suction cups on the skin to support muscle relaxation and comfort. Suitability is assessed at your visit.','starting_from',299,30,1),
 ('Wet Cupping','A traditional therapy performed by a trained practitioner under hygienic conditions. Suitability is assessed at your visit.','starting_from',799,30,2),
 ('Needling','Targeted needling technique used as part of a physiotherapy treatment plan, performed with sterile single-use needles.','fixed',499,30,3),
 ('Other Therapy','Other physiotherapy and rehabilitation treatments. Contact the clinic to discuss your needs and pricing.','contact',null,30,4);

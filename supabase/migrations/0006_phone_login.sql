-- 0006_phone_login.sql  (idempotent; run once in the Supabase SQL editor)
-- Adds profiles.phone_normalized (E.164, e.g. +919876543210) so a mobile number can identify exactly one account.

-- Keep this logic identical to normalizeIndianPhone() in server/src/lib/phone.ts and client/src/lib/phone.ts.
create or replace function public.normalize_in_phone(p text) returns text
language plpgsql immutable set search_path = public as $$
declare d text;
begin
  if p is null then return null; end if;
  d := regexp_replace(p, '\D', '', 'g');
  if length(d) = 12 and left(d, 2) = '91' then d := substr(d, 3);
  elsif length(d) = 11 and left(d, 1) = '0' then d := substr(d, 2);
  end if;
  if d ~ '^[6-9][0-9]{9}$' then return '+91' || d; end if;
  return null;
end $$;

alter table public.profiles add column if not exists phone_normalized text;

-- Backfill from existing rows (invalid / empty phones stay NULL and simply cannot be used for phone login).
update public.profiles
   set phone_normalized = public.normalize_in_phone(phone)
 where phone is not null
   and phone_normalized is distinct from public.normalize_in_phone(phone);

-- Abort with a readable message if two accounts share a number (nothing is changed in that case).
do $$
declare d text;
begin
  select string_agg(phone_normalized || ' (' || n || ' accounts)', ', ') into d
    from (select phone_normalized, count(*) as n from public.profiles
           where phone_normalized is not null group by 1 having count(*) > 1) x;
  if d is not null then
    raise exception 'Duplicate phone numbers must be fixed first: %', d;
  end if;
end $$;

create unique index if not exists profiles_phone_normalized_key
  on public.profiles (phone_normalized) where phone_normalized is not null;

-- Keep it in sync on signup (handle_new_user insert) and on profile edits. Clients cannot write this column
-- directly: authenticated may only UPDATE (full_name, phone).
create or replace function public.set_phone_normalized() returns trigger
language plpgsql set search_path = public as $$
begin
  new.phone_normalized := public.normalize_in_phone(new.phone);
  return new;
end $$;
drop trigger if exists profiles_phone_normalized on public.profiles;
create trigger profiles_phone_normalized before insert or update of phone on public.profiles
  for each row execute function public.set_phone_normalized();
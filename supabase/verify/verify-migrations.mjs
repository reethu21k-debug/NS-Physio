import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';
import fs from 'fs';
const db = new PGlite({ extensions: { btree_gist } });
const dir = '../';
await db.exec(`
 create role anon; create role authenticated; create role service_role;
 create schema auth;
 create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb);
 create function auth.uid() returns uuid language sql as $$ select null::uuid $$;`);
for (const f of ['migrations/0001_schema.sql','migrations/0002_rls.sql','migrations/0003_booking_rpc.sql','migrations/0004_hardening.sql','seed.sql']) {
  let sql = fs.readFileSync(dir + f, 'utf8').replace('create extension if not exists pgcrypto;', '');
  try { await db.exec(sql); console.log('OK  ', f); } catch (e) { console.log('FAIL', f, e.message); process.exit(1); }
}
await db.exec(`insert into auth.users (email, raw_user_meta_data) values ('a@x.com','{"full_name":"Asha","phone":"999","role":"admin"}'),('b@x.com','{"full_name":"Bala"}')`);
const users = (await db.query('select id, role, full_name from profiles order by email')).rows;
console.log('profiles (role must be user even if metadata says admin):', users.map(u => `${u.full_name}:${u.role}`).join(', '));
const [A, B] = users.map(u => u.id);
const svc = Object.fromEntries((await db.query('select id,name from services')).rows.map(s => [s.name, s.id]));
const day = (await db.query(`select ((now() at time zone 'Asia/Kolkata')::date + 5)::text d`)).rows[0].d;
const book = async (u, s, t, m='offline') => {
  try { const r = await db.query('select * from book_appointment($1,$2,$3::date,$4::time,$5)', [u, svc[s], day, t, m]); return 'BOOKED amount=' + r.rows[0].amount; }
  catch (e) { return 'ERR ' + e.message; } };
console.log('book 10:00 Dry (A)       ->', await book(A, 'Dry Cupping', '10:00'));
console.log('book 10:00 Needling (B)  ->', await book(B, 'Needling', '10:00'), '  <- expect SLOT_TAKEN');
console.log('book 10:15 misaligned    ->', await book(B, 'Needling', '10:15'), '  <- expect INVALID_SLOT');
console.log('book 13:00 outside hours ->', await book(B, 'Needling', '13:00'), '  <- expect INVALID_SLOT');
console.log('book 20:30 last slot     ->', await book(B, 'Needling', '20:30'));
console.log('book 21:00 after close   ->', await book(B, 'Needling', '21:00'));
console.log('other therapy online     ->', await book(B, 'Other Therapy', '11:00', 'online'), '  <- expect ONLINE_NOT_ALLOWED');
console.log('other therapy offline    ->', await book(B, 'Other Therapy', '11:00'), '  <- amount null');
await db.query(`update appointments set appointment_status='cancelled', cancelled_by='cancelled_by_user' where start_time='10:00'`);
console.log('rebook 10:00 after cancel->', await book(B, 'Wet Cupping', '10:00'));
await db.query(`select block_slot($1,$2::date,false,'16:00','17:00','Holiday',null)`, [A, day]);
console.log('book 16:30 in blocked    ->', await book(B, 'Needling', '16:30'), '  <- expect SLOT_BLOCKED');
console.log('block over live appt     ->', await db.query(`select block_slot($1,$2::date,false,'10:00','10:30','Other',null)`, [A, day]).then(()=> 'blocked?!', e => 'ERR ' + e.message));
await db.query(`update services set price=999 where name='Needling'`);
const p = await db.query(`select amount from book_appointment($1,$2,$3::date,'12:00','offline')`, [B, svc['Needling'], day]);
console.log('price change reflected   -> amount', p.rows[0].amount, '(DB price, never client)');
console.log('direct exclusion check   ->', await db.query(`insert into appointments (user_id,service_id,appointment_date,start_time,end_time,payment_method) values ($1,$2,$3::date,'12:15','12:45','offline')`, [B, svc['Needling'], day]).then(()=>'inserted?!', e => 'ERR ' + e.message.slice(0,60)));
console.log('price CHECK (0)          ->', await db.query(`update services set price=0 where name='Needling'`).then(()=>'allowed?!', e => 'ERR ' + e.message.slice(0,60)));

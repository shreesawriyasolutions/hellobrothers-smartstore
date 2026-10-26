-- ==========================================================
--  HELLO BROTHERS SMART STORE - DATABASE SETUP
--  Naye Supabase project mein ek baar chalana hai (SQL Editor → Run).
--  Sirf structure hai — purani dukaan ka koi data nahi.
-- ==========================================================

-- ---------- Sequences ----------
create sequence if not exists public.repair_code_seq;

-- ---------- Tables ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null default 'staff' check (role in ('admin','staff')),
  can_view boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  mobile text not null unique check (mobile ~ '^[0-9]{10}$'),
  name text not null,
  created_by uuid default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.repairs (
  id uuid primary key default gen_random_uuid(),
  repair_code text not null unique default ('HBS-' || lpad(nextval('public.repair_code_seq')::text, 4, '0')),
  customer_id uuid not null references public.customers(id) on delete restrict,
  device_model text not null,
  problem text,
  status text not null default 'Received' check (status in ('Received','Diagnosing','Repair in Progress','Waiting for Part','Ready for Pickup','Delivered','Returned')),
  received_date date not null default current_date,
  estimated_charge numeric(12,2) check (estimated_charge is null or estimated_charge >= 0),
  estimated_delivery date,
  public_note text,
  internal_note text,
  created_by uuid default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists repairs_customer_idx on public.repairs (customer_id);
create index if not exists repairs_status_idx on public.repairs (status);
create index if not exists repairs_received_idx on public.repairs (received_date);

create table if not exists public.repair_status_history (
  id uuid primary key default gen_random_uuid(),
  repair_id uuid not null references public.repairs(id) on delete cascade,
  status text not null,
  changed_at timestamptz not null default now(),
  changed_by uuid
);
create index if not exists repair_history_idx on public.repair_status_history (repair_id, changed_at);

create table if not exists public.lookup_log (
  id bigint generated always as identity primary key,
  looked_at timestamptz not null default now()
);
create index if not exists lookup_log_time_idx on public.lookup_log (looked_at);

create table if not exists public.sales_entries (
  id uuid primary key default gen_random_uuid(),
  entry_date date not null default current_date,
  sale_description text not null,
  customer_name text,
  amount_received numeric(12,2) not null default 0 check (amount_received >= 0),
  expense numeric(12,2) not null default 0 check (expense >= 0),
  profit numeric(12,2) generated always as (amount_received - expense) stored,
  payment_mode text not null default 'Cash' check (payment_mode in ('Cash','UPI','Card','Other')),
  staff_name text not null,
  notes text,
  created_by uuid default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists sales_entries_date_idx on public.sales_entries (entry_date);

create table if not exists public.bills (
  id uuid primary key default gen_random_uuid(),
  bill_date date not null default current_date,
  bill_type text not null check (bill_type in ('Purchase Bill','Sale Bill','Unlocking Job')),
  party_name text not null,
  mobile_number text,
  phone_model text,
  imei text,
  work_type text,
  amount numeric(12,2) check (amount is null or amount >= 0),
  notes text,
  bill_file_path text,
  id_file_path text,
  extra_file_paths text[] not null default '{}',
  uploaded_by_name text not null,
  created_by uuid default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists bills_date_idx on public.bills (bill_date);

create table if not exists public.site_visits (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  path text not null check (char_length(path) <= 120),
  referrer text check (referrer is null or char_length(referrer) <= 120),
  device text check (device in ('mobile','tablet','desktop')),
  lang text check (lang is null or char_length(lang) <= 12),
  sid text check (sid is null or char_length(sid) <= 40)
);
create index if not exists site_visits_created_idx on public.site_visits (created_at desc);

-- ---------- Helper functions ----------
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.is_member() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid());
$$;

create or replace function public.can_view_entries() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and (role = 'admin' or can_view = true));
$$;

create or replace function public.set_updated_at() returns trigger
language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Naya login banne par profile apne aap 'staff' role se banta hai
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, role, can_view)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email), 'staff', false);
  return new;
end;
$$;

create or replace function public.log_repair_status() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into public.repair_status_history (repair_id, status, changed_by)
    values (new.id, new.status, auth.uid());
  end if;
  return new;
end;
$$;

create or replace function public.repairs_protect() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.repair_code is distinct from old.repair_code
     or new.customer_id is distinct from old.customer_id then
    raise exception 'Repair ID ya customer badla nahi ja sakta';
  end if;
  if not public.is_admin() then
    if new.device_model is distinct from old.device_model
       or new.problem is distinct from old.problem
       or new.received_date is distinct from old.received_date
       or new.estimated_charge is distinct from old.estimated_charge
       or new.estimated_delivery is distinct from old.estimated_delivery
       or new.public_note is distinct from old.public_note
       or new.internal_note is distinct from old.internal_note
       or new.created_by is distinct from old.created_by
       or new.created_at is distinct from old.created_at then
      raise exception 'Staff sirf status badal sakta hai';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.add_customer_or_get(p_mobile text, p_name text)
returns table(out_customer_id uuid, out_is_new boolean, out_name text)
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_name text;
begin
  if not public.is_member() then raise exception 'You do not have permission'; end if;
  if p_mobile is null or p_mobile !~ '^[0-9]{10}$' then raise exception 'Invalid mobile number'; end if;

  select c.id, c.name into v_id, v_name from public.customers c where c.mobile = p_mobile;
  if v_id is not null then
    return query select v_id, false, v_name;
    return;
  end if;

  if coalesce(trim(p_name), '') = '' then raise exception 'Customer name required'; end if;
  insert into public.customers (mobile, name) values (p_mobile, trim(p_name)) returning id into v_id;
  return query select v_id, true, trim(p_name);
end;
$$;

-- Customer apna mobile number daal ke apne phones ka status dekhta hai
-- (sirf public cheezein: internal note / charges nahi dikhte)
create or replace function public.track_repairs(p_mobile text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_cust public.customers%rowtype;
  v_recent int;
  v_result jsonb;
begin
  if p_mobile is null or p_mobile !~ '^[0-9]{10}$' then
    return jsonb_build_object('ok', false, 'error', 'invalid_format');
  end if;

  delete from public.lookup_log where looked_at < now() - interval '1 day';
  select count(*) into v_recent from public.lookup_log where looked_at > now() - interval '10 minutes';
  if v_recent >= 200 then
    return jsonb_build_object('ok', false, 'error', 'busy');
  end if;
  insert into public.lookup_log default values;

  select * into v_cust from public.customers where mobile = p_mobile;
  if not found then
    return jsonb_build_object('ok', true, 'repairs', '[]'::jsonb);
  end if;

  select jsonb_build_object(
    'ok', true,
    'first_name', split_part(v_cust.name, ' ', 1),
    'repairs', coalesce(jsonb_agg(
      jsonb_build_object(
        'repair_code', r.repair_code,
        'device_model', r.device_model,
        'problem', r.problem,
        'status', r.status,
        'received_date', r.received_date,
        'updated_at', r.updated_at,
        'estimated_delivery', r.estimated_delivery,
        'public_note', r.public_note,
        'history', (
          select coalesce(jsonb_agg(jsonb_build_object('status', h.status, 'changed_at', h.changed_at) order by h.changed_at), '[]'::jsonb)
          from public.repair_status_history h where h.repair_id = r.id
        )
      ) order by r.received_date desc, r.created_at desc
    ), '[]'::jsonb)
  ) into v_result
  from public.repairs r
  where r.customer_id = v_cust.id;

  return v_result;
end;
$$;

create or replace function public.get_visit_stats() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  tz text := 'Asia/Kolkata';
  d0 timestamptz := date_trunc('day', now() at time zone tz) at time zone tz;
  r jsonb;
begin
  if not public.is_admin() then raise exception 'You do not have permission'; end if;

  select jsonb_build_object(
    'today_views',   (select count(*) from site_visits where created_at >= d0),
    'today_visitors',(select count(distinct sid) from site_visits where created_at >= d0),
    'yday_views',    (select count(*) from site_visits where created_at >= d0 - interval '1 day' and created_at < d0),
    'week_views',    (select count(*) from site_visits where created_at >= d0 - interval '6 days'),
    'week_visitors', (select count(distinct sid) from site_visits where created_at >= d0 - interval '6 days'),
    'month_views',   (select count(*) from site_visits where created_at >= d0 - interval '29 days'),
    'month_visitors',(select count(distinct sid) from site_visits where created_at >= d0 - interval '29 days'),
    'total_views',   (select count(*) from site_visits),
    'last_visit',    (select max(created_at) from site_visits),
    'daily', (select coalesce(jsonb_agg(x order by x->>'day'),'[]'::jsonb) from (
        select jsonb_build_object('day', g.day::date::text, 'views', count(v.id), 'visitors', count(distinct v.sid)) x
        from generate_series((now() at time zone tz)::date - 13, (now() at time zone tz)::date, '1 day') as g(day)
        left join site_visits v on (v.created_at at time zone tz)::date = g.day::date
        group by g.day) t),
    'pages', (select coalesce(jsonb_agg(x),'[]'::jsonb) from (
        select jsonb_build_object('path', path, 'views', count(*)) x
        from site_visits where created_at >= d0 - interval '29 days'
        group by path order by count(*) desc limit 10) t),
    'referrers', (select coalesce(jsonb_agg(x),'[]'::jsonb) from (
        select jsonb_build_object('ref', ref, 'views', cnt) x from (
          select coalesce(nullif(referrer,''),'Direct / WhatsApp / QR') as ref, count(*) as cnt
          from site_visits where created_at >= d0 - interval '29 days'
          group by 1 order by 2 desc limit 8) q) t),
    'devices', (select coalesce(jsonb_agg(x),'[]'::jsonb) from (
        select jsonb_build_object('device', dev, 'views', cnt) x from (
          select coalesce(device,'unknown') as dev, count(*) as cnt
          from site_visits where created_at >= d0 - interval '29 days'
          group by 1 order by 2 desc) q) t),
    'recent', (select coalesce(jsonb_agg(x),'[]'::jsonb) from (
        select jsonb_build_object('at', created_at, 'path', path, 'device', device, 'ref', coalesce(nullif(referrer,''),'Direct')) x
        from site_visits order by created_at desc limit 15) t)
  ) into r;
  return r;
end;
$$;

-- ---------- Triggers ----------
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

drop trigger if exists customers_updated_at on public.customers;
create trigger customers_updated_at before update on public.customers for each row execute function public.set_updated_at();
drop trigger if exists repairs_updated_at on public.repairs;
create trigger repairs_updated_at before update on public.repairs for each row execute function public.set_updated_at();
drop trigger if exists repairs_protect_trg on public.repairs;
create trigger repairs_protect_trg before update on public.repairs for each row execute function public.repairs_protect();
drop trigger if exists repairs_log_status on public.repairs;
create trigger repairs_log_status after insert or update of status on public.repairs for each row execute function public.log_repair_status();
drop trigger if exists sales_entries_updated_at on public.sales_entries;
create trigger sales_entries_updated_at before update on public.sales_entries for each row execute function public.set_updated_at();
drop trigger if exists bills_updated_at on public.bills;
create trigger bills_updated_at before update on public.bills for each row execute function public.set_updated_at();

-- ---------- Row Level Security ----------
alter table public.profiles enable row level security;
alter table public.customers enable row level security;
alter table public.repairs enable row level security;
alter table public.repair_status_history enable row level security;
alter table public.lookup_log enable row level security;
alter table public.sales_entries enable row level security;
alter table public.bills enable row level security;
alter table public.site_visits enable row level security;

create policy profiles_read_own_or_admin on public.profiles for select to authenticated using (id = auth.uid() or public.is_admin());
create policy profiles_admin_update on public.profiles for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy profiles_admin_delete on public.profiles for delete to authenticated using (public.is_admin());

create policy customers_select_members on public.customers for select to authenticated using (public.is_member());
create policy customers_update_admin on public.customers for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy customers_delete_admin on public.customers for delete to authenticated using (public.is_admin());

create policy repairs_select_members on public.repairs for select to authenticated using (public.is_member());
create policy repairs_insert_members on public.repairs for insert to authenticated with check (public.is_member() and created_by = auth.uid());
create policy repairs_update_members on public.repairs for update to authenticated using (public.is_member()) with check (public.is_member());
create policy repairs_delete_admin on public.repairs for delete to authenticated using (public.is_admin());

create policy history_select_members on public.repair_status_history for select to authenticated using (public.is_member());

create policy entries_select_allowed on public.sales_entries for select to authenticated using (public.can_view_entries());
create policy entries_insert_members on public.sales_entries for insert to authenticated with check (public.is_member() and created_by = auth.uid());
create policy entries_update_admin on public.sales_entries for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy entries_delete_admin on public.sales_entries for delete to authenticated using (public.is_admin());

create policy bills_select_admin on public.bills for select to authenticated using (public.is_admin());
create policy bills_insert_members on public.bills for insert to authenticated with check (public.is_member() and created_by = auth.uid());
create policy bills_update_admin on public.bills for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy bills_delete_admin on public.bills for delete to authenticated using (public.is_admin());

create policy site_visits_insert_anon on public.site_visits for insert to anon, authenticated with check (true);
create policy site_visits_select_admin on public.site_visits for select to authenticated using (public.is_admin());

-- ---------- Grants (anon ko sirf zaroori cheezein) ----------
revoke all on all tables in schema public from anon;
grant insert on public.site_visits to anon;
revoke execute on all functions in schema public from public, anon;
grant execute on function public.track_repairs(text) to anon, authenticated;
grant execute on function public.add_customer_or_get(text, text) to authenticated;
grant execute on function public.get_visit_stats() to authenticated;
grant execute on function public.is_admin(), public.is_member(), public.can_view_entries() to authenticated;

-- ---------- Bills ki files ke liye private storage ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('bills', 'bills', false, 10485760, array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do nothing;

create policy bills_files_upload on storage.objects for insert to authenticated with check (bucket_id = 'bills' and public.is_member());
create policy bills_files_view_admin on storage.objects for select to authenticated using (bucket_id = 'bills' and public.is_admin());
create policy bills_files_update_admin on storage.objects for update to authenticated using (bucket_id = 'bills' and public.is_admin()) with check (bucket_id = 'bills' and public.is_admin());
create policy bills_files_delete_admin on storage.objects for delete to authenticated using (bucket_id = 'bills' and public.is_admin());

-- ==========================================================
--  PEHLA ADMIN BANANA:
--  1) Supabase Dashboard → Authentication → Users → "Add user"
--     (apna email + password daalo, "Auto confirm" on rakho)
--  2) Phir ye chalao (email badal ke):
--     update public.profiles set role = 'admin', can_view = true
--     where id = (select id from auth.users where email = 'aapka@email.com');
-- ==========================================================

-- ==========================================================
--  NAYA PROJECT BANA RAHE HO? Is file ke baad
--  supabase/upgrade-2026-10-intake-payment-warranty.sql bhi chalao
--  (IMEI, lock code, checklist, advance, warranty ke liye).
-- ==========================================================

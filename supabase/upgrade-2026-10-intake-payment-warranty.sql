-- ==========================================================
--  HELLO BROTHERS SMART STORE - UPGRADE (Oct 2026)
--  Naye features: IMEI, lock code, saath aayi cheezein, phone ki
--  halat (checklist), advance / final charge, warranty.
--
--  Kaise chalayein: Supabase Dashboard → SQL Editor → ye poori file
--  paste karo → Run. Ek se zyada baar chalane par bhi kuch nahi tootega.
--  Purana data safe rehta hai — sirf naye khaane (columns) judte hain.
-- ==========================================================

-- ---------- 1) Repairs table mein naye khaane ----------
alter table public.repairs add column if not exists imei text
  check (imei is null or imei ~ '^[0-9]{14,16}$');
alter table public.repairs add column if not exists lock_code text
  check (lock_code is null or char_length(lock_code) <= 40);
alter table public.repairs add column if not exists accessories text[] not null default '{}';
alter table public.repairs add column if not exists condition_checks text[] not null default '{}';
alter table public.repairs add column if not exists advance_paid numeric(12,2) not null default 0;
alter table public.repairs add column if not exists final_charge numeric(12,2);
alter table public.repairs add column if not exists warranty_days int;
alter table public.repairs add column if not exists delivered_on date;

do $$ begin
  alter table public.repairs add constraint repairs_advance_ok check (advance_paid >= 0);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.repairs add constraint repairs_final_ok check (final_charge is null or final_charge >= 0);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.repairs add constraint repairs_warranty_ok check (warranty_days is null or warranty_days between 0 and 365);
exception when duplicate_object then null; end $$;

-- Pehle se Delivered phones ki delivery date history se bhar do
update public.repairs r set delivered_on = (
  select (max(h.changed_at) at time zone 'Asia/Kolkata')::date
  from public.repair_status_history h
  where h.repair_id = r.id and h.status = 'Delivered'
)
where r.status = 'Delivered' and r.delivered_on is null;

-- ---------- 2) Staff sirf status badal sakta hai (naye khaane bhi lock) ----------
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
       or new.imei is distinct from old.imei
       or new.lock_code is distinct from old.lock_code
       or new.accessories is distinct from old.accessories
       or new.condition_checks is distinct from old.condition_checks
       or new.advance_paid is distinct from old.advance_paid
       or new.final_charge is distinct from old.final_charge
       or new.warranty_days is distinct from old.warranty_days
       or new.delivered_on is distinct from old.delivered_on
       or new.created_by is distinct from old.created_by
       or new.created_at is distinct from old.created_at then
      raise exception 'Staff sirf status badal sakta hai';
    end if;
  end if;
  return new;
end;
$$;

-- ---------- 3) Delivered hote hi delivery date apne aap ----------
-- (trigger ka naam jaan-bujh kar "repairs_set_..." hai taaki ye
--  repairs_protect_trg ke BAAD chale — staff ka status update na ruke)
create or replace function public.repairs_set_delivered() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.status = 'Delivered' and (tg_op = 'INSERT' or old.status is distinct from 'Delivered') then
    new.delivered_on := (now() at time zone 'Asia/Kolkata')::date;
  elsif tg_op = 'UPDATE' and new.status <> 'Delivered' and old.status = 'Delivered' then
    new.delivered_on := null;
  end if;
  return new;
end;
$$;

drop trigger if exists repairs_set_delivered_trg on public.repairs;
create trigger repairs_set_delivered_trg before insert or update of status on public.repairs
  for each row execute function public.repairs_set_delivered();

-- ---------- 4) Track page: warranty bhi dikhe ----------
-- (lock code, IMEI, charges ab bhi customer ko NAHI dikhte)
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
        'delivered_on', r.delivered_on,
        'warranty_until', case
          when r.status = 'Delivered' and r.delivered_on is not null and coalesce(r.warranty_days, 0) > 0
          then r.delivered_on + r.warranty_days end,
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

revoke execute on function public.repairs_set_delivered() from public, anon;
grant execute on function public.track_repairs(text) to anon, authenticated;

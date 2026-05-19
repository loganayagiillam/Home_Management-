-- Shared Rental Room Management MVP
-- Run in Supabase SQL editor or via Supabase migrations.

-- Extensions
create extension if not exists "pgcrypto";

-- Types
do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type public.user_role as enum ('admin', 'tenant');
  end if;
  if not exists (select 1 from pg_type where typname = 'room_status') then
    create type public.room_status as enum ('occupied', 'vacant');
  end if;
  if not exists (select 1 from pg_type where typname = 'bill_status') then
    create type public.bill_status as enum ('pending', 'paid');
  end if;
  if not exists (select 1 from pg_type where typname = 'payment_method') then
    create type public.payment_method as enum ('cash', 'upi', 'bank');
  end if;
  if not exists (select 1 from pg_type where typname = 'complaint_status') then
    create type public.complaint_status as enum ('open', 'in_progress', 'closed');
  end if;
end$$;

-- Core tables
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  role public.user_role not null default 'tenant',
  created_at timestamptz not null default now()
);

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  room_number text not null unique,
  capacity int not null check (capacity > 0),
  monthly_rent numeric(12,2) not null check (monthly_rent >= 0),
  status public.room_status not null default 'vacant',
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.room_memberships (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  tenant_id uuid not null references public.profiles(id) on delete cascade,
  is_leader boolean not null default false,
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists room_memberships_room_id_idx on public.room_memberships(room_id);
create index if not exists room_memberships_tenant_id_idx on public.room_memberships(tenant_id);

-- A tenant can only have one active membership
create unique index if not exists room_memberships_one_active_per_tenant
  on public.room_memberships(tenant_id)
  where left_at is null;

-- Only one active leader per room
create unique index if not exists room_memberships_one_active_leader_per_room
  on public.room_memberships(room_id)
  where left_at is null and is_leader;

create table if not exists public.room_invites (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  token_hash text not null,
  expires_at timestamptz,
  max_uses int,
  uses int not null default 0,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index if not exists room_invites_room_id_idx on public.room_invites(room_id);

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references public.profiles(id) on delete restrict,
  room_id uuid references public.rooms(id) on delete set null,
  entity_type text not null,
  entity_id uuid not null,
  action text not null,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_events_room_id_idx on public.audit_events(room_id);
create index if not exists audit_events_entity_idx on public.audit_events(entity_type, entity_id);

-- Monthly bills
create table if not exists public.room_bills (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  bill_month date not null,
  rent_amount numeric(12,2) not null default 0,
  electricity_amount numeric(12,2) not null default 0,
  water_amount numeric(12,2) not null default 0,
  other_amount numeric(12,2) not null default 0,
  total_amount numeric(12,2) generated always as (
    rent_amount + electricity_amount + water_amount + other_amount
  ) stored,
  status public.bill_status not null default 'pending',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index if not exists room_bills_room_month_unique on public.room_bills(room_id, bill_month);
create index if not exists room_bills_room_id_idx on public.room_bills(room_id);

-- Electricity readings (bi-monthly entry allowed; applied to the bill_month it is linked to)
create table if not exists public.electricity_readings (
  id uuid primary key default gen_random_uuid(),
  room_bill_id uuid not null references public.room_bills(id) on delete cascade,
  previous_reading int not null check (previous_reading >= 0),
  current_reading int not null check (current_reading >= previous_reading),
  unit_rate numeric(12,2) not null check (unit_rate >= 0),
  units int generated always as (current_reading - previous_reading) stored,
  amount numeric(12,2) generated always as ((current_reading - previous_reading) * unit_rate) stored,
  entered_by uuid references public.profiles(id) on delete set null,
  entered_at timestamptz not null default now()
);

create index if not exists electricity_readings_bill_idx on public.electricity_readings(room_bill_id);

-- Payments
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  room_bill_id uuid not null references public.room_bills(id) on delete cascade,
  paid_by uuid references public.profiles(id) on delete set null,
  recorded_by uuid references public.profiles(id) on delete set null,
  payment_method public.payment_method not null,
  amount numeric(12,2) not null check (amount > 0),
  reference text,
  paid_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists payments_bill_idx on public.payments(room_bill_id);

-- Announcements
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references public.rooms(id) on delete cascade,
  title text not null,
  message text not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists announcements_room_id_idx on public.announcements(room_id);

-- Complaints
create table if not exists public.complaints (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.profiles(id) on delete cascade,
  room_id uuid not null references public.rooms(id) on delete cascade,
  issue text not null,
  status public.complaint_status not null default 'open',
  created_at timestamptz not null default now()
);

create index if not exists complaints_room_id_idx on public.complaints(room_id);
create index if not exists complaints_tenant_id_idx on public.complaints(tenant_id);

-- Notifications (in-app)
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  title text not null,
  message text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists notifications_recipient_idx on public.notifications(recipient_id);

-- Derived bill summary
create or replace view public.room_bill_summary as
select
  b.id,
  b.room_id,
  b.bill_month,
  b.rent_amount,
  b.electricity_amount,
  b.water_amount,
  b.other_amount,
  b.total_amount,
  coalesce(sum(p.amount), 0)::numeric(12,2) as paid_amount,
  (b.total_amount - coalesce(sum(p.amount), 0))::numeric(12,2) as balance_due,
  (b.total_amount - coalesce(sum(p.amount), 0) <= 0) as is_paid
from public.room_bills b
left join public.payments p on p.room_bill_id = b.id
group by b.id;

-- Helper functions for RLS
create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  );
$$;

create or replace function public.is_active_room_member(target_room_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.room_memberships rm
    where rm.room_id = target_room_id
      and rm.tenant_id = auth.uid()
      and rm.left_at is null
  );
$$;

create or replace function public.is_room_leader(target_room_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.room_memberships rm
    where rm.room_id = target_room_id
      and rm.tenant_id = auth.uid()
      and rm.left_at is null
      and rm.is_leader = true
  );
$$;

-- Auto-create profiles for new auth users
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''), new.phone)
  on conflict (id) do nothing;

  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'on_auth_user_created'
  ) then
    create trigger on_auth_user_created
    after insert on auth.users
    for each row execute procedure public.handle_new_user();
  end if;
end$$;

-- Capacity enforcement (reject new active membership if room is full)
create or replace function public.enforce_room_capacity()
returns trigger
language plpgsql
as $$
declare
  current_count int;
  cap int;
begin
  if new.left_at is not null then
    return new;
  end if;

  select r.capacity into cap
  from public.rooms r
  where r.id = new.room_id;

  select count(*) into current_count
  from public.room_memberships rm
  where rm.room_id = new.room_id
    and rm.left_at is null;

  if current_count >= cap then
    raise exception 'Room capacity exceeded';
  end if;

  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'enforce_room_capacity_trigger'
  ) then
    create trigger enforce_room_capacity_trigger
    before insert on public.room_memberships
    for each row execute procedure public.enforce_room_capacity();
  end if;
end$$;

-- RLS
alter table public.profiles enable row level security;
alter table public.rooms enable row level security;
alter table public.room_memberships enable row level security;
alter table public.room_invites enable row level security;
alter table public.audit_events enable row level security;
alter table public.room_bills enable row level security;
alter table public.electricity_readings enable row level security;
alter table public.payments enable row level security;
alter table public.announcements enable row level security;
alter table public.complaints enable row level security;
alter table public.notifications enable row level security;

-- profiles
drop policy if exists profiles_admin_all on public.profiles;
create policy profiles_admin_all on public.profiles
  for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists profiles_self_select on public.profiles;
create policy profiles_self_select on public.profiles
  for select
  using (id = auth.uid());

drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles
  for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- rooms
drop policy if exists rooms_admin_all on public.rooms;
create policy rooms_admin_all on public.rooms
  for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists rooms_member_select on public.rooms;
create policy rooms_member_select on public.rooms
  for select
  using (public.is_active_room_member(id));

-- room_memberships
drop policy if exists memberships_admin_all on public.room_memberships;
create policy memberships_admin_all on public.room_memberships
  for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists memberships_member_select on public.room_memberships;
create policy memberships_member_select on public.room_memberships
  for select
  using (public.is_active_room_member(room_id));

-- Leaders can add members to their own room
drop policy if exists memberships_leader_insert on public.room_memberships;
create policy memberships_leader_insert on public.room_memberships
  for insert
  with check (public.is_room_leader(room_id));

-- Leaders can mark a membership as left (soft-remove) for their own room
drop policy if exists memberships_leader_update on public.room_memberships;
create policy memberships_leader_update on public.room_memberships
  for update
  using (public.is_room_leader(room_id))
  with check (public.is_room_leader(room_id));

-- room_invites
drop policy if exists invites_admin_all on public.room_invites;
create policy invites_admin_all on public.room_invites
  for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists invites_leader_all on public.room_invites;
create policy invites_leader_all on public.room_invites
  for all
  using (public.is_room_leader(room_id))
  with check (public.is_room_leader(room_id));

-- audit_events
drop policy if exists audit_admin_all on public.audit_events;
create policy audit_admin_all on public.audit_events
  for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists audit_leader_insert on public.audit_events;
create policy audit_leader_insert on public.audit_events
  for insert
  with check (
    room_id is not null and public.is_room_leader(room_id)
  );

-- room_bills
drop policy if exists bills_admin_all on public.room_bills;
create policy bills_admin_all on public.room_bills
  for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists bills_member_select on public.room_bills;
create policy bills_member_select on public.room_bills
  for select
  using (public.is_active_room_member(room_id));

-- electricity_readings
drop policy if exists readings_admin_all on public.electricity_readings;
create policy readings_admin_all on public.electricity_readings
  for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists readings_member_select on public.electricity_readings;
create policy readings_member_select on public.electricity_readings
  for select
  using (
    exists (
      select 1
      from public.room_bills b
      where b.id = room_bill_id
        and public.is_active_room_member(b.room_id)
    )
  );

-- payments
drop policy if exists payments_admin_all on public.payments;
create policy payments_admin_all on public.payments
  for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists payments_member_select on public.payments;
create policy payments_member_select on public.payments
  for select
  using (
    exists (
      select 1
      from public.room_bills b
      where b.id = room_bill_id
        and public.is_active_room_member(b.room_id)
    )
  );

-- announcements
drop policy if exists announcements_admin_all on public.announcements;
create policy announcements_admin_all on public.announcements
  for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists announcements_member_select on public.announcements;
create policy announcements_member_select on public.announcements
  for select
  using (
    room_id is null
    or public.is_active_room_member(room_id)
  );

-- complaints
drop policy if exists complaints_admin_all on public.complaints;
create policy complaints_admin_all on public.complaints
  for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists complaints_member_select on public.complaints;
create policy complaints_member_select on public.complaints
  for select
  using (tenant_id = auth.uid());

drop policy if exists complaints_member_insert on public.complaints;
create policy complaints_member_insert on public.complaints
  for insert
  with check (
    tenant_id = auth.uid()
    and public.is_active_room_member(room_id)
  );

-- notifications
drop policy if exists notifications_admin_all on public.notifications;
create policy notifications_admin_all on public.notifications
  for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists notifications_member_select on public.notifications;
create policy notifications_member_select on public.notifications
  for select
  using (recipient_id = auth.uid());

-- Grants are managed by Supabase; RLS policies above enforce access.

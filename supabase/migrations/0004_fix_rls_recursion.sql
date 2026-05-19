-- Fix infinite recursion in RLS policies by making helper functions bypass RLS

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
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
security definer
set search_path = public
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
security definer
set search_path = public
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

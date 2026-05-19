-- Auto-sync rooms.status based on active room_memberships
-- occupied if >= 1 active member, else vacant

create or replace function public.sync_room_status_from_memberships(target_room_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  active_count int;
begin
  select count(*) into active_count
  from public.room_memberships rm
  where rm.room_id = target_room_id
    and rm.left_at is null;

  update public.rooms r
  set status = case when active_count > 0 then 'occupied'::public.room_status else 'vacant'::public.room_status end
  where r.id = target_room_id;
end;
$$;

create or replace function public.room_memberships_sync_room_status_trigger()
returns trigger
language plpgsql
as $$
begin
  -- After any change that can affect active member count
  perform public.sync_room_status_from_memberships(coalesce(new.room_id, old.room_id));
  return coalesce(new, old);
end;
$$;

drop trigger if exists room_memberships_sync_room_status on public.room_memberships;
create trigger room_memberships_sync_room_status
after insert or update or delete on public.room_memberships
for each row
execute procedure public.room_memberships_sync_room_status_trigger();

-- Backfill existing rooms
update public.rooms r
set status = case
  when exists (
    select 1
    from public.room_memberships rm
    where rm.room_id = r.id
      and rm.left_at is null
  ) then 'occupied'::public.room_status
  else 'vacant'::public.room_status
end;

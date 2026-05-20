-- DB hardening:
-- - Prevent rare token-hash collisions via unique index
-- - Remove race conditions in room capacity enforcement
-- - Make accept_room_invite concurrency-safe (locks invite + room)

-- 1) Token hash uniqueness
create unique index if not exists room_invites_token_hash_uidx
  on public.room_invites(token_hash);

-- 2) Capacity enforcement should serialize joins per room
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

  -- Lock the room row to prevent concurrent inserts from oversubscribing capacity.
  select r.capacity into cap
  from public.rooms r
  where r.id = new.room_id
  for update;

  if cap is null then
    raise exception 'Room not found';
  end if;

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

-- 3) Invite acceptance should lock the invite + room (prevents double-accept)
create or replace function public.accept_room_invite(token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite record;
  v_room_id uuid;
  v_email text;
  v_cap int;
  v_active_count int;
  v_updated_invite_id uuid;
  v_membership_id uuid;
begin
  if token is null or length(trim(token)) < 16 then
    raise exception 'Invalid invite token';
  end if;

  if exists (
    select 1
    from public.room_memberships rm
    where rm.tenant_id = auth.uid()
      and rm.left_at is null
  ) then
    raise exception 'You are already assigned to a room';
  end if;

  select
    ri.id,
    ri.room_id,
    ri.expires_at,
    ri.max_uses,
    ri.uses,
    ri.invited_email,
    ri.is_leader_invite
  into v_invite
  from public.room_invites ri
  where ri.token_hash = public.hash_invite_token(token)
    and (ri.expires_at is null or ri.expires_at > now())
    and (ri.max_uses is null or ri.uses < ri.max_uses)
  for update
  limit 1;

  if not found then
    raise exception 'Invite not found or expired';
  end if;

  if v_invite.invited_email is not null then
    v_email := lower(coalesce(auth.jwt() ->> 'email', ''));
    if v_email = '' or v_email <> lower(v_invite.invited_email) then
      raise exception 'Invite is for a different email';
    end if;
  end if;

  v_room_id := v_invite.room_id;

  -- Lock room row so capacity checks are consistent under concurrency.
  select r.capacity into v_cap
  from public.rooms r
  where r.id = v_room_id
  for update;

  if v_cap is null then
    raise exception 'Room not found';
  end if;

  select count(*) into v_active_count
  from public.room_memberships rm
  where rm.room_id = v_room_id
    and rm.left_at is null;

  if v_active_count >= v_cap then
    raise exception 'Room is full';
  end if;

  if coalesce(v_invite.is_leader_invite, false) then
    if exists (
      select 1
      from public.room_memberships rm
      where rm.room_id = v_room_id
        and rm.left_at is null
        and rm.is_leader = true
    ) then
      raise exception 'Room already has a leader';
    end if;
  end if;

  -- Increment uses (must still be available). This is now concurrency-safe due to the row lock above.
  update public.room_invites
  set uses = uses + 1
  where id = v_invite.id
    and (max_uses is null or uses < max_uses)
  returning id into v_updated_invite_id;

  if v_updated_invite_id is null then
    raise exception 'Invite not found or expired';
  end if;

  insert into public.room_memberships (room_id, tenant_id, is_leader)
  values (v_room_id, auth.uid(), coalesce(v_invite.is_leader_invite, false))
  returning id into v_membership_id;

  insert into public.audit_events (
    actor_id,
    room_id,
    entity_type,
    entity_id,
    action,
    before,
    after
  ) values (
    auth.uid(),
    v_room_id,
    'room_membership',
    v_membership_id,
    'invite_accepted',
    null,
    jsonb_build_object(
      'room_id', v_room_id,
      'tenant_id', auth.uid(),
      'is_leader', coalesce(v_invite.is_leader_invite, false),
      'invited_email', v_invite.invited_email
    )
  );

  return v_room_id;
end;
$$;

revoke all on function public.accept_room_invite(text) from public;
grant execute on function public.accept_room_invite(text) to authenticated;

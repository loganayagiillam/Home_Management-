-- Guardrails for accept_room_invite:
-- - Friendly errors for: already assigned, room full, leader already exists
-- - Email-locked invites enforced (already present in 0006)

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

  select r.capacity into v_cap
  from public.rooms r
  where r.id = v_room_id;

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

  -- Increment uses (best-effort)
  update public.room_invites
  set uses = uses + 1
  where id = v_invite.id;

  insert into public.room_memberships (room_id, tenant_id, is_leader)
  values (v_room_id, auth.uid(), coalesce(v_invite.is_leader_invite, false));

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
    gen_random_uuid(),
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

-- Invite acceptance via security definer function

create extension if not exists "pgcrypto";

create or replace function public.hash_invite_token(token text)
returns text
language sql
immutable
set search_path = public, extensions
as $$
  select encode(digest(convert_to(token, 'utf8'), 'sha256'), 'hex');
$$;

create or replace function public.accept_room_invite(token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite record;
  v_room_id uuid;
begin
  if token is null or length(trim(token)) < 16 then
    raise exception 'Invalid invite token';
  end if;

  select * into v_invite
  from public.room_invites ri
  where ri.token_hash = public.hash_invite_token(token)
    and (ri.expires_at is null or ri.expires_at > now())
    and (ri.max_uses is null or ri.uses < ri.max_uses)
  limit 1;

  if not found then
    raise exception 'Invite not found or expired';
  end if;

  -- Increment uses (best-effort)
  update public.room_invites
  set uses = uses + 1
  where id = v_invite.id;

  v_room_id := v_invite.room_id;

  insert into public.room_memberships (room_id, tenant_id, is_leader)
  values (v_room_id, auth.uid(), false);

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
    jsonb_build_object('room_id', v_room_id, 'tenant_id', auth.uid())
  );

  return v_room_id;
end;
$$;

revoke all on function public.accept_room_invite(text) from public;
grant execute on function public.accept_room_invite(text) to authenticated;

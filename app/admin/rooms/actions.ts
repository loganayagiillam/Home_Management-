'use server';

import crypto from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/auth/server';
import { getErrorMessage } from '@/lib/flash';

function toInt(value: FormDataEntryValue | null) {
  const str = typeof value === 'string' ? value.trim() : '';
  const num = Number(str);
  return Number.isFinite(num) ? Math.trunc(num) : null;
}

function toMoney(value: FormDataEntryValue | null) {
  const str = typeof value === 'string' ? value.trim() : '';
  const num = Number(str);
  return Number.isFinite(num) ? num : null;
}

function sha256Hex(input: string) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

type InviteState = {
  token: string | null;
  error: string | null;
};

async function createRoomInviteInternal(roomId: string, opts?: { isLeaderInvite?: boolean; invitedEmail?: string | null }) {
  const { supabase, user } = await requireAdmin();

  if (!roomId) throw new Error('Missing room id');

  const invitedEmail = opts?.invitedEmail ? opts.invitedEmail.toLowerCase() : null;
  const isLeaderInvite = Boolean(opts?.isLeaderInvite);

  const [{ data: room, error: roomError }, { count: activeMembers, error: membersError }] = await Promise.all([
    supabase.from('rooms').select('id, capacity').eq('id', roomId).maybeSingle(),
    supabase
      .from('room_memberships')
      .select('id', { count: 'exact', head: true })
      .eq('room_id', roomId)
      .is('left_at', null),
  ]);

  if (roomError) throw new Error(roomError.message);
  if (!room) throw new Error('Room not found');
  if (membersError) throw new Error(membersError.message);

  // Any invite that results in a membership should not be created if room is full.
  if ((activeMembers ?? 0) >= room.capacity) {
    throw new Error('Room is full');
  }

  const token = crypto.randomBytes(24).toString('base64url');
  const tokenHash = sha256Hex(token);

  const { data: invite, error } = await supabase
    .from('room_invites')
    .insert({
      room_id: roomId,
      token_hash: tokenHash,
      expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString(),
      max_uses: isLeaderInvite ? 1 : 10,
      created_by: user.id,
      invited_email: invitedEmail,
      is_leader_invite: isLeaderInvite,
    })
    .select('id')
    .single();

  if (error) throw new Error(error.message);

  await supabase.from('audit_events').insert({
    actor_id: user.id,
    room_id: roomId,
    entity_type: 'invite',
    entity_id: invite.id,
    action: isLeaderInvite ? 'created_leader_invite' : 'created_by_admin',
    before: null,
    after: { room_id: roomId, invite_id: invite.id, invited_email: invitedEmail, is_leader_invite: isLeaderInvite },
  });

  revalidatePath('/admin/rooms');
  return token;
}

export async function createRoom(formData: FormData) {
  const { supabase, user } = await requireAdmin();

  try {

    const roomNumber = String(formData.get('room_number') ?? '').trim();
    const capacity = toInt(formData.get('capacity'));
    const monthlyRent = toMoney(formData.get('monthly_rent'));
    const notes = String(formData.get('notes') ?? '').trim();

    if (!roomNumber) throw new Error('Room number is required');
    if (!capacity || capacity <= 0) throw new Error('Capacity must be > 0');
    if (monthlyRent == null || monthlyRent < 0) throw new Error('Monthly rent must be >= 0');

    const { data: createdRoom, error } = await supabase
      .from('rooms')
      .insert({
        room_number: roomNumber,
        capacity,
        monthly_rent: monthlyRent,
        // status is derived from memberships; default in DB is 'vacant'
        notes: notes ? notes : null,
      })
      .select('id')
      .single();

    if (error) throw new Error(error.message);

    if (!createdRoom?.id) {
      throw new Error('Failed to read created room id');
    }

    await supabase.from('audit_events').insert({
      actor_id: user.id,
      room_id: createdRoom.id,
      entity_type: 'room',
      entity_id: createdRoom.id,
      action: 'created',
      before: null,
      after: { room_number: roomNumber, capacity, monthly_rent: monthlyRent },
    });

    revalidatePath('/admin/rooms');

  } catch (e) {
    redirect(`/admin/rooms?error=${encodeURIComponent(getErrorMessage(e))}`);
  }
}

export async function updateRoom(formData: FormData) {
  const { supabase, user } = await requireAdmin();

  try {

    const id = String(formData.get('id') ?? '').trim();
    const roomNumber = String(formData.get('room_number') ?? '').trim();
    const capacity = toInt(formData.get('capacity'));
    const monthlyRent = toMoney(formData.get('monthly_rent'));
    const notes = String(formData.get('notes') ?? '').trim();

    if (!id) throw new Error('Missing room id');
    if (!roomNumber) throw new Error('Room number is required');
    if (!capacity || capacity <= 0) throw new Error('Capacity must be > 0');
    if (monthlyRent == null || monthlyRent < 0) throw new Error('Monthly rent must be >= 0');

    const [{ data: before }, { count: activeMembers }] = await Promise.all([
      supabase.from('rooms').select('room_number, capacity, monthly_rent, status, notes').eq('id', id).maybeSingle(),
      supabase
        .from('room_memberships')
        .select('id', { count: 'exact', head: true })
        .eq('room_id', id)
        .is('left_at', null),
    ]);

    if ((activeMembers ?? 0) > capacity) {
      throw new Error(`Capacity cannot be less than active members (${activeMembers}).`);
    }

    const { error } = await supabase
      .from('rooms')
      .update({
        room_number: roomNumber,
        capacity,
        monthly_rent: monthlyRent,
        // status is derived from memberships
        notes: notes ? notes : null,
      })
      .eq('id', id);

    if (error) throw new Error(error.message);

    await supabase.from('audit_events').insert({
      actor_id: user.id,
      room_id: id,
      entity_type: 'room',
      entity_id: id,
      action: 'updated',
      before,
      after: { room_number: roomNumber, capacity, monthly_rent: monthlyRent, notes: notes ? notes : null },
    });

    revalidatePath('/admin/rooms');

  } catch (e) {
    redirect(`/admin/rooms?error=${encodeURIComponent(getErrorMessage(e))}`);
  }
}

export async function deleteRoom(formData: FormData) {
  const { supabase, user } = await requireAdmin();

  try {

    const id = String(formData.get('id') ?? '').trim();
    if (!id) throw new Error('Missing room id');

    const { data: before } = await supabase
      .from('rooms')
      .select('room_number, capacity, monthly_rent, status')
      .eq('id', id)
      .maybeSingle();

    const { error } = await supabase.from('rooms').delete().eq('id', id);
    if (error) throw new Error(error.message);

    await supabase.from('audit_events').insert({
      actor_id: user.id,
      room_id: null,
      entity_type: 'room',
      entity_id: id,
      action: 'deleted',
      before,
      after: null,
    });

    revalidatePath('/admin/rooms');

  } catch (e) {
    redirect(`/admin/rooms?error=${encodeURIComponent(getErrorMessage(e))}`);
  }
}

export async function createRoomInvite(roomId: string) {
  return createRoomInviteInternal(roomId, { isLeaderInvite: false });
}

export async function createRoomInviteAction(_prevState: InviteState, formData: FormData): Promise<InviteState> {
  try {
    const roomId = String(formData.get('room_id') ?? '').trim();
    const invitedEmailRaw = String(formData.get('invited_email') ?? '').trim();
    const invitedEmail = invitedEmailRaw ? invitedEmailRaw.toLowerCase() : null;
    const isLeaderInvite = String(formData.get('is_leader_invite') ?? '').trim() === 'true';

    const token = await createRoomInviteInternal(roomId, { isLeaderInvite, invitedEmail });
    return { token, error: null };
  } catch (e) {
    return { token: null, error: getErrorMessage(e) };
  }
}

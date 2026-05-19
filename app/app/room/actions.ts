'use server';

import crypto from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth/server';
import { getActiveMembershipForCurrentUser } from '@/lib/room/server';
import { getErrorMessage } from '@/lib/flash';

function sha256Hex(input: string) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

type InviteState = { token: string | null; error: string | null };

export async function createInvite(_prevState: InviteState, formData: FormData): Promise<InviteState> {
  try {
    const { supabase, user } = await requireUser();
    const membership = await getActiveMembershipForCurrentUser();

    if (!membership?.isLeader) {
      return { token: null, error: 'Only the room leader can create invites' };
    }

    const invitedEmailRaw = String(formData.get('invited_email') ?? '').trim();
    const invitedEmail = invitedEmailRaw ? invitedEmailRaw.toLowerCase() : null;

    const token = crypto.randomBytes(24).toString('base64url');
    const tokenHash = sha256Hex(token);

    const { data: invite, error } = await supabase
      .from('room_invites')
      .insert({
        room_id: membership.roomId,
        token_hash: tokenHash,
        expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString(),
        max_uses: 10,
        created_by: user.id,
        invited_email: invitedEmail,
        is_leader_invite: false,
      })
      .select('id')
      .single();

    if (error) return { token: null, error: error.message };

    await supabase.from('audit_events').insert({
      actor_id: user.id,
      room_id: membership.roomId,
      entity_type: 'invite',
      entity_id: invite.id,
      action: invitedEmail ? 'created_for_email' : 'created',
      before: null,
      after: { room_id: membership.roomId, invite_id: invite.id, invited_email: invitedEmail },
    });

    revalidatePath('/app/room');
    return { token, error: null };
  } catch (e) {
    return { token: null, error: getErrorMessage(e) };
  }
}

export async function removeMember(formData: FormData) {
  const { supabase, user } = await requireUser();
  const membership = await getActiveMembershipForCurrentUser();

  if (!membership?.isLeader) {
    redirect(`/app/room?error=${encodeURIComponent('Only the room leader can remove members')}`);
  }

  try {

  const membershipId = String(formData.get('membership_id') ?? '').trim();
  if (!membershipId) throw new Error('Missing membership id');

  const { data: before } = await supabase
    .from('room_memberships')
    .select('id, tenant_id, room_id, is_leader, left_at')
    .eq('id', membershipId)
    .maybeSingle();

  const { error } = await supabase
    .from('room_memberships')
    .update({ left_at: new Date().toISOString(), is_leader: false })
    .eq('id', membershipId)
    .eq('room_id', membership.roomId);

  if (error) throw new Error(error.message);

  await supabase.from('audit_events').insert({
    actor_id: user.id,
    room_id: membership.roomId,
    entity_type: 'room_membership',
    entity_id: membershipId,
    action: 'removed',
    before,
    after: { left_at: new Date().toISOString() },
  });

  revalidatePath('/app/room');

  } catch (e) {
    redirect(`/app/room?error=${encodeURIComponent(getErrorMessage(e))}`);
  }
}

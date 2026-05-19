'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/auth/server';
import { getErrorMessage } from '@/lib/flash';

export async function assignTenantToRoom(formData: FormData) {
  const { supabase, user } = await requireAdmin();

  try {

  const tenantId = String(formData.get('tenant_id') ?? '').trim();
  const roomId = String(formData.get('room_id') ?? '').trim();

  if (!tenantId) throw new Error('Missing tenant id');
  if (!roomId) throw new Error('Missing room id');

  const { data: membership, error } = await supabase
    .from('room_memberships')
    .insert({
      tenant_id: tenantId,
      room_id: roomId,
      is_leader: false,
    })
    .select('id')
    .single();

  if (error) throw new Error(error.message);

  await supabase.from('audit_events').insert({
    actor_id: user.id,
    room_id: roomId,
    entity_type: 'room_membership',
    entity_id: membership.id,
    action: 'assigned',
    before: null,
    after: { tenant_id: tenantId, room_id: roomId, membership_id: membership.id },
  });

  revalidatePath('/admin/tenants');

  } catch (e) {
    redirect(`/admin/tenants?error=${encodeURIComponent(getErrorMessage(e))}`);
  }
}

export async function removeTenantFromRoom(formData: FormData) {
  const { supabase, user } = await requireAdmin();

  try {

  const membershipId = String(formData.get('membership_id') ?? '').trim();
  const roomId = String(formData.get('room_id') ?? '').trim();

  if (!membershipId) throw new Error('Missing membership id');
  if (!roomId) throw new Error('Missing room id');

  const { data: before } = await supabase
    .from('room_memberships')
    .select('id, tenant_id, room_id, is_leader, left_at')
    .eq('id', membershipId)
    .maybeSingle();

  const { error } = await supabase
    .from('room_memberships')
    .update({ left_at: new Date().toISOString(), is_leader: false })
    .eq('id', membershipId);

  if (error) throw new Error(error.message);

  await supabase.from('audit_events').insert({
    actor_id: user.id,
    room_id: roomId,
    entity_type: 'room_membership',
    entity_id: membershipId,
    action: 'removed_by_admin',
    before,
    after: { left_at: new Date().toISOString() },
  });

  revalidatePath('/admin/tenants');

  } catch (e) {
    redirect(`/admin/tenants?error=${encodeURIComponent(getErrorMessage(e))}`);
  }
}

export async function setRoomLeader(formData: FormData) {
  const { supabase, user } = await requireAdmin();

  try {

  const membershipId = String(formData.get('membership_id') ?? '').trim();
  const roomId = String(formData.get('room_id') ?? '').trim();

  if (!membershipId) throw new Error('Missing membership id');
  if (!roomId) throw new Error('Missing room id');

  // Clear existing leader(s)
  await supabase
    .from('room_memberships')
    .update({ is_leader: false })
    .eq('room_id', roomId)
    .is('left_at', null);

  // Set new leader
  const { error } = await supabase
    .from('room_memberships')
    .update({ is_leader: true })
    .eq('id', membershipId)
    .eq('room_id', roomId)
    .is('left_at', null);

  if (error) throw new Error(error.message);

  await supabase.from('audit_events').insert({
    actor_id: user.id,
    room_id: roomId,
    entity_type: 'room_membership',
    entity_id: membershipId,
    action: 'leader_set',
    before: null,
    after: { membership_id: membershipId, room_id: roomId },
  });

  revalidatePath('/admin/tenants');

  } catch (e) {
    redirect(`/admin/tenants?error=${encodeURIComponent(getErrorMessage(e))}`);
  }
}

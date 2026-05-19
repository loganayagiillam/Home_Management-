import { requireUser } from '@/lib/auth/server';
import type { SupabaseClient } from '@supabase/supabase-js';

export type ActiveMembership = {
  roomId: string;
  isLeader: boolean;
};

export async function getActiveMembershipForCurrentUser(
  supabaseClient?: SupabaseClient,
  userId?: string,
): Promise<ActiveMembership | null> {
  let supabase = supabaseClient;
  let uid = userId;

  if (!supabase || !uid) {
    const auth = await requireUser();
    supabase = auth.supabase;
    uid = auth.user.id;
  }

  const { data, error } = await supabase
    .from('room_memberships')
    .select('room_id, is_leader')
    .eq('tenant_id', uid)
    .is('left_at', null)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  return {
    roomId: data.room_id,
    isLeader: data.is_leader,
  };
}

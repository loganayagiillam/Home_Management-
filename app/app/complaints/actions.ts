'use server';

import { requireUser } from '@/lib/auth/server';
import { getActiveMembershipForCurrentUser } from '@/lib/room/server';
import { redirect } from 'next/navigation';
import { encodeSearchParam } from '@/lib/flash';

export async function submitComplaint(formData: FormData) {
  const { supabase, user } = await requireUser();
  const membership = await getActiveMembershipForCurrentUser(supabase, user.id);

  if (!membership) {
    redirect(`/app/complaints?error=${encodeSearchParam('You are not assigned to a room.')}`);
  }

  const issue = formData.get('issue')?.toString().trim() ?? '';

  if (!issue) {
    redirect(`/app/complaints?error=${encodeSearchParam('Issue is required.')}`);
  }

  const { error } = await supabase.from('complaints').insert({
    room_id: membership.roomId,
    tenant_id: user.id,
    issue,
    status: 'open',
  });

  if (error) {
    redirect(`/app/complaints?error=${encodeSearchParam(error.message)}`);
  }

  redirect('/app/complaints');
}

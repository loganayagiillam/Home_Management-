'use server';

import { requireAdmin } from '@/lib/auth/server';
import { redirect } from 'next/navigation';
import { encodeSearchParam } from '@/lib/flash';

export async function updateComplaintStatus(formData: FormData) {
  const { supabase } = await requireAdmin();

  const id = formData.get('id')?.toString() ?? '';
  const status = formData.get('status')?.toString() ?? '';

  if (!id || !status) {
    redirect(`/admin/complaints?error=${encodeSearchParam('Missing fields.')}`);
  }
  
  if (!['open', 'in_progress', 'closed'].includes(status)) {
    redirect(`/admin/complaints?error=${encodeSearchParam('Invalid status.')}`);
  }

  const { error } = await supabase
    .from('complaints')
    .update({ status })
    .eq('id', id);

  if (error) {
    redirect(`/admin/complaints?error=${encodeSearchParam(error.message)}`);
  }

  redirect('/admin/complaints');
}

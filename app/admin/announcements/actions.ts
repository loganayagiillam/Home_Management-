'use server';

import { requireAdmin } from '@/lib/auth/server';
import { redirect } from 'next/navigation';
import { encodeSearchParam } from '@/lib/flash';

export async function createAnnouncement(formData: FormData) {
  const { supabase, user } = await requireAdmin();

  const title = formData.get('title')?.toString().trim() ?? '';
  const message = formData.get('message')?.toString().trim() ?? '';
  const room_id = formData.get('room_id')?.toString() || null;

  if (!title || !message) {
    redirect(`/admin/announcements?error=${encodeSearchParam('Title and message are required.')}`);
  }

  const { error } = await supabase.from('announcements').insert({
    title,
    message,
    room_id: room_id || null,
    created_by: user.id,
  });

  if (error) {
    redirect(`/admin/announcements?error=${encodeSearchParam(error.message)}`);
  }

  redirect('/admin/announcements');
}

export async function deleteAnnouncement(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = formData.get('id')?.toString() ?? '';

  if (!id) {
    redirect(`/admin/announcements?error=${encodeSearchParam('Missing announcement ID.')}`);
  }

  const { error } = await supabase.from('announcements').delete().eq('id', id);

  if (error) {
    redirect(`/admin/announcements?error=${encodeSearchParam(error.message)}`);
  }

  redirect('/admin/announcements');
}

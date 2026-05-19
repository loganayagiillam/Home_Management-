'use server';

import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';

function safeNextPath(nextValue: unknown) {
  if (typeof nextValue !== 'string') return '/';
  if (!nextValue.startsWith('/')) return '/';
  return nextValue;
}

export async function signIn(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const nextPath = safeNextPath(formData.get('next'));

  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect(`/login?error=${encodeURIComponent('Missing Supabase env config')}&next=${encodeURIComponent(nextPath)}`);

  const { error } = await supabase!.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}&next=${encodeURIComponent(nextPath)}`);
  }

  redirect(nextPath);
}

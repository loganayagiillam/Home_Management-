'use server';

import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';

function safeNextPath(nextValue: unknown) {
  if (typeof nextValue !== 'string') return '/';
  if (!nextValue.startsWith('/')) return '/';
  return nextValue;
}

export async function signUp(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const fullName = String(formData.get('full_name') ?? '').trim();
  const phone = String(formData.get('phone') ?? '').trim();
  const nextPath = safeNextPath(formData.get('next'));

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    redirect(`/signup?error=${encodeURIComponent('Missing Supabase env config')}&next=${encodeURIComponent(nextPath)}`);
  }

  const { data, error } = await supabase!.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        phone,
      },
    },
  });

  if (error) {
    redirect(`/signup?error=${encodeURIComponent(error.message)}&next=${encodeURIComponent(nextPath)}`);
  }

  // If email confirmations are enabled, session may be null.
  if (!data.session) {
    redirect(`/login?error=${encodeURIComponent('Check your email to confirm your account, then login.')}&next=${encodeURIComponent(nextPath)}`);
  }

  redirect(nextPath);
}

import { redirect } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { SupabaseClient } from '@supabase/supabase-js';

type AuthResult = {
  supabase: SupabaseClient;
  user: User;
};

export async function requireUser(): Promise<AuthResult> {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    redirect('/login');
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  return { supabase, user } as AuthResult;
}

export async function getProfileRole(userId: string, supabase: SupabaseClient) {
  const { data } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle();

  return data?.role ?? null;
}

export async function requireAdmin(): Promise<AuthResult> {
  const { supabase, user } = await requireUser();
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (profile?.role !== 'admin') {
    redirect('/app');
  }

  return { supabase, user };
}

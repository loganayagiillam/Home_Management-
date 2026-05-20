import { redirect } from 'next/navigation';
import { createSupabaseServerClientReadonly } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const supabase = await createSupabaseServerClientReadonly();

  if (!supabase) {
    redirect('/login');
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (profile?.role === 'admin') {
    redirect('/admin');
  }

  redirect('/app');
}

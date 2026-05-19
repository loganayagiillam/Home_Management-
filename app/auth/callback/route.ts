import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const nextPath = url.searchParams.get('next');

  if (code) {
    const supabase = await createSupabaseServerClient();
    if (!supabase) {
      return NextResponse.redirect(new URL('/login', url.origin));
    }
    await supabase.auth.exchangeCodeForSession(code);
  }

  if (nextPath && nextPath.startsWith('/')) {
    return NextResponse.redirect(new URL(nextPath, url.origin));
  }

  return NextResponse.redirect(new URL('/', url.origin));
}

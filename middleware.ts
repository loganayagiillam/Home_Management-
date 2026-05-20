import { createServerClient } from '@supabase/ssr';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

function safeNextPath(nextValue: string | null) {
  if (!nextValue) return null;
  if (!nextValue.startsWith('/')) return null;
  return nextValue;
}

export async function middleware(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const pathname = request.nextUrl.pathname;
  const isProtected = pathname.startsWith('/admin') || pathname.startsWith('/app');

  if (!supabaseUrl || !supabaseAnonKey) {
    // Fail closed for protected paths in production if Supabase env is missing.
    if (isProtected && process.env.NODE_ENV === 'production') {
      return new NextResponse('Server misconfigured: missing Supabase env vars', { status: 500 });
    }
    return NextResponse.next();
  }

  const pendingCookies: Array<{ name: string; value: string; options: Parameters<NextResponse['cookies']['set']>[2] }> = [];

  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  function applyPendingCookies(res: NextResponse) {
    for (const c of pendingCookies) {
      res.cookies.set(c.name, c.value, c.options);
    }
  }

  function redirectWithCookies(url: URL) {
    const res = NextResponse.redirect(url);
    applyPendingCookies(res);
    return res;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
          pendingCookies.push({ name, value, options });
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && isProtected) {
    const url = new URL('/login', request.url);
    url.searchParams.set('next', `${request.nextUrl.pathname}${request.nextUrl.search}`);
    return redirectWithCookies(url);
  }

  if (user && pathname === '/login') {
    const nextParam = safeNextPath(request.nextUrl.searchParams.get('next'));
    return redirectWithCookies(new URL(nextParam ?? '/', request.url));
  }

  if (user && pathname === '/signup') {
    const nextParam = safeNextPath(request.nextUrl.searchParams.get('next'));
    return redirectWithCookies(new URL(nextParam ?? '/', request.url));
  }

  // Tenant onboarding gate: require personal details + Aadhaar proof upload
  // before allowing access to tenant app pages.
  if (user && pathname.startsWith('/app')) {
    const isOnboarding = pathname === '/app/onboarding' || pathname.startsWith('/app/onboarding/');

    if (!isOnboarding) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, full_name, phone')
        .eq('id', user.id)
        .maybeSingle();

      // Only gate tenants; admins can still access /admin.
      if (profile?.role === 'tenant') {
        const { data: kyc } = await supabase
          .from('tenant_kyc')
          .select('aadhaar_last4, aadhaar_file_path, photo_file_path, completed_at')
          .eq('tenant_id', user.id)
          .maybeSingle();

        const isComplete = Boolean(
          (profile?.full_name ?? '').trim() &&
            (profile?.phone ?? '').trim() &&
            (kyc?.aadhaar_last4 ?? '').trim() &&
            (kyc?.aadhaar_file_path ?? '').trim() &&
            (kyc?.photo_file_path ?? '').trim() &&
            kyc?.completed_at,
        );

        if (!isComplete) {
          const url = new URL('/app/onboarding', request.url);
          url.searchParams.set('next', `${request.nextUrl.pathname}${request.nextUrl.search}`);
          return redirectWithCookies(url);
        }
      }
    }
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};

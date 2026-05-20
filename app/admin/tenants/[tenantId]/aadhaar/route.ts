import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

async function requireAdminForRoute() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { supabase: null, user: null, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase: null, user: null, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (profile?.role !== 'admin') {
    return { supabase: null, user: null, error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  return { supabase, user, error: null };
}

export async function GET(_req: Request, ctx: { params: Promise<{ tenantId: string }> }) {
  const { supabase, error } = await requireAdminForRoute();
  if (error || !supabase) return error;

  const { tenantId } = await ctx.params;

  const { data: kyc } = await supabase
    .from('tenant_kyc')
    .select('aadhaar_file_path')
    .eq('tenant_id', tenantId)
    .maybeSingle();

  const path = (kyc?.aadhaar_file_path ?? '').trim();
  if (!path) {
    return NextResponse.json({ error: 'Aadhaar not uploaded' }, { status: 404 });
  }

  const { data, error: signedError } = await supabase.storage.from('tenant-proofs').createSignedUrl(path, 60);
  if (signedError || !data?.signedUrl) {
    return NextResponse.json({ error: signedError?.message ?? 'Failed to create download link' }, { status: 500 });
  }

  const res = NextResponse.redirect(data.signedUrl);
  res.headers.set('Cache-Control', 'no-store');
  res.headers.set('X-Robots-Tag', 'noindex, nofollow');
  return res;
}

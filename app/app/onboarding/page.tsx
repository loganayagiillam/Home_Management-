import type { Metadata } from 'next';
import { requireUser } from '@/lib/auth/server';
import { Card } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page';
import { completeOnboarding } from './actions';
import { decodeSearchParam, resolveSearchParams } from '@/lib/flash';

export const metadata: Metadata = { title: 'Complete Profile' };
export const dynamic = 'force-dynamic';

function safeNextPath(nextValue: unknown) {
  if (typeof nextValue !== 'string') return '/app';
  if (!nextValue.startsWith('/')) return '/app';
  if (nextValue.startsWith('/app/onboarding')) return '/app';
  return nextValue;
}

type KycRow = {
  tenant_id: string;
  date_of_birth: string | null;
  address: string | null;
  aadhaar_last4: string | null;
  aadhaar_file_path: string | null;
  photo_file_path: string | null;
  completed_at: string | null;
};

export default async function TenantOnboardingPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string; success?: string; next?: string }> | { error?: string; success?: string; next?: string };
}) {
  const { supabase, user } = await requireUser();

  const sp = await resolveSearchParams(searchParams);
  const flashError = decodeSearchParam(sp?.error);
  const flashSuccess = decodeSearchParam(sp?.success);
  const nextPath = safeNextPath(sp?.next);

  const [{ data: profile }, { data: kyc }] = await Promise.all([
    supabase.from('profiles').select('full_name, phone').eq('id', user.id).maybeSingle(),
    supabase
      .from('tenant_kyc')
      .select('tenant_id, date_of_birth, address, aadhaar_last4, aadhaar_file_path, photo_file_path, completed_at')
      .eq('tenant_id', user.id)
      .maybeSingle(),
  ]);

  const profileRow = profile as { full_name: string | null; phone: string | null } | null;
  const kycRow = kyc as KycRow | null;

  const isComplete = Boolean(
    (profileRow?.full_name ?? '').trim() &&
      (profileRow?.phone ?? '').trim() &&
      (kycRow?.aadhaar_last4 ?? '').trim() &&
      (kycRow?.aadhaar_file_path ?? '').trim() &&
      (kycRow?.photo_file_path ?? '').trim() &&
      kycRow?.completed_at,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Complete your profile"
        description="For security, please fill your personal details, upload Aadhaar proof (PDF), and upload a profile photo."
      />

      {flashError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{flashError}</div>
      ) : null}

      {flashSuccess ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">{flashSuccess}</div>
      ) : null}

      {isComplete ? (
        <Card className="space-y-2">
          <div className="text-sm font-semibold text-slate-900">Profile already completed</div>
          <div className="text-xs text-slate-600">You can continue using the app.</div>
          <div className="pt-2">
            <a className="text-sm font-medium text-indigo-600 hover:underline" href={nextPath}>
              Continue
            </a>
          </div>
        </Card>
      ) : (
        <Card className="space-y-4">
          <div>
            <div className="text-sm font-semibold text-slate-900">Step 1: Personal details</div>
            <div className="mt-1 text-xs text-slate-600">Use your real details. Aadhaar number is not stored — only last 4 digits.</div>
          </div>

          <form action={completeOnboarding} className="space-y-4">
            <input type="hidden" name="next" value={nextPath} />

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Full name">
                <Input name="full_name" defaultValue={profileRow?.full_name ?? ''} placeholder="Your full name" required maxLength={80} />
              </Field>

              <Field label="Phone number">
                <Input name="phone" defaultValue={profileRow?.phone ?? ''} placeholder="10-digit mobile" required maxLength={20} />
              </Field>

              <Field label="Date of birth">
                <Input name="date_of_birth" type="date" defaultValue={kycRow?.date_of_birth ?? ''} />
              </Field>

              <Field label="Address">
                <Input name="address" defaultValue={kycRow?.address ?? ''} placeholder="Current address" maxLength={200} />
              </Field>
            </div>

            <div className="pt-2">
              <div className="text-sm font-semibold text-slate-900">Step 2: Aadhaar proof (PDF)</div>
              <div className="mt-1 text-xs text-slate-600">Upload Aadhaar PDF only. Keep it clear and readable.</div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Aadhaar last 4 digits">
                <Input
                  name="aadhaar_last4"
                  inputMode="numeric"
                  pattern="[0-9]{4}"
                  placeholder="1234"
                  required
                  maxLength={4}
                  defaultValue={kycRow?.aadhaar_last4 ?? ''}
                />
              </Field>

              <Field label="Aadhaar PDF">
                <Input name="aadhaar_pdf" type="file" accept="application/pdf" required={!kycRow?.aadhaar_file_path} />
              </Field>
            </div>

            <div className="pt-2">
              <div className="text-sm font-semibold text-slate-900">Step 3: Profile photo</div>
              <div className="mt-1 text-xs text-slate-600">Upload a clear face photo (JPG/PNG/WebP).</div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Photo">
                <Input name="photo" type="file" accept="image/png,image/jpeg,image/webp" required={!kycRow?.photo_file_path} />
              </Field>
            </div>

            <div className="flex justify-end">
              <Button type="submit">Save and continue</Button>
            </div>
          </form>
        </Card>
      )}
    </div>
  );
}

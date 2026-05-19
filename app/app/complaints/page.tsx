import { requireUser } from '@/lib/auth/server';
import { getActiveMembershipForCurrentUser } from '@/lib/room/server';
import { submitComplaint } from './actions';
import type { Metadata } from 'next';
import { PageHeader } from '@/components/ui/page';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { decodeSearchParam, resolveSearchParams } from '@/lib/flash';

export const metadata: Metadata = { title: 'Complaints' };
export const dynamic = 'force-dynamic';

const statusColor: Record<string, string> = {
  open: 'badge-red',
  in_progress: 'badge-amber',
  closed: 'badge-slate',
};

export default async function TenantComplaintsPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string; success?: string }> | { error?: string; success?: string };
}) {
  const { supabase, user } = await requireUser();
  const membership = await getActiveMembershipForCurrentUser(supabase, user.id);

  const sp = await resolveSearchParams(searchParams);
  const flashError = decodeSearchParam(sp?.error);
  const flashSuccess = decodeSearchParam(sp?.success);

  // Fetch existing complaints for this tenant
  const { data: complaints } = membership
    ? await supabase
        .from('complaints')
        .select('id, issue, status, created_at')
        .eq('tenant_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20)
    : { data: [] };

  const complaintsSafe = complaints ?? [];

  return (
    <div className="space-y-6">
      <PageHeader title="Complaints" description="Submit and track your maintenance requests." />

      {flashError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{flashError}</div>
      )}
      {flashSuccess && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">{flashSuccess}</div>
      )}

      {!membership ? (
        <Card>
          <div className="text-sm text-slate-600">You need to be assigned to a room before submitting complaints.</div>
        </Card>
      ) : (
        <Card className="space-y-4">
          <h2 className="text-sm font-semibold text-slate-900">Submit a new complaint</h2>
          <form action={submitComplaint} className="space-y-4">
            <Field label="Issue">
              <textarea
                name="issue"
                className="input min-h-[100px] resize-y"
                placeholder="Describe the issue in detail…"
                required
                maxLength={1000}
              />
            </Field>
            <div className="flex justify-end">
              <Button type="submit">Submit complaint</Button>
            </div>
          </form>
        </Card>
      )}

      {/* Complaint History */}
      <div>
        <h2 className="text-sm font-semibold text-slate-700 mb-3">
          Your complaints ({complaintsSafe.length})
        </h2>
        {complaintsSafe.length === 0 ? (
          <Card>
            <div className="py-6 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50 mx-auto mb-3">
                <svg className="h-6 w-6 text-violet-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                </svg>
              </div>
              <p className="text-sm text-slate-500">No complaints submitted yet.</p>
            </div>
          </Card>
        ) : (
          <div className="space-y-3">
            {complaintsSafe.map((c: { id: string; issue: string; status: string; created_at: string }) => (
              <Card key={c.id} className="space-y-2">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-xs text-slate-500">{new Date(c.created_at).toLocaleDateString('en-IN')}</div>
                  </div>
                  <span className={statusColor[c.status] ?? 'badge-slate'}>{c.status.replace('_', ' ')}</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">{c.issue}</p>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

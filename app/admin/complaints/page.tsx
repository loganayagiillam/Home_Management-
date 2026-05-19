import { requireUser } from '@/lib/auth/server';
import { updateComplaintStatus } from './actions';
import type { Metadata } from 'next';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Field } from '@/components/ui/field';
import { decodeSearchParam, resolveSearchParams } from '@/lib/flash';

export const metadata: Metadata = { title: 'Complaints' };
export const dynamic = 'force-dynamic';

const statusColor: Record<string, string> = {
  open: 'badge-red',
  in_progress: 'badge-amber',
  closed: 'badge-slate',
};

type ComplaintRow = {
  id: string;
  issue: string;
  status: string;
  created_at: string;
  room_id: string | null;
  tenant_id: string;
  profiles?: { full_name: string | null; phone: string | null } | { full_name: string | null; phone: string | null }[] | null;
  rooms?: { room_number: string } | { room_number: string }[] | null;
};

function firstEmbed<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

export default async function AdminComplaintsPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }> | { error?: string };
}) {
  const { supabase } = await requireUser();

  const sp = await resolveSearchParams(searchParams);
  const flashError = decodeSearchParam(sp?.error);

  const { data: complaints } = await supabase
    .from('complaints')
    .select('id, issue, status, created_at, room_id, tenant_id, profiles(full_name, phone), rooms(room_number)')
    .order('created_at', { ascending: false })
    .limit(50);

  const complaintsSafe = (complaints ?? []) as unknown as ComplaintRow[];

  const openCount = complaintsSafe.filter((c) => c.status === 'open').length;
  const inProgressCount = complaintsSafe.filter((c) => c.status === 'in_progress').length;
  const closedCount = complaintsSafe.filter((c) => c.status === 'closed').length;

  return (
    <div className="animate-fade-in space-y-6">
      <div className="page-header">
        <h1 className="page-title">Complaints</h1>
        <p className="page-subtitle">Review and resolve tenant-submitted complaints.</p>
      </div>

      {flashError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{flashError}</div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="stat-card border-l-4 border-l-red-400">
          <div className="stat-label">Open</div>
          <div className="stat-value text-red-600">{openCount}</div>
        </div>
        <div className="stat-card border-l-4 border-l-amber-400">
          <div className="stat-label">In Progress</div>
          <div className="stat-value text-amber-600">{inProgressCount}</div>
        </div>
        <div className="stat-card border-l-4 border-l-emerald-400">
          <div className="stat-label">Closed</div>
          <div className="stat-value text-emerald-600">{closedCount}</div>
        </div>
      </div>

      {complaintsSafe.length === 0 ? (
        <Card>
          <div className="py-8 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 mx-auto mb-3">
              <svg className="h-6 w-6 text-emerald-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <p className="text-sm text-slate-500">No complaints yet — all clear!</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {complaintsSafe.map((c) => {
            const profile = firstEmbed(c.profiles);
            const room = firstEmbed(c.rooms);
            const tenantName = profile?.full_name?.trim() || profile?.phone?.trim() || 'Unknown Tenant';
            const roomNum = room?.room_number ?? '—';

            return (
              <Card key={c.id} className="space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">Complaint</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {tenantName} · Room {roomNum} · {new Date(c.created_at).toLocaleDateString('en-IN')}
                    </div>
                  </div>
                  <span className={statusColor[c.status] ?? 'badge-slate'}>{c.status.replace('_', ' ')}</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">{c.issue}</p>
                <form action={updateComplaintStatus} className="flex flex-wrap items-end gap-3 border-t border-slate-100 pt-3">
                  <input type="hidden" name="id" value={c.id} />
                  <Field label="Update status">
                    <Select name="status" defaultValue={c.status}>
                      <option value="open">Open</option>
                      <option value="in_progress">In Progress</option>
                      <option value="closed">Closed</option>
                    </Select>
                  </Field>
                  <Button variant="secondary" type="submit">Update</Button>
                </form>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

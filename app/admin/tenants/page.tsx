import { requireAdmin } from '@/lib/auth/server';
import {
  assignTenantToRoom,
  removeTenantFromRoom,
  setRoomLeader,
} from './actions';
import type { Metadata } from 'next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page';
import { Select } from '@/components/ui/select';
import { decodeSearchParam, resolveSearchParams } from '@/lib/flash';

export const metadata: Metadata = { title: 'Tenants' };
export const dynamic = 'force-dynamic';

type TenantRow = {
  id: string;
  full_name: string | null;
  phone: string | null;
};

type RoomRow = {
  id: string;
  room_number: string;
};

type MembershipRow = {
  id: string;
  tenant_id: string;
  room_id: string;
  is_leader: boolean;
  rooms?: { room_number: string }[] | null;
};

export default async function AdminTenantsPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }> | { error?: string };
}) {
  const { supabase } = await requireAdmin();

  const sp = await resolveSearchParams(searchParams);
  const flashError = decodeSearchParam(sp?.error);

  const [{ data: rooms }, { data: tenants }, { data: memberships }] = await Promise.all([
    supabase
      .from('rooms')
      .select('id, room_number')
      .order('room_number', { ascending: true }),
    supabase
      .from('profiles')
      .select('id, full_name, phone')
      .eq('role', 'tenant')
      .order('created_at', { ascending: false }),
    supabase
      .from('room_memberships')
      .select('id, tenant_id, room_id, is_leader, rooms(room_number)')
      .is('left_at', null),
  ]);

  const roomsSafe = (rooms ?? []) as RoomRow[];
  const tenantsSafe = (tenants ?? []) as TenantRow[];
  const membershipsSafe = (memberships ?? []) as MembershipRow[];

  const membershipByTenantId = new Map<string, MembershipRow>();
  for (const m of membershipsSafe) membershipByTenantId.set(m.tenant_id, m);

  const tenantIds = tenantsSafe.map((t) => t.id);
  const { data: kycRows } = tenantIds.length
    ? await supabase
        .from('tenant_kyc')
        .select('tenant_id, completed_at')
        .in('tenant_id', tenantIds)
    : { data: [] as { tenant_id: string; completed_at: string | null }[] };

  const kycByTenantId = new Map<string, { completed_at: string | null }>();
  for (const row of (kycRows ?? []) as { tenant_id: string; completed_at: string | null }[]) {
    kycByTenantId.set(row.tenant_id, { completed_at: row.completed_at });
  }

  const assignedCount = membershipsSafe.length;
  const unassignedCount = Math.max(0, tenantsSafe.length - assignedCount);

  return (
    <div className="space-y-6">
      <PageHeader title="Tenants" description="Assign tenants to rooms and designate room leaders." />

      {flashError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{flashError}</div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Badge>{tenantsSafe.length} total</Badge>
        <Badge>{assignedCount} assigned</Badge>
        <Badge>{unassignedCount} unassigned</Badge>
      </div>

      {tenantsSafe.length === 0 ? (
        <Card>
          <div className="text-sm text-slate-600">No tenant profiles yet.</div>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {tenantsSafe.map((t) => {
            const membership = membershipByTenantId.get(t.id);
            const roomNumber = membership?.rooms?.[0]?.room_number ?? null;
            const kyc = kycByTenantId.get(t.id) ?? null;
            const isProfileComplete = Boolean((t.full_name ?? '').trim() && (t.phone ?? '').trim() && kyc?.completed_at);

            return (
              <Card key={t.id} className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{t.full_name || 'Tenant'}</div>
                    <div className="mt-1 truncate text-xs text-slate-600">{t.phone || t.id}</div>
                  </div>
                  <div className="shrink-0">
                    {membership?.is_leader ? <Badge>leader</Badge> : null}
                    {!isProfileComplete ? <Badge>profile incomplete</Badge> : null}
                  </div>
                </div>

                <div>
                  {membership ? (
                    <Badge>Room {roomNumber || membership.room_id.slice(0, 8)}</Badge>
                  ) : (
                    <Badge>unassigned</Badge>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                  {!membership ? (
                    <form action={assignTenantToRoom} className="flex w-full flex-wrap gap-2">
                      <input type="hidden" name="tenant_id" value={t.id} />
                      <Select name="room_id" defaultValue="" required className="flex-1">
                        <option value="" disabled>
                          Select room
                        </option>
                        {roomsSafe.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.room_number}
                          </option>
                        ))}
                      </Select>
                      <Button type="submit">Assign</Button>
                    </form>
                  ) : (
                    <>
                      {!membership.is_leader ? (
                        <form action={setRoomLeader}>
                          <input type="hidden" name="membership_id" value={membership.id} />
                          <input type="hidden" name="room_id" value={membership.room_id} />
                          <Button variant="secondary" type="submit">
                            Set leader
                          </Button>
                        </form>
                      ) : null}

                      <form action={removeTenantFromRoom}>
                        <input type="hidden" name="membership_id" value={membership.id} />
                        <input type="hidden" name="room_id" value={membership.room_id} />
                        <Button variant="secondary" type="submit">
                          Remove
                        </Button>
                      </form>
                    </>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

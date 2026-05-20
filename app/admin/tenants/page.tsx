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
import Link from 'next/link';

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

type KycMiniRow = {
  tenant_id: string;
  completed_at: string | null;
  aadhaar_file_path?: string | null;
  photo_file_path?: string | null;
};

type PastMembershipRow = {
  id: string;
  tenant_id: string;
  room_id: string;
  is_leader: boolean;
  joined_at: string;
  left_at: string;
  created_at: string;
  profiles?: { full_name: string | null; phone: string | null } | { full_name: string | null; phone: string | null }[] | null;
  rooms?: { room_number: string }[] | null;
};

type AuditRow = {
  entity_id: string;
  action: string;
  created_at: string;
  profiles?: { full_name: string | null; phone: string | null } | { full_name: string | null; phone: string | null }[] | null;
};

function firstEmbed<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function fmtDateTime(iso: string | null | undefined) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-IN');
  } catch {
    return iso;
  }
}

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
        .select('tenant_id, completed_at, aadhaar_file_path, photo_file_path')
        .in('tenant_id', tenantIds)
    : { data: [] as KycMiniRow[] };

  const kycByTenantId = new Map<string, KycMiniRow>();
  for (const row of (kycRows ?? []) as unknown as KycMiniRow[]) {
    kycByTenantId.set(row.tenant_id, row);
  }

  const assignedCount = membershipsSafe.length;
  const unassignedCount = Math.max(0, tenantsSafe.length - assignedCount);

  const assignedTenants = tenantsSafe.filter((t) => membershipByTenantId.has(t.id));
  const unassignedTenants = tenantsSafe.filter((t) => !membershipByTenantId.has(t.id));

  const { data: pastMemberships } = await supabase
    .from('room_memberships')
    .select('id, tenant_id, room_id, is_leader, joined_at, left_at, created_at, profiles(full_name, phone), rooms(room_number)')
    .not('left_at', 'is', null)
    .order('left_at', { ascending: false })
    .limit(50);

  const pastSafe = (pastMemberships ?? []) as unknown as PastMembershipRow[];
  const pastIds = pastSafe.map((m) => m.id);
  const { data: audits } = pastIds.length
    ? await supabase
        .from('audit_events')
        .select('entity_id, action, created_at, profiles(full_name, phone)')
        .eq('entity_type', 'room_membership')
        .in('entity_id', pastIds)
        .in('action', ['assigned', 'invite_accepted'])
    : { data: [] as AuditRow[] };

  const auditByEntityId = new Map<string, AuditRow>();
  for (const a of (audits ?? []) as unknown as AuditRow[]) {
    const existing = auditByEntityId.get(a.entity_id);
    if (!existing || new Date(a.created_at).getTime() < new Date(existing.created_at).getTime()) {
      auditByEntityId.set(a.entity_id, a);
    }
  }

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
        <div className="space-y-8">
          <div>
            <h2 className="text-sm font-semibold text-slate-700 mb-3">Assigned ({assignedTenants.length})</h2>
            {assignedTenants.length === 0 ? (
              <Card>
                <div className="text-sm text-slate-600">No assigned tenants.</div>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {assignedTenants.map((t) => {
                  const membership = membershipByTenantId.get(t.id);
                  const roomNumber = membership?.rooms?.[0]?.room_number ?? null;
                  const kyc = kycByTenantId.get(t.id) ?? null;
                  const isProfileComplete = Boolean(
                    (t.full_name ?? '').trim() &&
                      (t.phone ?? '').trim() &&
                      (kyc?.aadhaar_file_path ?? '').trim() &&
                      (kyc?.photo_file_path ?? '').trim() &&
                      kyc?.completed_at,
                  );

                  return (
                    <Card key={t.id} className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <Link
                            href={`/admin/tenants/${t.id}`}
                            className="truncate text-sm font-semibold text-indigo-700 hover:text-indigo-800 hover:underline"
                          >
                            {t.full_name || 'Tenant'}
                          </Link>
                          <div className="mt-1 truncate text-xs text-slate-600">{t.phone || t.id}</div>
                        </div>
                        <div className="shrink-0">
                          {membership?.is_leader ? <Badge>leader</Badge> : null}
                          {!isProfileComplete ? <Badge>profile incomplete</Badge> : null}
                        </div>
                      </div>

                      <div>
                        {membership ? <Badge>Room {roomNumber || membership.room_id.slice(0, 8)}</Badge> : <Badge>unassigned</Badge>}
                      </div>

                      {membership ? (
                        <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
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
                        </div>
                      ) : null}
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <h2 className="text-sm font-semibold text-slate-700 mb-3">Unassigned ({unassignedTenants.length})</h2>
            {unassignedTenants.length === 0 ? (
              <Card>
                <div className="text-sm text-slate-600">No unassigned tenants.</div>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {unassignedTenants.map((t) => {
                  const kyc = kycByTenantId.get(t.id) ?? null;
                  const isProfileComplete = Boolean(
                    (t.full_name ?? '').trim() &&
                      (t.phone ?? '').trim() &&
                      (kyc?.aadhaar_file_path ?? '').trim() &&
                      (kyc?.photo_file_path ?? '').trim() &&
                      kyc?.completed_at,
                  );

                  return (
                    <Card key={t.id} className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <Link
                            href={`/admin/tenants/${t.id}`}
                            className="truncate text-sm font-semibold text-indigo-700 hover:text-indigo-800 hover:underline"
                          >
                            {t.full_name || 'Tenant'}
                          </Link>
                          <div className="mt-1 truncate text-xs text-slate-600">{t.phone || t.id}</div>
                        </div>
                        <div className="shrink-0">
                          {!isProfileComplete ? <Badge>profile incomplete</Badge> : null}
                        </div>
                      </div>

                      <div>
                        <Badge>unassigned</Badge>
                      </div>

                      <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
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
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <h2 className="text-sm font-semibold text-slate-700 mb-3">Past room members (latest 50)</h2>
            {pastSafe.length === 0 ? (
              <Card>
                <div className="text-sm text-slate-600">No past members yet.</div>
              </Card>
            ) : (
              <Card className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-xs text-slate-600">
                      <th className="py-2 pr-3">Tenant</th>
                      <th className="py-2 pr-3">Room</th>
                      <th className="py-2 pr-3">Joined</th>
                      <th className="py-2 pr-3">Left</th>
                      <th className="py-2 pr-3">Added by</th>
                      <th className="py-2">Added at</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pastSafe.map((m) => {
                      const p = firstEmbed(m.profiles);
                      const tenantName = p?.full_name?.trim() || p?.phone?.trim() || m.tenant_id.slice(0, 8);
                      const roomNumber = m.rooms?.[0]?.room_number ?? m.room_id.slice(0, 8);
                      const audit = auditByEntityId.get(m.id) ?? null;
                      const actor = audit ? firstEmbed(audit.profiles) : null;
                      const addedBy = actor?.full_name?.trim() || actor?.phone?.trim() || '—';
                      const addedAt = audit ? fmtDateTime(audit.created_at) : '—';

                      return (
                        <tr key={m.id} className="border-b border-slate-100 align-top last:border-0">
                          <td className="py-2 pr-3 font-medium">
                            <Link href={`/admin/tenants/${m.tenant_id}`} className="text-indigo-700 hover:underline">
                              {tenantName}
                            </Link>
                          </td>
                          <td className="py-2 pr-3">
                            <Link href={`/admin/rooms/${m.room_id}`} className="text-indigo-700 hover:underline">
                              Room {roomNumber}
                            </Link>
                          </td>
                          <td className="py-2 pr-3">{fmtDateTime(m.joined_at)}</td>
                          <td className="py-2 pr-3">{fmtDateTime(m.left_at)}</td>
                          <td className="py-2 pr-3">{addedBy}</td>
                          <td className="py-2">{addedAt}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div className="mt-3 text-xs text-slate-600">Note: older invite-accept entries may not show Added by until migration 0009+ is applied.</div>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

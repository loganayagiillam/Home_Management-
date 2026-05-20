import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAdmin } from '@/lib/auth/server';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page';

export const metadata: Metadata = { title: 'Room Details' };
export const dynamic = 'force-dynamic';

type RoomRow = {
  id: string;
  room_number: string;
  capacity: number;
  monthly_rent: number;
  status: 'occupied' | 'vacant';
  notes: string | null;
};

type MembershipRow = {
  id: string;
  tenant_id: string;
  room_id: string;
  is_leader: boolean;
  joined_at: string;
  left_at: string | null;
  created_at: string;
  profiles?: { full_name: string | null; phone: string | null } | { full_name: string | null; phone: string | null }[] | null;
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

export default async function AdminRoomDetailsPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { supabase } = await requireAdmin();
  const { roomId } = await params;

  const [{ data: room, error: roomError }, { data: memberships, error: membershipsError }] = await Promise.all([
    supabase.from('rooms').select('id, room_number, capacity, monthly_rent, status, notes').eq('id', roomId).maybeSingle(),
    supabase
      .from('room_memberships')
      .select('id, tenant_id, room_id, is_leader, joined_at, left_at, created_at, profiles(full_name, phone)')
      .eq('room_id', roomId)
      .order('joined_at', { ascending: false }),
  ]);

  if (roomError) {
    return (
      <div className="space-y-6">
        <PageHeader title="Room" />
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{roomError.message}</div>
      </div>
    );
  }

  const roomSafe = room as RoomRow | null;
  if (!roomSafe) {
    return (
      <div className="space-y-6">
        <PageHeader title="Room" />
        <Card>
          <div className="text-sm text-slate-600">Room not found.</div>
          <div className="mt-2">
            <Link href="/admin/rooms" className="text-sm font-medium text-indigo-600 hover:underline">
              Back to Rooms
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  if (membershipsError) {
    return (
      <div className="space-y-6">
        <PageHeader title={`Room ${roomSafe.room_number}`} />
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{membershipsError.message}</div>
      </div>
    );
  }

  const membershipsSafe = (memberships ?? []) as unknown as MembershipRow[];
  const active = membershipsSafe.filter((m) => !m.left_at);
  const past = membershipsSafe.filter((m) => Boolean(m.left_at));

  const leader = active.find((m) => m.is_leader) ?? null;
  const leaderProfile = leader ? firstEmbed(leader.profiles) : null;
  const leaderName = leaderProfile?.full_name?.trim() || leaderProfile?.phone?.trim() || (leader ? leader.tenant_id.slice(0, 8) : '—');

  const fmtMoney = (n: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

  const membershipIds = membershipsSafe.map((m) => m.id);
  const { data: audits } = membershipIds.length
    ? await supabase
        .from('audit_events')
        .select('entity_id, action, created_at, profiles(full_name, phone)')
        .eq('entity_type', 'room_membership')
        .in('entity_id', membershipIds)
        .in('action', ['assigned', 'invite_accepted'])
    : { data: [] as AuditRow[] };

  const auditByEntityId = new Map<string, AuditRow>();
  for (const a of (audits ?? []) as unknown as AuditRow[]) {
    // Keep earliest event per membership
    const existing = auditByEntityId.get(a.entity_id);
    if (!existing || new Date(a.created_at).getTime() < new Date(existing.created_at).getTime()) {
      auditByEntityId.set(a.entity_id, a);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title={`Room ${roomSafe.room_number}`} description="Detailed room info and member history." />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <Badge>
            Occupancy: {active.length}/{roomSafe.capacity}
          </Badge>
          <Badge>{roomSafe.status}</Badge>
          <Badge>Leader: {leader ? leaderName : '—'}</Badge>
        </div>
        <Link href="/admin/rooms" className="text-sm font-medium text-indigo-600 hover:underline">
          Back to Rooms
        </Link>
      </div>

      <Card className="space-y-2">
        <div className="text-xs text-slate-600">Monthly rent</div>
        <div className="text-lg font-semibold">{fmtMoney(roomSafe.monthly_rent)}</div>
        {roomSafe.notes ? <div className="text-xs text-slate-600">{roomSafe.notes}</div> : null}
      </Card>

      <Card className="space-y-3">
        <div className="text-sm font-semibold">Active members ({active.length})</div>
        {active.length === 0 ? (
          <div className="text-sm text-slate-600">No active members.</div>
        ) : (
          <div className="divide-y divide-slate-100 rounded-xl border border-slate-100">
            {active.map((m) => {
              const profile = firstEmbed(m.profiles);
              const name = profile?.full_name?.trim() || 'Tenant';
              const phone = profile?.phone?.trim() || '';
              const audit = auditByEntityId.get(m.id) ?? null;
              const actor = audit ? firstEmbed(audit.profiles) : null;
              const addedBy = actor?.full_name?.trim() || actor?.phone?.trim() || '—';
              const addedAt = audit ? fmtDateTime(audit.created_at) : '—';

              return (
                <div key={m.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2">
                  <div className="min-w-0">
                    <Link href={`/admin/tenants/${m.tenant_id}`} className="truncate text-sm font-semibold text-indigo-700 hover:underline">
                      {name}
                    </Link>
                    <div className="mt-0.5 text-xs text-slate-600">
                      {phone || m.tenant_id}
                    </div>
                    <div className="mt-1 text-[11px] text-slate-500">
                      Added by: {addedBy} · Added at: {addedAt}
                    </div>
                  </div>
                  <div className="shrink-0 flex gap-2">
                    {m.is_leader ? <Badge>leader</Badge> : null}
                    <Badge>Joined: {fmtDateTime(m.joined_at)}</Badge>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card className="space-y-3">
        <div className="text-sm font-semibold">Past members ({past.length})</div>
        {past.length === 0 ? (
          <div className="text-sm text-slate-600">No past members.</div>
        ) : (
          <div className="divide-y divide-slate-100 rounded-xl border border-slate-100">
            {past.slice(0, 50).map((m) => {
              const profile = firstEmbed(m.profiles);
              const name = profile?.full_name?.trim() || 'Tenant';
              const phone = profile?.phone?.trim() || '';
              const audit = auditByEntityId.get(m.id) ?? null;
              const actor = audit ? firstEmbed(audit.profiles) : null;
              const addedBy = actor?.full_name?.trim() || actor?.phone?.trim() || '—';
              const addedAt = audit ? fmtDateTime(audit.created_at) : '—';

              return (
                <div key={m.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2">
                  <div className="min-w-0">
                    <Link href={`/admin/tenants/${m.tenant_id}`} className="truncate text-sm font-semibold text-indigo-700 hover:underline">
                      {name}
                    </Link>
                    <div className="mt-0.5 text-xs text-slate-600">{phone || m.tenant_id}</div>
                    <div className="mt-1 text-[11px] text-slate-500">
                      Added by: {addedBy} · Added at: {addedAt}
                    </div>
                  </div>
                  <div className="shrink-0 flex gap-2">
                    <Badge>Joined: {fmtDateTime(m.joined_at)}</Badge>
                    <Badge>Left: {fmtDateTime(m.left_at)}</Badge>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {past.length > 50 ? <div className="text-xs text-slate-600">Showing latest 50 past members.</div> : null}
      </Card>
    </div>
  );
}

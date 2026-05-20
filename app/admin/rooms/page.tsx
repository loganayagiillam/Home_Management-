import { requireAdmin } from '@/lib/auth/server';
import { createRoom, deleteRoom, updateRoom } from './actions';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page';
import { decodeSearchParam, resolveSearchParams } from '@/lib/flash';
import { RoomInvitePanel } from './invite-panel';

export const metadata: Metadata = { title: 'Rooms' };
export const dynamic = 'force-dynamic';

export default async function AdminRoomsPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }> | { error?: string };
}) {
  const { supabase } = await requireAdmin();

  const sp = await resolveSearchParams(searchParams);
  const flashError = decodeSearchParam(sp?.error);

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
    profiles?: { full_name: string | null; phone: string | null } | { full_name: string | null; phone: string | null }[] | null;
  };

  function getProfile(p: MembershipRow['profiles']) {
    if (!p) return null;
    return Array.isArray(p) ? p[0] ?? null : p;
  }

  const [{ data: rooms, error: roomsError }, { data: memberships, error: membershipsError }] = await Promise.all([
    supabase
      .from('rooms')
      .select('id, room_number, capacity, monthly_rent, status, notes')
      .order('room_number', { ascending: true }),
    supabase
      .from('room_memberships')
      .select('id, tenant_id, room_id, is_leader, joined_at, profiles(full_name, phone)')
      .is('left_at', null)
      .order('joined_at', { ascending: true }),
  ]);

  const fatalError = roomsError ?? membershipsError;
  if (fatalError) {
    return (
      <div className="space-y-6">
        <PageHeader title="Rooms" />
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{fatalError.message}</div>
      </div>
    );
  }

  const roomsSafe = (rooms ?? []) as RoomRow[];
  const membershipsSafe = (memberships ?? []) as MembershipRow[];

  const membershipsByRoomId = new Map<string, MembershipRow[]>();
  for (const m of membershipsSafe) {
    const list = membershipsByRoomId.get(m.room_id) ?? [];
    list.push(m);
    membershipsByRoomId.set(m.room_id, list);
  }

  const fmt = (n: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

  const derivedStatus = (roomId: string) => ((membershipsByRoomId.get(roomId)?.length ?? 0) > 0 ? 'occupied' : 'vacant');

  const occupiedCount = roomsSafe.filter((r) => derivedStatus(r.id) === 'occupied').length;
  const vacantCount = roomsSafe.length - occupiedCount;

  return (
    <div className="space-y-6">
      <PageHeader title="Rooms" description="Manage your rental rooms — add, edit, or remove them." />

      {flashError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{flashError}</div>
      ) : null}

      {/* ── Add Room Form ── */}
      <Card>
        <h2 className="text-sm font-semibold">Add new room</h2>
        <form action={createRoom} className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Field label="Room number">
            <Input name="room_number" placeholder="101" required />
          </Field>
          <Field label="Capacity">
            <Input name="capacity" type="number" min={1} placeholder="4" required />
          </Field>
          <Field label="Monthly rent">
            <Input name="monthly_rent" type="number" min={0} step="0.01" placeholder="12000" required />
          </Field>
          <Field label="Notes">
            <Input name="notes" placeholder="Optional" />
          </Field>
          <div className="col-span-2 flex justify-end md:col-span-4">
            <Button id="create-room-btn" type="submit">
              Create room
            </Button>
          </div>
        </form>
      </Card>

      {/* ── Rooms Grid ── */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">
          {roomsSafe.length} room{roomsSafe.length !== 1 ? 's' : ''}
        </h2>
        <div className="flex gap-2">
          <Badge>Occupied: {occupiedCount}</Badge>
          <Badge>Vacant: {vacantCount}</Badge>
        </div>
      </div>

      {!roomsSafe.length ? (
        <Card>
          <div className="text-sm text-slate-600">No rooms yet. Create your first room above.</div>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {roomsSafe.map((room) => {
            const members = membershipsByRoomId.get(room.id) ?? [];
            const leader = members.find((m) => m.is_leader) ?? null;
            const status = derivedStatus(room.id);
            const isFull = members.length >= room.capacity;
            const leaderProfile = leader ? getProfile(leader.profiles) : null;
            const leaderName = leaderProfile?.full_name?.trim() || leaderProfile?.phone?.trim() || (leader ? leader.tenant_id.slice(0, 8) : null);

            return (
              <Card key={room.id} className="space-y-4">
                <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
                  <div>
                    <Link href={`/admin/rooms/${room.id}`} className="text-sm font-semibold text-indigo-700 hover:text-indigo-800 hover:underline">
                      Room {room.room_number}
                    </Link>
                    <div className="mt-1 text-xs text-slate-600">
                      Occupancy: {members.length}/{room.capacity}
                    </div>
                    <div className="mt-2">
                      <Badge>{status}</Badge>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-slate-600">Monthly rent</div>
                    <div className="mt-1 text-sm font-semibold">{fmt(room.monthly_rent)}</div>
                  </div>
                </div>

                {room.notes ? <div className="text-xs text-slate-600">{room.notes}</div> : null}

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-xs font-medium text-slate-700">Members</div>
                    {leader ? (
                      <div className="text-xs text-slate-600">
                        Leader: {leaderName}
                      </div>
                    ) : (
                      <div className="text-xs text-slate-600">No leader set</div>
                    )}
                  </div>
                  {members.length ? (
                    <div className="divide-y divide-slate-100 rounded-xl border border-slate-100">
                      {members.map((m) => {
                        const profile = getProfile(m.profiles);
                        const displayName = profile?.full_name?.trim() || 'Tenant';
                        const displaySub = profile?.phone?.trim() || m.tenant_id;

                        return (
                        <div key={m.id} className="flex items-center justify-between gap-3 px-3 py-2">
                          <div className="min-w-0">
                            <div className="truncate text-xs font-semibold text-slate-900">
                              {displayName}
                            </div>
                            <div className="truncate text-[11px] text-slate-600">
                              {displaySub}
                            </div>
                          </div>
                          {m.is_leader ? <Badge>leader</Badge> : null}
                        </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-xs text-slate-600">No active members yet. Assign a tenant or share an invite.</div>
                  )}
                </div>

                <div className="space-y-2 border-t border-slate-100 pt-3">
                  <div className="text-xs font-medium text-slate-700">Invite</div>
                  <RoomInvitePanel roomId={room.id} disabled={isFull} />
                  <div className="text-xs text-slate-600">
                    Need to manually assign tenants or set a leader?{' '}
                    <a href="/admin/tenants" className="text-indigo-600 hover:text-indigo-700 font-medium">
                      Go to Tenants
                    </a>
                  </div>
                </div>

                <form id={`update-room-${room.id}`} action={updateRoom} className="space-y-3">
                  <input type="hidden" name="id" value={room.id} />
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Room number">
                      <Input name="room_number" defaultValue={room.room_number} required />
                    </Field>
                    <Field label="Capacity">
                      <Input name="capacity" type="number" min={1} defaultValue={room.capacity} required />
                    </Field>
                    <Field label="Rent">
                      <Input
                        name="monthly_rent"
                        type="number"
                        min={0}
                        step="0.01"
                        defaultValue={room.monthly_rent}
                        required
                      />
                    </Field>
                  </div>
                  <Field label="Notes">
                    <Input name="notes" defaultValue={room.notes ?? ''} placeholder="Optional" />
                  </Field>
                </form>

                <div className="flex gap-2">
                  <Button type="submit" form={`update-room-${room.id}`} className="flex-1">
                    Save
                  </Button>
                  <form action={deleteRoom} className="flex-1">
                    <input type="hidden" name="id" value={room.id} />
                    <Button variant="secondary" type="submit" className="w-full">
                      Delete
                    </Button>
                  </form>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

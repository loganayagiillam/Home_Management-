import { requireUser } from '@/lib/auth/server';
import { getActiveMembershipForCurrentUser } from '@/lib/room/server';
import { removeMember } from './actions';
import { InvitePanel } from './invite-panel';
import type { Metadata } from 'next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page';
import { decodeSearchParam, resolveSearchParams } from '@/lib/flash';

export const metadata: Metadata = { title: 'My Room' };
export const dynamic = 'force-dynamic';

const avatarColors = [
  'bg-indigo-100 text-indigo-700',
  'bg-violet-100 text-violet-700',
  'bg-emerald-100 text-emerald-700',
  'bg-rose-100 text-rose-700',
  'bg-amber-100 text-amber-700',
  'bg-cyan-100 text-cyan-700',
];

function getInitials(name: string | null) {
  if (!name) return '?';
  return name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
}

export default async function TenantRoomPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }> | { error?: string };
}) {
  const { supabase, user } = await requireUser();
  // Pass supabase + userId to avoid recursive auth call
  const membership = await getActiveMembershipForCurrentUser(supabase, user.id);

  const sp = await resolveSearchParams(searchParams);
  const flashError = decodeSearchParam(sp?.error);

  if (!membership) {
    return (
      <div className="space-y-6">
        <PageHeader title="My Room" />
        <Card>
          <div className="text-sm text-slate-600">Not assigned to a room yet.</div>
          <div className="mt-1 text-xs text-slate-600">Ask your admin or use an invite link to join a room.</div>
        </Card>
      </div>
    );
  }

  const [{ data: room }, { data: members }] = await Promise.all([
    supabase
      .from('rooms')
      .select('id, room_number, capacity, monthly_rent, status')
      .eq('id', membership.roomId)
      .maybeSingle(),
    supabase
      .from('room_memberships')
      .select('id, tenant_id, is_leader, joined_at, left_at, profiles(full_name, phone)')
      .eq('room_id', membership.roomId)
      .is('left_at', null)
      .order('joined_at', { ascending: true }),
  ]);

  const fmt = (n: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

  function getProfile(p: unknown): { full_name?: string | null; phone?: string | null } | null {
    if (!p) return null;
    if (Array.isArray(p)) return (p[0] as { full_name?: string | null; phone?: string | null } | undefined) ?? null;
    return p as { full_name?: string | null; phone?: string | null };
  }

  return (
    <div className="space-y-6">
      <PageHeader title="My Room" description={room ? `Room ${room.room_number} details and members.` : 'Your current room.'} />

      {flashError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{flashError}</div>
      ) : null}

      {/* Room Info Card */}
      {room && (
        <Card className="space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-base font-bold text-slate-900">Room {room.room_number}</div>
              <div className="mt-2 flex flex-wrap gap-2">
                <Badge>{room.status}</Badge>
                <Badge>{room.capacity} capacity</Badge>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-slate-500">Monthly rent</div>
              <div className="mt-1 text-xl font-bold text-indigo-600">{fmt(room.monthly_rent)}</div>
            </div>
          </div>
        </Card>
      )}

      {/* Members */}
      <Card>
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="text-sm font-semibold text-slate-900">Room members</div>
          <Badge>{members?.length ?? 0} members</Badge>
        </div>

        <div className="divide-y divide-slate-100">
          {members?.map((m, i) => {
            const isSelf = m.tenant_id === user.id;
            const profile = getProfile((m as unknown as { profiles?: unknown }).profiles);
            const name = profile?.full_name?.trim() || 'Tenant';
            const phone = profile?.phone?.trim() || '';
            const colorClass = avatarColors[i % avatarColors.length];

            return (
              <div key={m.id} className="flex items-center justify-between gap-4 py-3">
                <div className="flex items-center gap-3">
                  <div className={`flex h-9 w-9 items-center justify-center rounded-xl text-sm font-bold shrink-0 ${colorClass}`}>
                    {getInitials(name)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">{name}</span>
                      {isSelf ? <Badge>you</Badge> : null}
                      {m.is_leader ? <Badge>leader</Badge> : null}
                    </div>
                    {phone ? <div className="text-xs text-slate-500">{phone}</div> : null}
                  </div>
                </div>

                {membership.isLeader && !m.is_leader && (
                  <form action={removeMember}>
                    <input type="hidden" name="membership_id" value={m.id} />
                    <Button variant="secondary" type="submit">
                      Remove
                    </Button>
                  </form>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* Invite panel (leader only) */}
      {membership.isLeader && <InvitePanel />}
    </div>
  );
}

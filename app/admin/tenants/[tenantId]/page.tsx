import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAdmin } from '@/lib/auth/server';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page';

export const metadata: Metadata = { title: 'Tenant Details' };
export const dynamic = 'force-dynamic';

type ProfileRow = {
  id: string;
  full_name: string | null;
  phone: string | null;
  role: string;
  created_at: string;
};

type KycRow = {
  tenant_id: string;
  date_of_birth: string | null;
  address: string | null;
  aadhaar_last4: string | null;
  aadhaar_file_path: string | null;
  aadhaar_uploaded_at: string | null;
  photo_file_path: string | null;
  photo_uploaded_at: string | null;
  completed_at: string | null;
  created_at: string;
};

type MembershipRow = {
  id: string;
  room_id: string;
  is_leader: boolean;
  joined_at: string;
  left_at: string | null;
  created_at: string;
  rooms?: { room_number: string } | { room_number: string }[] | null;
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

export default async function AdminTenantDetailsPage({ params }: { params: Promise<{ tenantId: string }> }) {
  const { supabase } = await requireAdmin();
  const { tenantId } = await params;

  const [{ data: profile, error: profileError }, { data: kyc }, { data: memberships }] = await Promise.all([
    supabase.from('profiles').select('id, full_name, phone, role, created_at').eq('id', tenantId).maybeSingle(),
    supabase
      .from('tenant_kyc')
      .select(
        'tenant_id, date_of_birth, address, aadhaar_last4, aadhaar_file_path, aadhaar_uploaded_at, photo_file_path, photo_uploaded_at, completed_at, created_at',
      )
      .eq('tenant_id', tenantId)
      .maybeSingle(),
    supabase
      .from('room_memberships')
      .select('id, room_id, is_leader, joined_at, left_at, created_at, rooms(room_number)')
      .eq('tenant_id', tenantId)
      .order('joined_at', { ascending: false }),
  ]);

  if (profileError) {
    return (
      <div className="space-y-6">
        <PageHeader title="Tenant" />
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{profileError.message}</div>
      </div>
    );
  }

  const profileSafe = profile as ProfileRow | null;
  if (!profileSafe) {
    return (
      <div className="space-y-6">
        <PageHeader title="Tenant" />
        <Card>
          <div className="text-sm text-slate-600">Tenant not found.</div>
          <div className="mt-2">
            <Link href="/admin/tenants" className="text-sm font-medium text-indigo-600 hover:underline">
              Back to Tenants
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  const kycSafe = kyc as KycRow | null;
  const membershipsSafe = (memberships ?? []) as unknown as MembershipRow[];

  const currentMembership = membershipsSafe.find((m) => !m.left_at) ?? null;
  const currentRoom = currentMembership ? firstEmbed(currentMembership.rooms) : null;

  const isComplete = Boolean(
    (profileSafe.full_name ?? '').trim() &&
      (profileSafe.phone ?? '').trim() &&
      (kycSafe?.aadhaar_last4 ?? '').trim() &&
      (kycSafe?.aadhaar_file_path ?? '').trim() &&
      (kycSafe?.photo_file_path ?? '').trim() &&
      kycSafe?.completed_at,
  );

  return (
    <div className="space-y-6">
      <PageHeader title={profileSafe.full_name || 'Tenant'} description="Tenant profile, KYC, and room history." />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <Badge>{profileSafe.role}</Badge>
          {currentMembership ? <Badge>Assigned: Room {currentRoom?.room_number ?? currentMembership.room_id.slice(0, 8)}</Badge> : <Badge>Unassigned</Badge>}
          {currentMembership?.is_leader ? <Badge>leader</Badge> : null}
          {!isComplete ? <Badge>profile incomplete</Badge> : <Badge>profile complete</Badge>}
        </div>
        <Link href="/admin/tenants" className="text-sm font-medium text-indigo-600 hover:underline">
          Back to Tenants
        </Link>
      </div>

      <Card className="space-y-2">
        <div className="text-sm font-semibold">Contact</div>
        <div className="text-sm text-slate-700">Name: {profileSafe.full_name || '—'}</div>
        <div className="text-sm text-slate-700">Phone: {profileSafe.phone || '—'}</div>
        <div className="text-xs text-slate-600">Created: {fmtDateTime(profileSafe.created_at)}</div>
      </Card>

      <Card className="space-y-2">
        <div className="text-sm font-semibold">KYC</div>
        <div className="text-sm text-slate-700">DOB: {kycSafe?.date_of_birth ?? '—'}</div>
        <div className="text-sm text-slate-700">Address: {kycSafe?.address ?? '—'}</div>
        <div className="text-sm text-slate-700">Aadhaar last 4: {kycSafe?.aadhaar_last4 ?? '—'}</div>
        <div className="text-xs text-slate-600">Completed at: {fmtDateTime(kycSafe?.completed_at ?? null)}</div>

        <div className="flex flex-wrap gap-2 pt-2">
          {kycSafe?.aadhaar_file_path ? (
            <Link
              className="text-sm font-medium text-indigo-600 hover:underline"
              href={`/admin/tenants/${tenantId}/aadhaar`}
            >
              Download Aadhaar PDF
            </Link>
          ) : (
            <span className="text-sm text-slate-600">Aadhaar: not uploaded</span>
          )}

          {kycSafe?.photo_file_path ? (
            <Link
              className="text-sm font-medium text-indigo-600 hover:underline"
              href={`/admin/tenants/${tenantId}/photo`}
            >
              Download Photo
            </Link>
          ) : (
            <span className="text-sm text-slate-600">Photo: not uploaded</span>
          )}
        </div>
      </Card>

      <Card className="space-y-3">
        <div className="text-sm font-semibold">Room history</div>
        {membershipsSafe.length === 0 ? (
          <div className="text-sm text-slate-600">No room memberships yet.</div>
        ) : (
          <div className="divide-y divide-slate-100 rounded-xl border border-slate-100">
            {membershipsSafe.slice(0, 50).map((m) => {
              const room = firstEmbed(m.rooms);
              const roomLabel = room?.room_number ? `Room ${room.room_number}` : m.room_id.slice(0, 8);
              return (
                <div key={m.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2">
                  <div>
                    <div className="text-sm font-semibold">{roomLabel}</div>
                    <div className="mt-0.5 text-xs text-slate-600">
                      Joined: {fmtDateTime(m.joined_at)} · Left: {fmtDateTime(m.left_at)}
                    </div>
                  </div>
                  <div className="shrink-0 flex gap-2">
                    {m.is_leader ? <Badge>leader</Badge> : null}
                    <Link href={`/admin/rooms/${m.room_id}`} className="text-sm font-medium text-indigo-600 hover:underline">
                      View room
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {membershipsSafe.length > 50 ? <div className="text-xs text-slate-600">Showing latest 50 entries.</div> : null}
      </Card>
    </div>
  );
}

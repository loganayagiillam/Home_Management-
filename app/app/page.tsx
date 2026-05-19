import { requireUser } from '@/lib/auth/server';
import { getActiveMembershipForCurrentUser } from '@/lib/room/server';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Dashboard' };
export const dynamic = 'force-dynamic';

export default async function TenantDashboardPage() {
  const { supabase, user } = await requireUser();
  // Pass supabase + userId to avoid recursive auth calls
  const membership = await getActiveMembershipForCurrentUser(supabase, user.id);

  type BillRow = {
    id: string;
    bill_month: string;
    total_amount: number;
    paid_amount: number;
    balance_due: number;
    is_paid: boolean;
  };

  let currentBill: BillRow | null = null;
  let roomNumber: string | null = null;

  if (membership) {
    const [{ data: room }, { data: bills }] = await Promise.all([
      supabase
        .from('rooms')
        .select('room_number')
        .eq('id', membership.roomId)
        .maybeSingle(),
      supabase
        .from('room_bill_summary')
        .select('id, bill_month, total_amount, paid_amount, balance_due, is_paid')
        .eq('room_id', membership.roomId)
        .order('bill_month', { ascending: false })
        .limit(1),
    ]);
    roomNumber = room?.room_number ?? null;
    currentBill = (bills?.[0] as BillRow) ?? null;
  }

  const fmt = (n: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

  function fmtMonth(iso: string) {
    try {
      return new Date(iso + '-01').toLocaleDateString('en-IN', { year: 'numeric', month: 'long' });
    } catch {
      return iso.slice(0, 7);
    }
  }

  return (
    <div className="animate-fade-in space-y-6">
      {/* ── Welcome Hero ── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700 p-6 text-white shadow-lg shadow-indigo-200">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width=&quot;60&quot; height=&quot;60&quot; viewBox=&quot;0 0 60 60&quot; xmlns=&quot;http://www.w3.org/2000/svg&quot;%3E%3Cg fill=&quot;none&quot; fill-rule=&quot;evenodd&quot;%3E%3Cg fill=&quot;%23ffffff&quot; fill-opacity=&quot;0.04&quot;%3E%3Ccircle cx=&quot;30&quot; cy=&quot;30&quot; r=&quot;4&quot;/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-50" />
        <div className="relative">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
              <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955a1.126 1.126 0 011.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75" />
              </svg>
            </div>
            <div>
              <div className="text-xl font-bold">
                {roomNumber ? `Room ${roomNumber}` : 'Welcome to HomeHub'}
              </div>
              <div className="text-indigo-200 text-sm">
                {membership?.isLeader ? '⭐ Room Leader' : membership ? 'Tenant Member' : 'Not yet assigned to a room'}
              </div>
            </div>
          </div>
          {membership?.isLeader && (
            <div className="inline-flex items-center gap-1.5 bg-white/20 backdrop-blur-sm rounded-full px-3 py-1.5 text-xs font-semibold">
              <svg className="h-3.5 w-3.5 text-amber-300" fill="currentColor" viewBox="0 0 24 24">
                <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
              You are the room leader — manage invites &amp; payments
            </div>
          )}
        </div>
      </div>

      {/* ── No room assigned ── */}
      {!membership && (
        <div className="card p-8 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 mx-auto mb-4">
            <svg className="h-8 w-8 text-amber-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-slate-700">Not assigned to a room</p>
          <p className="text-xs text-slate-400 mt-1">Contact your administrator or use an invite link to join a room.</p>
        </div>
      )}

      {/* ── Current bill summary ── */}
      {membership && (
        <div>
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Latest Bill</h2>
          {!currentBill ? (
            <div className="card p-6 text-center">
              <p className="text-sm text-slate-400">No bills have been created for your room yet.</p>
            </div>
          ) : (
            <div className="card overflow-hidden">
              <div className={`px-5 py-4 flex items-center justify-between border-b border-slate-100 ${currentBill.is_paid ? 'bg-gradient-to-r from-emerald-50 to-teal-50' : 'bg-gradient-to-r from-red-50 to-orange-50'}`}>
                <div>
                  <div className="text-sm font-semibold text-slate-800">{fmtMonth(currentBill.bill_month)}</div>
                  <div className="text-xs text-slate-500 mt-0.5">Current billing period</div>
                </div>
                <span className={currentBill.is_paid ? 'badge-green' : 'badge-red'}>
                  {currentBill.is_paid ? '✓ Paid' : '⏳ Due'}
                </span>
              </div>

              <div className="px-5 py-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-xs text-slate-500 mb-1">Total Bill</div>
                  <div className="text-lg font-bold text-slate-900">{fmt(currentBill.total_amount)}</div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-slate-500 mb-1">Paid</div>
                  <div className="text-lg font-bold text-emerald-600">{fmt(currentBill.paid_amount)}</div>
                </div>
                <div className="text-center col-span-2 md:col-span-1">
                  <div className="text-xs text-slate-500 mb-1">Balance Due</div>
                  <div className={`text-lg font-bold ${currentBill.balance_due > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                    {fmt(currentBill.balance_due)}
                  </div>
                </div>
                <div className="text-center hidden md:block">
                  <div className="text-xs text-slate-500 mb-1">Payment %</div>
                  <div className="text-lg font-bold text-indigo-600">
                    {currentBill.total_amount > 0
                      ? Math.round((currentBill.paid_amount / currentBill.total_amount) * 100)
                      : 0}%
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Quick links ── */}
      <div>
        <h2 className="text-sm font-semibold text-slate-700 mb-3">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { href: '/app/room', label: 'My Room', icon: '🏠', desc: 'View members & invite', color: 'from-indigo-50 to-blue-50 border-indigo-100' },
            { href: '/app/bills', label: 'Bills', icon: '🧾', desc: 'View & pay bills', color: 'from-emerald-50 to-teal-50 border-emerald-100' },
            { href: '/app/complaints', label: 'Complaints', icon: '📢', desc: 'Report an issue', color: 'from-amber-50 to-orange-50 border-amber-100' },
            { href: '/logout', label: 'Sign Out', icon: '👋', desc: 'Logout safely', color: 'from-slate-50 to-slate-50 border-slate-100' },
          ].map((item) => (
            <a
              key={item.href}
              href={item.href}
              className={`rounded-2xl bg-gradient-to-br ${item.color} border p-4 flex flex-col gap-2 no-underline transition-all duration-200 hover:shadow-md hover:scale-[1.02]`}
            >
              <span className="text-2xl">{item.icon}</span>
              <div>
                <div className="text-sm font-semibold text-slate-800">{item.label}</div>
                <div className="text-xs text-slate-500">{item.desc}</div>
              </div>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

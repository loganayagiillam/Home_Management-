import { requireAdmin } from '@/lib/auth/server';
import type { Metadata } from 'next';
import Link from 'next/link';
import { RealtimeClock } from '@/components/realtime-clock';

export const metadata: Metadata = { title: 'Dashboard' };
export const dynamic = 'force-dynamic';

export default async function AdminDashboardPage() {
  const { supabase } = await requireAdmin();

  // Fetch all stats in parallel for maximum performance
  const [
    { data: rooms },
    { data: billSummary },
    { data: recentPayments },
    { data: pendingBills },
    { data: openComplaints },
  ] = await Promise.all([
    supabase.from('rooms').select('id, status'),
    supabase.from('room_bill_summary').select('total_amount, is_paid'),
    supabase
      .from('payments')
      .select('id, amount, payment_method, paid_at, room_bill_id')
      .order('paid_at', { ascending: false })
      .limit(6),
    supabase
      .from('room_bill_summary')
      .select('id, room_id, bill_month, balance_due')
      .eq('is_paid', false)
      .order('bill_month', { ascending: false })
      .limit(5),
    supabase
      .from('complaints')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'open'),
  ]);

  const totalRooms = rooms?.length ?? 0;
  const occupied = rooms?.filter((r) => r.status === 'occupied').length ?? 0;
  const vacant = totalRooms - occupied;
  const totalRevenue = (billSummary ?? []).filter((b) => b.is_paid).reduce((s, b) => s + b.total_amount, 0);
  const openComplaintsCount = (openComplaints as unknown as { count?: number } | null)?.count ?? 0;

  const fmt = (n: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

  const paymentMethodColor: Record<string, string> = {
    upi: 'badge-indigo',
    cash: 'badge-amber',
    bank: 'badge-blue',
  };

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="page-title">Dashboard</h1>
            <p className="page-subtitle">Overview of your rental property.</p>
          </div>
          <RealtimeClock className="text-xs text-slate-600" />
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <span className="stat-label">Total Rooms</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50">
              <svg className="h-4 w-4 text-indigo-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955a1.126 1.126 0 011.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75" />
              </svg>
            </div>
          </div>
          <div className="stat-value">{totalRooms}</div>
          <div className="stat-sub">registered rooms</div>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between">
            <span className="stat-label">Occupied</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50">
              <svg className="h-4 w-4 text-emerald-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
            </div>
          </div>
          <div className="stat-value text-emerald-600">{occupied}</div>
          <div className="stat-sub">rooms with tenants</div>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between">
            <span className="stat-label">Vacant</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50">
              <svg className="h-4 w-4 text-amber-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
              </svg>
            </div>
          </div>
          <div className="stat-value text-amber-600">{vacant}</div>
          <div className="stat-sub">available to rent</div>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between">
            <span className="stat-label">Revenue</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-50">
              <svg className="h-4 w-4 text-violet-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75" />
              </svg>
            </div>
          </div>
          <div className="stat-value text-violet-600 text-2xl">{fmt(totalRevenue)}</div>
          <div className="stat-sub">total collected</div>
        </div>

        <Link href="/admin/complaints" className="stat-card col-span-2 lg:col-span-1 hover:border-red-200 transition-colors">
          <div className="flex items-center justify-between">
            <span className="stat-label">Open Issues</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-50">
              <svg className="h-4 w-4 text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
            </div>
          </div>
          <div className="stat-value text-red-600">{openComplaintsCount}</div>
          <div className="stat-sub">open complaints</div>
        </Link>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* ── Recent payments ── */}
        <div className="card overflow-hidden p-0">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="section-title">Recent Payments</h2>
            <Link href="/admin/payments" className="text-xs text-indigo-600 hover:text-indigo-700 font-medium">View all →</Link>
          </div>
          {!recentPayments?.length ? (
            <div className="px-6 py-8 text-center">
              <p className="text-sm text-slate-400">No payments recorded yet.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {recentPayments.map((p) => (
                <div key={p.id} className="flex items-center justify-between px-6 py-3 hover:bg-slate-50 transition-colors">
                  <div>
                    <div className="text-sm font-semibold text-slate-800">{fmt(p.amount)}</div>
                    <div className="text-xs text-slate-400">{p.paid_at.slice(0, 10)}</div>
                  </div>
                  <span className={paymentMethodColor[p.payment_method] ?? 'badge-slate'}>
                    {p.payment_method.toUpperCase()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Pending bills ── */}
        <div className="card overflow-hidden p-0">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="section-title">Pending Bills</h2>
            {pendingBills && pendingBills.length > 0 && (
              <span className="badge-red">{pendingBills.length} unpaid</span>
            )}
          </div>
          {!pendingBills?.length ? (
            <div className="px-6 py-8 text-center">
              <div className="flex items-center justify-center h-10 w-10 rounded-full bg-emerald-50 mx-auto mb-3">
                <svg className="h-5 w-5 text-emerald-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </div>
              <p className="text-sm text-slate-400">All bills are paid!</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {pendingBills.map((b) => (
                <div key={b.id} className="flex items-center justify-between px-6 py-3 hover:bg-slate-50 transition-colors">
                  <div>
                    <div className="text-sm font-medium text-slate-800">
                      {b.bill_month?.slice(0, 7)}
                    </div>
                    <div className="text-xs text-slate-400">Room {b.room_id.slice(0, 8)}…</div>
                  </div>
                  <span className="text-sm font-semibold text-red-600">{fmt(b.balance_due)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

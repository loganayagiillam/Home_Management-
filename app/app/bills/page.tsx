import { requireUser } from '@/lib/auth/server';
import { getActiveMembershipForCurrentUser } from '@/lib/room/server';
import { recordPayment } from './actions';
import type { Metadata } from 'next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page';
import { Select } from '@/components/ui/select';
import { decodeSearchParam, resolveSearchParams } from '@/lib/flash';
import { RazorpayButton } from '@/components/RazorpayButton';

export const metadata: Metadata = { title: 'Bills' };
export const dynamic = 'force-dynamic';

type BillSummaryRow = {
  id: string;
  bill_month: string;
  rent_amount: number;
  electricity_amount: number;
  water_amount: number;
  other_amount: number;
  total_amount: number;
  paid_amount: number;
  balance_due: number;
  is_paid: boolean;
};

type PaymentRow = {
  id: string;
  room_bill_id: string;
  payment_method: string;
  amount: number;
  reference: string | null;
  paid_at: string;
};

function fmtMonth(iso: string) {
  try {
    return new Date(iso + '-01').toLocaleDateString('en-IN', { year: 'numeric', month: 'long' });
  } catch {
    return iso.slice(0, 7);
  }
}

export default async function TenantBillsPage({
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
        <PageHeader title="Bills" />
        <Card>
          <div className="text-sm text-slate-600">You are not assigned to a room yet.</div>
        </Card>
      </div>
    );
  }

  const { data: billSummary } = await supabase
    .from('room_bill_summary')
    .select('id, bill_month, rent_amount, electricity_amount, water_amount, other_amount, total_amount, paid_amount, balance_due, is_paid')
    .eq('room_id', membership.roomId)
    .order('bill_month', { ascending: false })
    .limit(12);

  const billsSafe = (billSummary ?? []) as BillSummaryRow[];
  const billIds = billsSafe.map((b) => b.id);

  let paymentsSafe: PaymentRow[] = [];
  if (billIds.length) {
    const { data: payments } = await supabase
      .from('payments')
      .select('id, room_bill_id, payment_method, amount, reference, paid_at')
      .in('room_bill_id', billIds)
      .order('paid_at', { ascending: false });
    paymentsSafe = (payments ?? []) as PaymentRow[];
  }

  const paymentsByBillId = new Map<string, PaymentRow[]>();
  for (const p of paymentsSafe) {
    const arr = paymentsByBillId.get(p.room_bill_id) ?? [];
    arr.push(p);
    paymentsByBillId.set(p.room_bill_id, arr);
  }

  const fmt = (n: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

  const totalDue = billsSafe.filter((b) => !b.is_paid).reduce((s, b) => s + b.balance_due, 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Bills" description="Your room's monthly billing history." />

      {flashError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{flashError}</div>
      ) : null}

      {/* Summary strip */}
      {billsSafe.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="card p-4 text-center">
            <div className="text-xs text-slate-500">Total Bills</div>
            <div className="mt-1 text-xl font-bold text-slate-900">{billsSafe.length}</div>
          </div>
          <div className="card p-4 text-center">
            <div className="text-xs text-slate-500">Paid</div>
            <div className="mt-1 text-xl font-bold text-emerald-600">{billsSafe.filter((b) => b.is_paid).length}</div>
          </div>
          <div className="card p-4 text-center">
            <div className="text-xs text-slate-500">Total Due</div>
            <div className="mt-1 text-lg font-bold text-red-600">{fmt(totalDue)}</div>
          </div>
        </div>
      )}

      {billsSafe.length === 0 ? (
        <Card>
          <div className="text-sm text-slate-600">No bills yet.</div>
          <div className="mt-1 text-xs text-slate-600">Bills will appear here once your admin creates them.</div>
        </Card>
      ) : (
        <div className="space-y-5">
          {billsSafe.map((b) => {
            const billPayments = paymentsByBillId.get(b.id) ?? [];
            return (
              <Card key={b.id} className="space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-3">
                  <div>
                    <div className="text-base font-bold text-slate-900">{fmtMonth(b.bill_month)}</div>
                    <div className="mt-1 text-xs text-slate-500">Total: {fmt(b.total_amount)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-slate-500">Due</div>
                    <div className="mt-1 text-xl font-bold text-slate-900">{fmt(b.balance_due)}</div>
                    <div className="mt-2 flex justify-end">
                      <Badge>{b.is_paid ? '✓ paid' : '⏳ unpaid'}</Badge>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs text-slate-700 sm:grid-cols-4">
                  {[
                    { label: 'Rent', val: b.rent_amount, color: 'bg-indigo-50 text-indigo-800' },
                    { label: 'Electricity', val: b.electricity_amount, color: 'bg-amber-50 text-amber-800' },
                    { label: 'Water', val: b.water_amount, color: 'bg-blue-50 text-blue-800' },
                    { label: 'Other', val: b.other_amount, color: 'bg-slate-50 text-slate-700' },
                  ].map((item) => (
                    <div key={item.label} className={`rounded-xl p-3 ${item.color}`}>
                      <div className="text-xs opacity-70">{item.label}</div>
                      <div className="mt-1 font-bold">{fmt(item.val)}</div>
                    </div>
                  ))}
                </div>

                {billPayments.length > 0 ? (
                  <div className="border-t border-slate-100 pt-3">
                    <div className="text-xs font-semibold text-slate-700 mb-2">Payment history</div>
                    <div className="space-y-2">
                      {billPayments.slice(0, 5).map((p) => (
                        <div key={p.id} className="flex items-center justify-between gap-3 text-xs bg-slate-50 rounded-lg px-3 py-2">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge>{p.payment_method.toUpperCase()}</Badge>
                              <span className="text-slate-600">{p.paid_at.slice(0, 10)}</span>
                              {p.reference ? <span className="truncate font-mono text-slate-500">{p.reference}</span> : null}
                            </div>
                          </div>
                          <div className="shrink-0 font-bold text-emerald-700">{fmt(p.amount)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {membership.isLeader && !b.is_paid ? (
                  <div className="border-t border-slate-100 pt-3">
                    <div className="text-xs font-semibold text-slate-700 mb-3">Record payment (leader)</div>
                    <form action={recordPayment} className="grid grid-cols-2 gap-3 md:grid-cols-4">
                      <input type="hidden" name="room_bill_id" value={b.id} />

                      <Field label="Method">
                        <Select name="payment_method" defaultValue="upi">
                          <option value="upi">UPI</option>
                          <option value="cash">Cash</option>
                          <option value="bank">Bank</option>
                        </Select>
                      </Field>

                      <Field label="Amount (₹)">
                        <Input
                          name="amount"
                          inputMode="decimal"
                          defaultValue={String(b.balance_due)}
                          placeholder="Amount"
                          required
                        />
                      </Field>

                      <Field label="Reference">
                        <Input name="reference" placeholder="Txn ID (optional)" />
                      </Field>

                      <div className="col-span-2 flex items-end justify-end md:col-span-1">
                        <Button type="submit">Submit</Button>
                      </div>
                    </form>
                  </div>
                ) : null}

                {!b.is_paid && b.balance_due > 0 ? (
                  <div className="border-t border-slate-100 pt-3">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-indigo-50/50 p-4 rounded-xl border border-indigo-100/50">
                      <div>
                        <div className="text-sm font-medium text-indigo-900">Pay Online</div>
                        <div className="text-xs text-indigo-700 mt-0.5">Secure payment via Razorpay</div>
                      </div>
                      <RazorpayButton amount={b.balance_due} roomBillId={b.id} />
                    </div>
                  </div>
                ) : null}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

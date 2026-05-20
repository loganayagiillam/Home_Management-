import { requireAdmin } from '@/lib/auth/server';
import { recordPaymentAdmin } from './actions';
import type { Metadata } from 'next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page';
import { Select } from '@/components/ui/select';
import { decodeSearchParam, resolveSearchParams } from '@/lib/flash';

export const metadata: Metadata = { title: 'Payments' };
export const dynamic = 'force-dynamic';

type BillChoice = {
  id: string;
  room_id: string;
  bill_month: string;
  total_amount: number;
  paid_amount: number;
  balance_due: number;
  is_paid: boolean;
};

type RoomRow = {
  id: string;
  room_number: string;
};

type PaymentRow = {
  id: string;
  room_bill_id: string;
  payment_method: string;
  amount: number;
  reference: string | null;
  paid_at: string;
};

export default async function AdminPaymentsPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }> | { error?: string };
}) {
  const { supabase } = await requireAdmin();

  const sp = await resolveSearchParams(searchParams);
  const flashError = decodeSearchParam(sp?.error);

  const [{ data: rooms }, { data: bills }, { data: payments }] = await Promise.all([
    supabase
      .from('rooms')
      .select('id, room_number')
      .order('room_number', { ascending: true }),
    supabase
      .from('room_bill_summary')
      .select('id, room_id, bill_month, total_amount, paid_amount, balance_due, is_paid')
      .order('bill_month', { ascending: false })
      .limit(50),
    supabase
      .from('payments')
      .select('id, room_bill_id, payment_method, amount, reference, paid_at')
      .order('paid_at', { ascending: false })
      .limit(50),
  ]);

  const roomsSafe = (rooms ?? []) as RoomRow[];
  const roomNumberById = new Map<string, string>();
  for (const r of roomsSafe) roomNumberById.set(r.id, r.room_number);

  const billsSafe = (bills ?? []) as BillChoice[];
  const paymentsSafe = (payments ?? []) as PaymentRow[];

  const billById = new Map<string, BillChoice>();
  for (const b of billsSafe) billById.set(b.id, b);

  const fmt = (n: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

  const totalCollected = paymentsSafe.reduce((s, p) => s + p.amount, 0);
  const unpaidCount = billsSafe.filter((b) => !b.is_paid).length;

  return (
    <div className="space-y-6">
      <PageHeader title="Payments" description="Record and track all tenant payments." />

      {flashError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{flashError}</div>
      ) : null}

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <Card>
          <div className="text-xs text-slate-600">Total collected</div>
          <div className="mt-2 text-lg font-semibold">{fmt(totalCollected)}</div>
        </Card>
        <Card>
          <div className="text-xs text-slate-600">Transactions</div>
          <div className="mt-2 text-lg font-semibold">{paymentsSafe.length}</div>
        </Card>
        <Card className="col-span-2 md:col-span-1">
          <div className="text-xs text-slate-600">Unpaid bills</div>
          <div className="mt-2 text-lg font-semibold">{unpaidCount}</div>
        </Card>
      </div>

      {/* ── Record Payment Form ── */}
      <Card>
        <h2 className="text-sm font-semibold">Record payment</h2>
        <form action={recordPaymentAdmin} className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-5">
          <div className="col-span-2 md:col-span-2">
            <Field label="Bill (room · month)">
              <Select name="room_bill_id" defaultValue="" required>
                <option value="" disabled>
                  Select bill
                </option>
                {billsSafe.map((b) => {
                  const roomNumber = roomNumberById.get(b.room_id) ?? b.room_id;
                  return (
                    <option key={b.id} value={b.id}>
                      Room {roomNumber} · {b.bill_month.slice(0, 7)} · Due {fmt(b.balance_due)}
                    </option>
                  );
                })}
              </Select>
            </Field>
          </div>

          <Field label="Method">
            <Select name="payment_method" defaultValue="upi">
              <option value="upi">UPI</option>
              <option value="cash">Cash</option>
              <option value="bank">Bank transfer</option>
            </Select>
          </Field>

          <Field label="Amount (₹)">
            <Input name="amount" inputMode="decimal" placeholder="0" required />
          </Field>

          <Field label="Reference">
            <Input name="reference" placeholder="UPI txn ID, etc." />
          </Field>

          <Field label="Date & time">
            <Input name="paid_at" type="datetime-local" />
          </Field>

          <div className="col-span-2 flex justify-end md:col-span-5">
            <Button id="record-payment-btn" type="submit">
              Record payment
            </Button>
          </div>
        </form>
        <p className="mt-3 text-xs text-slate-600">Tip: Room leaders can also record payments from the tenant Bills page.</p>
      </Card>

      {/* ── Payments Table ── */}
      <h2 className="text-sm font-semibold">Recent payments ({paymentsSafe.length})</h2>

      {paymentsSafe.length === 0 ? (
        <Card>
          <div className="text-sm text-slate-600">No payments recorded yet.</div>
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs text-slate-600">
                <th className="py-2 pr-3">Date</th>
                <th className="py-2 pr-3">Room</th>
                <th className="py-2 pr-3">Month</th>
                <th className="py-2 pr-3">Method</th>
                <th className="py-2 pr-3">Amount</th>
                <th className="py-2 pr-3">Reference</th>
                <th className="py-2">Remaining due</th>
              </tr>
            </thead>
            <tbody>
              {paymentsSafe.map((p) => {
                const bill = billById.get(p.room_bill_id);
                const roomNumber = bill ? roomNumberById.get(bill.room_id) ?? bill.room_id : '—';
                const month = bill?.bill_month?.slice(0, 7) ?? '—';
                const due = bill?.balance_due;

                return (
                  <tr key={p.id} className="border-b border-slate-100 align-top last:border-0">
                    <td className="py-2 pr-3 font-medium">{p.paid_at.slice(0, 10)}</td>
                    <td className="py-2 pr-3">Room {roomNumber}</td>
                    <td className="py-2 pr-3">{month}</td>
                    <td className="py-2 pr-3">
                      <Badge>{p.payment_method.toUpperCase()}</Badge>
                    </td>
                    <td className="py-2 pr-3 font-semibold">{fmt(p.amount)}</td>
                    <td className="py-2 pr-3 font-mono text-xs text-slate-600">{p.reference || '—'}</td>
                    <td className="py-2">{typeof due === 'number' ? fmt(due) : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

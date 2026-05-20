import { requireAdmin } from '@/lib/auth/server';
import { upsertRoomBill } from './actions';
import type { Metadata } from 'next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page';
import { Select } from '@/components/ui/select';
import { decodeSearchParam, resolveSearchParams } from '@/lib/flash';

export const metadata: Metadata = { title: 'Bills' };
export const dynamic = 'force-dynamic';

type RoomRow = {
  id: string;
  room_number: string;
};

type BillSummaryRow = {
  id: string;
  room_id: string;
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

function monthInputValueFromBillMonth(billMonth: string) {
  return billMonth.slice(0, 7);
}

function fmtMonth(iso: string) {
  try {
    return new Date(iso + '-01').toLocaleDateString('en-IN', { year: 'numeric', month: 'long' });
  } catch {
    return iso.slice(0, 7);
  }
}

export default async function AdminBillsPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }> | { error?: string };
}) {
  const { supabase } = await requireAdmin();

  const sp = await resolveSearchParams(searchParams);
  const flashError = decodeSearchParam(sp?.error);

  const [{ data: rooms }, { data: billSummary }] = await Promise.all([
    supabase
      .from('rooms')
      .select('id, room_number')
      .order('room_number', { ascending: true }),
    supabase
      .from('room_bill_summary')
      .select('id, room_id, bill_month, rent_amount, electricity_amount, water_amount, other_amount, total_amount, paid_amount, balance_due, is_paid')
      .order('bill_month', { ascending: false })
      .limit(30),
  ]);

  const roomsSafe = (rooms ?? []) as RoomRow[];
  const roomById = new Map<string, string>();
  for (const r of roomsSafe) roomById.set(r.id, r.room_number);

  const billsSafe = (billSummary ?? []) as BillSummaryRow[];

  const fmt = (n: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

  return (
    <div className="space-y-6">
      <PageHeader title="Bills" description="Create one bill per room per month (enter amounts directly)." />

      {flashError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{flashError}</div>
      ) : null}

      {/* ── Create / Update Bill ── */}
      <Card>
        <h2 className="text-sm font-semibold">Create / Update Bill</h2>
        <form action={upsertRoomBill} className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          <Field label="Room">
            <Select name="room_id" defaultValue="" required>
              <option value="" disabled>
                Select room
              </option>
              {roomsSafe.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.room_number}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Month">
            <Input name="bill_month" type="month" required />
          </Field>
          <Field label="Rent (₹)">
            <Input name="rent_amount" inputMode="decimal" placeholder="0" defaultValue="0" required />
          </Field>
          <Field label="EB (₹)">
            <Input name="electricity_amount" inputMode="decimal" placeholder="0" defaultValue="0" required />
          </Field>
          <Field label="Water (₹)">
            <Input name="water_amount" inputMode="decimal" placeholder="0" defaultValue="0" required />
          </Field>
          <Field label="Other (₹)">
            <Input name="other_amount" inputMode="decimal" placeholder="0" defaultValue="0" required />
          </Field>
          <div className="col-span-2 flex items-end md:col-span-3 lg:col-span-1">
            <Button className="w-full" type="submit">
              Save bill
            </Button>
          </div>
        </form>
      </Card>

      {/* ── Bills List ── */}
      <h2 className="text-sm font-semibold">Recent bills ({billsSafe.length})</h2>

      {billsSafe.length === 0 ? (
        <Card>
          <div className="text-sm text-slate-600">No bills yet.</div>
        </Card>
      ) : (
        <div className="space-y-4">
          {billsSafe.map((b) => {
            const roomNumber = roomById.get(b.room_id) ?? b.room_id;
            return (
              <Card key={b.id} className="space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold">Room {roomNumber}</div>
                    <div className="mt-1 text-sm text-slate-600">{fmtMonth(b.bill_month)}</div>
                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-600">
                      <span>Rent: {fmt(b.rent_amount)}</span>
                      <span>EB: {fmt(b.electricity_amount)}</span>
                      <span>Water: {fmt(b.water_amount)}</span>
                      <span>Other: {fmt(b.other_amount)}</span>
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    <div className="text-xs text-slate-600">Balance due</div>
                    <div className="mt-1 text-lg font-semibold">{fmt(b.balance_due)}</div>
                    <div className="mt-2 flex justify-end">
                      <Badge>{b.is_paid ? 'paid' : 'unpaid'}</Badge>
                    </div>
                  </div>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  <div>
                    <div className="text-xs font-semibold text-slate-600">Update amounts</div>
                    <form action={upsertRoomBill} className="mt-3 space-y-3">
                      <input type="hidden" name="room_id" value={b.room_id} />
                      <input type="hidden" name="bill_month" value={monthInputValueFromBillMonth(b.bill_month)} />
                      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                        <Field label="Rent">
                          <Input name="rent_amount" inputMode="decimal" defaultValue={String(b.rent_amount)} required />
                        </Field>
                        <Field label="EB">
                          <Input name="electricity_amount" inputMode="decimal" defaultValue={String(b.electricity_amount)} required />
                        </Field>
                        <Field label="Water">
                          <Input name="water_amount" inputMode="decimal" defaultValue={String(b.water_amount)} required />
                        </Field>
                        <Field label="Other">
                          <Input name="other_amount" inputMode="decimal" defaultValue={String(b.other_amount)} required />
                        </Field>
                      </div>
                      <Button variant="secondary" type="submit">
                        Update
                      </Button>
                    </form>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

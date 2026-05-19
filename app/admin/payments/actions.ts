'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/auth/server';
import { getErrorMessage } from '@/lib/flash';

function toMoney(value: FormDataEntryValue | null) {
  const str = typeof value === 'string' ? value.trim() : '';
  const num = Number(str);
  return Number.isFinite(num) ? num : null;
}

export async function recordPaymentAdmin(formData: FormData) {
  const { supabase, user } = await requireAdmin();

  try {

  const roomBillId = String(formData.get('room_bill_id') ?? '').trim();
  const paymentMethod = String(formData.get('payment_method') ?? '').trim();
  const amount = toMoney(formData.get('amount'));
  const reference = String(formData.get('reference') ?? '').trim();
  const paidAt = String(formData.get('paid_at') ?? '').trim();

  if (!roomBillId) throw new Error('Bill is required');
  if (paymentMethod !== 'cash' && paymentMethod !== 'upi' && paymentMethod !== 'bank') {
    throw new Error('Invalid payment method');
  }
  if (amount == null || amount <= 0) throw new Error('Amount must be > 0');

  const insertPayload: {
    room_bill_id: string;
    paid_by: string | null;
    recorded_by: string;
    payment_method: string;
    amount: number;
    reference: string | null;
    paid_at?: string;
  } = {
    room_bill_id: roomBillId,
    paid_by: null,
    recorded_by: user.id,
    payment_method: paymentMethod,
    amount,
    reference: reference ? reference : null,
  };

  // If admin sets a date/time, honor it (expects datetime-local value).
  if (paidAt) {
    // Browser gives local time; storing as timestamptz string is ok.
    insertPayload.paid_at = paidAt;
  }

  const { error } = await supabase.from('payments').insert(insertPayload);
  if (error) throw new Error(error.message);

  revalidatePath('/admin/payments');
  revalidatePath('/admin/bills');
  revalidatePath('/app/bills');

  } catch (e) {
    redirect(`/admin/payments?error=${encodeURIComponent(getErrorMessage(e))}`);
  }
}

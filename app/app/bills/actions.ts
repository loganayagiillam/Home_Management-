'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth/server';
import { getActiveMembershipForCurrentUser } from '@/lib/room/server';
import { getErrorMessage } from '@/lib/flash';

function toMoney(value: FormDataEntryValue | null) {
  const str = typeof value === 'string' ? value.trim() : '';
  const num = Number(str);
  return Number.isFinite(num) ? num : null;
}

export async function recordPayment(formData: FormData) {
  const { supabase, user } = await requireUser();
  const membership = await getActiveMembershipForCurrentUser();

  if (!membership) redirect(`/app/bills?error=${encodeURIComponent('No room membership')}`);
  if (!membership.isLeader) redirect(`/app/bills?error=${encodeURIComponent('Only the room leader can record payments')}`);

  try {

  const roomBillId = String(formData.get('room_bill_id') ?? '').trim();
  const paymentMethod = String(formData.get('payment_method') ?? '').trim();
  const amount = toMoney(formData.get('amount'));
  const reference = String(formData.get('reference') ?? '').trim();

  if (!roomBillId) throw new Error('Missing bill id');
  if (paymentMethod !== 'cash' && paymentMethod !== 'upi' && paymentMethod !== 'bank') {
    throw new Error('Invalid payment method');
  }
  if (amount == null || amount <= 0) throw new Error('Amount must be > 0');

  const { data: bill, error: billError } = await supabase
    .from('room_bills')
    .select('id, room_id')
    .eq('id', roomBillId)
    .maybeSingle();

  if (billError) throw new Error(billError.message);
  if (!bill) throw new Error('Bill not found');
  if (bill.room_id !== membership.roomId) throw new Error('Bill does not belong to your room');

  const { error } = await supabase.from('payments').insert({
    room_bill_id: roomBillId,
    paid_by: user.id,
    recorded_by: user.id,
    payment_method: paymentMethod,
    amount,
    reference: reference ? reference : null,
  });

  if (error) throw new Error(error.message);

  revalidatePath('/app/bills');

  } catch (e) {
    redirect(`/app/bills?error=${encodeURIComponent(getErrorMessage(e))}`);
  }
}

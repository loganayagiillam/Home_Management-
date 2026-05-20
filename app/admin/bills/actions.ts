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

function monthToBillMonth(month: string) {
  const trimmed = month.trim();
  if (!/^\d{4}-\d{2}$/.test(trimmed)) throw new Error('Invalid month');
  return `${trimmed}-01`;
}

export async function upsertRoomBill(formData: FormData) {
  const { supabase, user } = await requireAdmin();

  try {

  const roomId = String(formData.get('room_id') ?? '').trim();
  const month = String(formData.get('bill_month') ?? '').trim();

  const rentAmount = toMoney(formData.get('rent_amount'));
  const electricityAmount = toMoney(formData.get('electricity_amount'));
  const waterAmount = toMoney(formData.get('water_amount'));
  const otherAmount = toMoney(formData.get('other_amount'));

  if (!roomId) throw new Error('Room is required');
  if (!month) throw new Error('Month is required');
  if (rentAmount == null || rentAmount < 0) throw new Error('Rent must be >= 0');
  if (electricityAmount == null || electricityAmount < 0) throw new Error('EB must be >= 0');
  if (waterAmount == null || waterAmount < 0) throw new Error('Water must be >= 0');
  if (otherAmount == null || otherAmount < 0) throw new Error('Other must be >= 0');

  const billMonth = monthToBillMonth(month);

  const { error } = await supabase.from('room_bills').upsert(
    {
      room_id: roomId,
      bill_month: billMonth,
      rent_amount: rentAmount,
      electricity_amount: electricityAmount,
      water_amount: waterAmount,
      other_amount: otherAmount,
      created_by: user.id,
    },
    { onConflict: 'room_id,bill_month' },
  );

  if (error) throw new Error(error.message);

  revalidatePath('/admin/bills');

  } catch (e) {
    redirect(`/admin/bills?error=${encodeURIComponent(getErrorMessage(e))}`);
  }
}

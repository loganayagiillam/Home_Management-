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
  const waterAmount = toMoney(formData.get('water_amount'));
  const otherAmount = toMoney(formData.get('other_amount'));

  if (!roomId) throw new Error('Room is required');
  if (!month) throw new Error('Month is required');
  if (rentAmount == null || rentAmount < 0) throw new Error('Rent must be >= 0');
  if (waterAmount == null || waterAmount < 0) throw new Error('Water must be >= 0');
  if (otherAmount == null || otherAmount < 0) throw new Error('Other must be >= 0');

  const billMonth = monthToBillMonth(month);

  const { error } = await supabase.from('room_bills').upsert(
    {
      room_id: roomId,
      bill_month: billMonth,
      rent_amount: rentAmount,
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

function toInt(value: FormDataEntryValue | null) {
  const str = typeof value === 'string' ? value.trim() : '';
  const num = Number(str);
  return Number.isFinite(num) ? Math.trunc(num) : null;
}

export async function addElectricityReading(formData: FormData) {
  const { supabase, user } = await requireAdmin();

  try {

  const roomBillId = String(formData.get('room_bill_id') ?? '').trim();
  const previousReading = toInt(formData.get('previous_reading'));
  const currentReading = toInt(formData.get('current_reading'));
  const unitRate = toMoney(formData.get('unit_rate'));

  if (!roomBillId) throw new Error('Missing room bill id');
  if (previousReading == null || previousReading < 0) throw new Error('Previous reading must be >= 0');
  if (currentReading == null || currentReading < previousReading) {
    throw new Error('Current reading must be >= previous reading');
  }
  if (unitRate == null || unitRate < 0) throw new Error('Unit rate must be >= 0');

  const { data: created, error } = await supabase
    .from('electricity_readings')
    .insert({
      room_bill_id: roomBillId,
      previous_reading: previousReading,
      current_reading: currentReading,
      unit_rate: unitRate,
      entered_by: user.id,
    })
    .select('amount')
    .single();

  if (error) throw new Error(error.message);

  const amount = created?.amount;
  if (typeof amount === 'number') {
    const { error: updateError } = await supabase
      .from('room_bills')
      .update({ electricity_amount: amount })
      .eq('id', roomBillId);
    if (updateError) throw new Error(updateError.message);
  }

  revalidatePath('/admin/bills');

  } catch (e) {
    redirect(`/admin/bills?error=${encodeURIComponent(getErrorMessage(e))}`);
  }
}

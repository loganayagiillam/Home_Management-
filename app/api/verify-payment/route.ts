import { NextResponse } from 'next/server';
import crypto from 'crypto';
import Razorpay from 'razorpay';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getActiveMembershipForCurrentUser } from '@/lib/room/server';

function getErrorString(error: unknown) {
  if (error instanceof Error) return error.message;
  return String(error);
}

export async function POST(req: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) {
      return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await req.json()) as unknown;

    const razorpay_order_id = (body as { razorpay_order_id?: unknown }).razorpay_order_id;
    const razorpay_payment_id = (body as { razorpay_payment_id?: unknown }).razorpay_payment_id;
    const razorpay_signature = (body as { razorpay_signature?: unknown }).razorpay_signature;
    const room_bill_id = (body as { room_bill_id?: unknown }).room_bill_id;

    if (
      typeof razorpay_order_id !== 'string' ||
      typeof razorpay_payment_id !== 'string' ||
      typeof razorpay_signature !== 'string'
    ) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (typeof room_bill_id !== 'string' || !room_bill_id.trim()) {
      return NextResponse.json({ error: 'Missing room_bill_id' }, { status: 400 });
    }

    const keyId = process.env.RAZORPAY_KEY_ID;
    const secret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !secret) {
      return NextResponse.json({ error: 'Razorpay is not configured' }, { status: 500 });
    }

    const generated_signature = crypto
      .createHmac('sha256', secret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (generated_signature !== razorpay_signature) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    const razorpay = new Razorpay({
      key_id: keyId,
      key_secret: secret,
    });

    // Ensure the order receipt matches the room bill id we are recording.
    const order = await razorpay.orders.fetch(razorpay_order_id);
    const receipt = (order as unknown as { receipt?: unknown }).receipt;
    if (typeof receipt !== 'string' || receipt.trim() !== room_bill_id.trim()) {
      return NextResponse.json({ error: 'Order receipt mismatch' }, { status: 400 });
    }

    const payment = await razorpay.payments.fetch(razorpay_payment_id);
    if (!payment || payment.status !== 'captured') {
      return NextResponse.json({ error: 'Payment not captured or invalid' }, { status: 400 });
    }

    const amountPaiseRaw = (payment as unknown as { amount?: unknown }).amount;
    const amountPaise = typeof amountPaiseRaw === 'number' ? amountPaiseRaw : Number(amountPaiseRaw);

    if (!Number.isFinite(amountPaise) || amountPaise <= 0) {
      return NextResponse.json({ error: 'Invalid payment amount' }, { status: 400 });
    }

    const actualAmountPaid = amountPaise / 100;

    const membership = await getActiveMembershipForCurrentUser(supabase, user.id);
    if (!membership?.roomId) {
      return NextResponse.json({ error: 'You are not assigned to a room' }, { status: 400 });
    }

    const { data: bill, error: billError } = await supabase
      .from('room_bill_summary')
      .select('id, room_id, balance_due, is_paid')
      .eq('id', room_bill_id.trim())
      .maybeSingle();

    if (billError || !bill) {
      return NextResponse.json({ error: 'Bill not found' }, { status: 404 });
    }

    if (bill.room_id !== membership.roomId) {
      return NextResponse.json({ error: 'Unauthorized to record payment for this bill' }, { status: 403 });
    }

    if (bill.is_paid) {
      return NextResponse.json({ success: true, message: 'Bill already marked paid' });
    }

    // Prevent replay attacks
    const { data: existingPayment } = await supabase
      .from('payments')
      .select('id')
      .eq('reference', razorpay_payment_id)
      .maybeSingle();

    if (existingPayment) {
      return NextResponse.json({ success: true, message: 'Payment already recorded' });
    }

    const { error } = await supabase.from('payments').insert({
      room_bill_id: room_bill_id.trim(),
      paid_by: user.id,
      recorded_by: user.id,
      payment_method: 'upi',
      amount: actualAmountPaid,
      reference: razorpay_payment_id,
    });

    if (error) {
      console.error('Error recording payment:', error);
      return NextResponse.json({ error: 'Failed to record payment' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Error verifying payment:', error);
    const message = getErrorString(error);
    if (message.toLowerCase().includes('unexpected end of json')) {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

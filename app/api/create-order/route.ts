import { NextResponse } from 'next/server';
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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const membership = await getActiveMembershipForCurrentUser(supabase, user.id);

    const body = (await req.json()) as unknown;
    const roomBillId =
      typeof (body as { room_bill_id?: unknown }).room_bill_id === 'string'
        ? (body as { room_bill_id: string }).room_bill_id
        : typeof (body as { receipt?: unknown }).receipt === 'string'
          ? (body as { receipt: string }).receipt
          : null;

    if (!roomBillId) {
      return NextResponse.json({ error: 'Missing room_bill_id' }, { status: 400 });
    }

    // Verify bill belongs to user's room and fetch balance_due
    const { data: bill, error: billError } = await supabase
      .from('room_bill_summary')
      .select('id, room_id, balance_due, is_paid')
      .eq('id', roomBillId)
      .maybeSingle();

    if (billError || !bill) {
      return NextResponse.json({ error: 'Bill not found' }, { status: 404 });
    }

    if (membership?.roomId !== bill.room_id) {
      return NextResponse.json({ error: 'Unauthorized to pay this bill' }, { status: 403 });
    }

    if (bill.is_paid || bill.balance_due <= 0) {
      return NextResponse.json({ error: 'Bill is already paid' }, { status: 400 });
    }

    const amountInPaise = Math.round(bill.balance_due * 100);

    if (amountInPaise < 100) {
      return NextResponse.json({ error: 'Amount must be at least 1 Rupee' }, { status: 400 });
    }

    const keyId = process.env.RAZORPAY_KEY_ID;
    const secret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !secret) {
      return NextResponse.json({ error: 'Razorpay is not configured' }, { status: 500 });
    }

    const razorpay = new Razorpay({
      key_id: keyId,
      key_secret: secret,
    });

    const options = {
      amount: amountInPaise,
      currency: 'INR',
      receipt: roomBillId,
    };

    const order = await razorpay.orders.create(options);

    return NextResponse.json({
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
    });
  } catch (error: unknown) {
    console.error('Error creating Razorpay order:', error);
    const message = getErrorString(error);
    if (message.toLowerCase().includes('unexpected end of json')) {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

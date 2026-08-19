import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

// Toss webhook payloads should not be trusted at face value — the docs recommend
// re-fetching the payment by paymentKey to confirm its real status before acting.
// https://docs.tosspayments.com/guides/v2/webhook/overview
async function confirmPaymentStatus(paymentKey: string): Promise<string | null> {
  const res = await fetch(`https://api.tosspayments.com/v1/payments/${paymentKey}`, {
    headers: {
      Authorization: `Basic ${Buffer.from(`${process.env.TOSS_SECRET_KEY}:`).toString('base64')}`,
    },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.status as string;
}

export async function POST(request: Request) {
  const body = await request.json();
  const paymentKey: string | undefined = body?.data?.paymentKey;
  const customerKey: string | undefined = body?.data?.customerKey;

  if (!paymentKey || !customerKey) {
    return NextResponse.json({ received: true });
  }

  const status = await confirmPaymentStatus(paymentKey);
  const supabase = createServiceClient();

  // A failed/canceled recurring charge downgrades the subscriber back to free.
  if (status === 'CANCELED' || status === 'ABORTED' || status === 'EXPIRED') {
    await supabase
      .from('profiles')
      .update({ subscription: 'free' })
      .eq('toss_customer_key', customerKey);
  }

  return NextResponse.json({ received: true });
}

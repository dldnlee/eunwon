import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { chargeBillingKey, PRO_MONTHLY_PRICE_KRW } from '@/lib/payments';
import type { Profile } from '@/lib/types';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

/**
 * Monthly job (see vercel.json): charges every stored billingKey for the
 * recurring Pro subscription. On failure, downgrades that user to free —
 * mirrors the plan's "on failure/cancellation: downgrade to free tier" rule.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClient();
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('subscription', 'pro')
    .not('toss_billing_key', 'is', null);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let charged = 0;
  let downgraded = 0;

  for (const profile of (profiles ?? []) as Profile[]) {
    try {
      await chargeBillingKey({
        billingKey: profile.toss_billing_key!,
        customerKey: profile.toss_customer_key!,
        orderId: `${profile.id}-${Date.now()}`,
        orderName: 'Eunwon AI Pro 정기결제',
        amount: PRO_MONTHLY_PRICE_KRW,
      });
      charged++;
    } catch (err) {
      console.error(`Recurring charge failed for profile ${profile.id}:`, err);
      await supabase.from('profiles').update({ subscription: 'free' }).eq('id', profile.id);
      downgraded++;
    }
  }

  return NextResponse.json({ charged, downgraded });
}

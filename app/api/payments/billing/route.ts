import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { issueBillingKey, chargeBillingKey, PRO_MONTHLY_PRICE_KRW } from '@/lib/payments';

/**
 * Toss redirects the browser here (successUrl) after the user registers a card,
 * carrying `authKey` + `customerKey`. We exchange those for a reusable billingKey,
 * charge the first month immediately, then mark the user as Pro.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const authKey = searchParams.get('authKey');
  const customerKey = searchParams.get('customerKey');

  if (!authKey || !customerKey) {
    return NextResponse.redirect(`${origin}/settings?upgrade=failed`);
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(`${origin}/login`);
  }

  try {
    const { billingKey } = await issueBillingKey(authKey, customerKey);

    await chargeBillingKey({
      billingKey,
      customerKey,
      orderId: `${user.id}-${Date.now()}`,
      orderName: 'Eunwon AI Pro 정기결제',
      amount: PRO_MONTHLY_PRICE_KRW,
    });

    await supabase
      .from('profiles')
      .update({
        subscription: 'pro',
        toss_billing_key: billingKey,
        toss_customer_key: customerKey,
      })
      .eq('id', user.id);

    return NextResponse.redirect(`${origin}/settings?upgrade=success`);
  } catch (err) {
    console.error('Billing key issuance/charge failed:', err);
    return NextResponse.redirect(`${origin}/settings?upgrade=failed`);
  }
}

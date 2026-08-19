// 토스페이먼츠 정기결제 (빌링) integration.
// Docs: https://docs.tosspayments.com/guides/v2/billing/integration
//
// Flow: client collects card info via 토스페이먼츠 SDK → redirected back with
// `authKey` + `customerKey` → server exchanges those for a `billingKey` →
// billingKey is stored and charged monthly by the cron job.

const TOSS_API_BASE = 'https://api.tosspayments.com/v1';

// Toss requires a registered business (사업자등록증) to approve an account — until that's
// approved, NEXT_PUBLIC_TOSS_CLIENT_KEY is left unset and every upgrade entry point in the
// UI checks this flag to hide the paid flow rather than send users into a broken checkout.
export const TOSS_ENABLED = Boolean(process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY);

function tossAuthHeader(): string {
  const secretKey = process.env.TOSS_SECRET_KEY!;
  return `Basic ${Buffer.from(`${secretKey}:`).toString('base64')}`;
}

export interface TossBillingKeyResult {
  billingKey: string;
  customerKey: string;
  card: { company: string; number: string };
}

/** Exchange an authKey (from the client-side billing auth redirect) for a reusable billingKey. */
export async function issueBillingKey(
  authKey: string,
  customerKey: string
): Promise<TossBillingKeyResult> {
  const res = await fetch(`${TOSS_API_BASE}/billing/authorizations/issue`, {
    method: 'POST',
    headers: {
      Authorization: tossAuthHeader(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ authKey, customerKey }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`Toss billing key issuance failed: ${body.message ?? res.statusText}`);
  }

  const data = await res.json();
  return {
    billingKey: data.billingKey,
    customerKey: data.customerKey,
    card: { company: data.card.company, number: data.card.number },
  };
}

export interface TossChargeResult {
  paymentKey: string;
  orderId: string;
  status: string;
  totalAmount: number;
}

/** Charge a stored billingKey. Called monthly by the billing cron for each Pro subscriber. */
export async function chargeBillingKey(params: {
  billingKey: string;
  customerKey: string;
  orderId: string;
  orderName: string;
  amount: number;
}): Promise<TossChargeResult> {
  const res = await fetch(`${TOSS_API_BASE}/billing/${params.billingKey}`, {
    method: 'POST',
    headers: {
      Authorization: tossAuthHeader(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      customerKey: params.customerKey,
      amount: params.amount,
      orderId: params.orderId,
      orderName: params.orderName,
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`Toss charge failed: ${body.message ?? res.statusText}`);
  }

  return res.json();
}

export const PRO_MONTHLY_PRICE_KRW = 39_000;

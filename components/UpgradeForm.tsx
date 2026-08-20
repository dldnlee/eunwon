'use client';

import { useState } from 'react';
import Script from 'next/script';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { CheckCircle2 } from 'lucide-react';

// Toss Payments v1 billing SDK — loaded via <script>, no npm package required.
// Docs: https://docs.tosspayments.com/guides/v2/billing/integration
declare global {
  interface Window {
    TossPayments: (clientKey: string) => {
      requestBillingAuth: (
        method: '카드',
        params: { customerKey: string; successUrl: string; failUrl: string }
      ) => Promise<void>;
    };
  }
}

export function UpgradeForm() {
  const [sdkReady, setSdkReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUpgrade() {
    if (!window.TossPayments) return;
    setLoading(true);
    setError(null);

    try {
      const tossPayments = window.TossPayments(process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY!);
      // customerKey must be stable per user and not contain personal info directly —
      // in production, derive it server-side and pass down instead of using a random value.
      const customerKey = crypto.randomUUID();

      await tossPayments.requestBillingAuth('카드', {
        customerKey,
        successUrl: `${window.location.origin}/api/payments/billing`,
        failUrl: `${window.location.origin}/settings?upgrade=failed`,
      });
      // Browser is redirected to Toss's hosted card-registration page here;
      // control returns via successUrl/failUrl, not this function.
    } catch (err) {
      setError(err instanceof Error ? err.message : '결제 정보를 시작하지 못했어요.');
      setLoading(false);
    }
  }

  return (
    <>
      <Script
        src="https://js.tosspayments.com/v1/payment"
        onLoad={() => setSdkReady(true)}
      />
      <div className="mx-auto max-w-md p-md">
        <Card>
          <CardHeader>
            <CardTitle>Pro 플랜 시작하기</CardTitle>
            <CardDescription>₩39,000/월 · 언제든 해지 가능</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-md">
            <ul className="flex flex-col gap-xs text-body-sm text-charcoal">
              <li className="flex items-center gap-xs">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-success-text" /> 무제한 매칭 결과
              </li>
              <li className="flex items-center gap-xs">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-success-text" /> &ldquo;왜 나에게 맞나요?&rdquo; AI 설명
              </li>
              <li className="flex items-center gap-xs">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-success-text" /> 신청서 초안 작성 도우미
              </li>
              <li className="flex items-center gap-xs">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-success-text" /> 신규 매칭 이메일 알림
              </li>
            </ul>
            {error && (
              <p role="alert" className="text-body-sm text-error">
                {error}
              </p>
            )}
            <Button onClick={handleUpgrade} disabled={!sdkReady || loading} className="w-full">
              {loading ? '이동 중...' : '카드 등록하고 시작하기'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

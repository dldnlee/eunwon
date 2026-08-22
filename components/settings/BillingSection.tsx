'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TOSS_ENABLED } from '@/lib/payments';
import { getPlanStatus, trialDaysLeft } from '@/lib/trial';
import type { Profile } from '@/lib/types';

export function BillingSection({ profile, userCreatedAt }: { profile: Profile; userCreatedAt: string }) {
  const router = useRouter();
  const planStatus = getPlanStatus(profile.subscription, userCreatedAt);
  const daysLeft = planStatus === 'trial' ? trialDaysLeft(userCreatedAt) : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>구독</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-start gap-md sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="flex items-center gap-xs font-medium text-ink">
            현재 플랜: {planStatus === 'pro' ? 'Pro' : planStatus === 'trial' ? '무료체험 중' : '무료'}
            {planStatus === 'pro' && <Badge variant="default">Pro</Badge>}
            {planStatus === 'trial' && <Badge variant="success">체험 중 · D-{daysLeft}</Badge>}
          </p>
          <p className="mt-xxs text-body-sm text-steel">
            {planStatus === 'pro'
              ? '무제한 매칭과 AI 기능을 이용 중이에요.'
              : planStatus === 'trial'
                ? '가입 후 3개월간 Pro 기능(무제한 매칭, AI 설명, 사업계획서 생성, 마감 알림)을 무료로 이용 중이에요. 체험 종료 후에도 계속 이용하려면 결제를 등록해주세요.'
                : TOSS_ENABLED
                  ? '업그레이드하면 무제한 매칭, AI 설명, 사업계획서 생성, 마감 알림을 이용할 수 있어요.'
                  : 'Pro 플랜은 결제 연동 준비 중이에요. 지금은 무료 플랜으로 이용해주세요.'}
          </p>
        </div>
        {planStatus !== 'pro' && TOSS_ENABLED && (
          <Button onClick={() => router.push('/upgrade')} className="w-full shrink-0 sm:w-auto">
            Pro로 업그레이드
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

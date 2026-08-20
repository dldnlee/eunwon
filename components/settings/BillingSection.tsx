'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TOSS_ENABLED } from '@/lib/payments';
import type { Profile } from '@/lib/types';

export function BillingSection({ profile }: { profile: Profile }) {
  const router = useRouter();

  return (
    <Card>
      <CardHeader>
        <CardTitle>구독</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-start gap-md sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="flex items-center gap-xs font-medium text-ink">
            현재 플랜: {profile.subscription === 'pro' ? 'Pro' : '무료'}
            {profile.subscription === 'pro' && <Badge variant="default">Pro</Badge>}
          </p>
          <p className="mt-xxs text-body-sm text-steel">
            {profile.subscription === 'pro'
              ? '무제한 매칭과 AI 기능을 이용 중이에요.'
              : TOSS_ENABLED
                ? '업그레이드하면 무제한 매칭, AI 설명, 사업계획서 생성, 마감 알림을 이용할 수 있어요.'
                : 'Pro 플랜은 결제 연동 준비 중이에요. 지금은 무료 플랜으로 이용해주세요.'}
          </p>
        </div>
        {profile.subscription !== 'pro' && TOSS_ENABLED && (
          <Button onClick={() => router.push('/upgrade')} className="w-full shrink-0 sm:w-auto">
            Pro로 업그레이드
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

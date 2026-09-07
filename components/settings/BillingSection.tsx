import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Profile } from '@/lib/types';

export function BillingSection({ profile, userCreatedAt }: { profile: Profile; userCreatedAt: string }) {
  void profile;
  void userCreatedAt;
  return (
    <Card>
      <CardHeader>
        <CardTitle>구독</CardTitle>
      </CardHeader>
      <CardContent>
        <div>
          <p className="flex items-center gap-xs font-medium text-ink">
            현재 플랜: 무료
            <Badge variant="success">모든 기능 이용 가능</Badge>
          </p>
          <p className="mt-xxs text-body-sm text-steel">
            지금은 무제한 매칭, AI 설명, 사업계획서 생성, 이메일 알림 등 모든 기능을 무료로 이용할 수 있어요.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

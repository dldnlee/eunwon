'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export function NotificationSettingsForm({
  userId,
  initialNotifyEmail,
  isPro,
}: {
  userId: string;
  initialNotifyEmail: boolean;
  isPro: boolean;
}) {
  const [notifyEmail, setNotifyEmail] = useState(initialNotifyEmail);
  const [saving, setSaving] = useState(false);

  async function handleToggle(next: boolean) {
    setNotifyEmail(next);
    setSaving(true);
    const supabase = createClient();
    await supabase.from('profiles').update({ notify_email: next }).eq('id', userId);
    setSaving(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>알림 설정</CardTitle>
        <CardDescription>
          {isPro
            ? '새로운 매칭 지원사업과 저장한 사업의 마감 7일/3일/1일 전 이메일로 알려드려요.'
            : 'Pro 플랜에서 새 매칭 알림과 마감 임박 알림을 이메일로 받을 수 있어요.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <label className="flex min-h-11 cursor-pointer items-center gap-sm text-body-sm text-charcoal">
          <input
            type="checkbox"
            checked={notifyEmail}
            disabled={!isPro || saving}
            onChange={(e) => handleToggle(e.target.checked)}
            className="h-4 w-4 rounded border-hairline accent-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-deep focus-visible:ring-offset-2 disabled:opacity-50"
          />
          이메일 알림 받기
        </label>
      </CardContent>
    </Card>
  );
}

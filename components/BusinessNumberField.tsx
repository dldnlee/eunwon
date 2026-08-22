'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { BusinessStatus, BusinessVerification } from '@/lib/verification/business';

type VerifyState = 'idle' | 'checking' | BusinessStatus | 'error';

/**
 * 사업자등록번호 input with an inline "확인" action against /api/business/verify.
 * Shared by OnboardingForm and settings/ProfileForm so the verify UX (and the
 * "identity/status only, not an eligibility check" disclaimer) stays in one place.
 */
export function BusinessNumberField({
  value,
  onChange,
  initialStatus,
  onVerified,
}: {
  value: string;
  onChange: (value: string) => void;
  initialStatus?: BusinessStatus | null;
  /**
   * Called with the full verify result once a verify call succeeds. The API
   * route also writes straight to the caller's `profiles` row, but during
   * onboarding that row may not exist yet (it's created by the final
   * upsert), so callers that need the result to survive should carry it in
   * their own state and include it in whatever they save next.
   */
  onVerified?: (result: BusinessVerification) => void;
}) {
  const [state, setState] = useState<VerifyState>(initialStatus ?? 'idle');

  async function handleVerify() {
    setState('checking');
    try {
      const res = await fetch('/api/business/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessNumber: value }),
      });
      const data = await res.json();
      if (res.ok) {
        setState(data.status);
        onVerified?.(data);
      } else {
        setState('error');
      }
    } catch {
      setState('error');
    }
  }

  return (
    <div className="flex flex-col gap-xs">
      <Label htmlFor="businessNumber">사업자등록번호</Label>
      <div className="flex gap-xs">
        <Input
          id="businessNumber"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setState('idle');
          }}
          placeholder="000-00-00000"
          className="flex-1"
        />
        <Button
          type="button"
          variant="outline"
          onClick={handleVerify}
          disabled={!value || state === 'checking'}
        >
          {state === 'checking' ? '확인 중...' : '확인'}
        </Button>
      </div>
      {state === 'active' && <Badge variant="success">확인된 사업자예요</Badge>}
      {state === 'suspended' && <Badge variant="warning">휴업 상태인 사업자예요</Badge>}
      {state === 'closed' && <Badge variant="destructive">폐업 처리된 사업자예요</Badge>}
      {state === 'not_found' && (
        <p className="text-caption text-stone">
          일치하는 사업자 정보를 찾을 수 없어요. 새로 등록된 사업자는 반영에 1~2일 걸릴 수 있어요.
        </p>
      )}
      {state === 'error' && (
        <p className="text-caption text-error">확인에 실패했어요. 잠시 후 다시 시도해주세요.</p>
      )}
      <p className="text-caption text-stone">
        실제 존재하는 사업자인지, 휴업·폐업 여부만 확인해요. 지원사업 자격조건과는 별개예요.
      </p>
    </div>
  );
}

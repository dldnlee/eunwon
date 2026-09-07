'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { AuthSplitLayout } from '@/components/AuthSplitLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { trackProductEvent } from '@/lib/telemetry/client';

const PRIVACY_POLICY_VERSION = '2026-08-27';

export function SignupCompletionForm({
  initialName,
  initialCompanyName,
  nextPath,
}: {
  initialName: string;
  initialCompanyName: string;
  nextPath: string;
}) {
  const router = useRouter();
  const nameInputRef = useRef<HTMLInputElement>(null);
  const privacyCheckboxRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(initialName);
  const [companyName, setCompanyName] = useState(initialCompanyName);
  const [privacyConsent, setPrivacyConsent] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [privacyError, setPrivacyError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const nextNameError = name.trim() ? null : '이름을 입력해주세요.';
    const nextPrivacyError = privacyConsent ? null : '개인정보 수집 및 이용 동의가 필요해요.';
    setNameError(nextNameError);
    setPrivacyError(nextPrivacyError);
    setSubmitError(null);

    if (nextNameError || nextPrivacyError) {
      if (nextNameError) nameInputRef.current?.focus();
      else if (nextPrivacyError) privacyCheckboxRef.current?.focus();
      return;
    }

    setLoading(true);
    const consentedAt = new Date().toISOString();
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({
      data: {
        user_name: name.trim(),
        company_name: companyName.trim() || null,
        privacy_consent_at: consentedAt,
        privacy_policy_version: PRIVACY_POLICY_VERSION,
        marketing_consent: marketingConsent,
        marketing_consent_updated_at: consentedAt,
      },
    });

    if (error) {
      setLoading(false);
      setSubmitError('가입 정보를 저장하지 못했어요. 잠시 후 다시 시도해주세요.');
      return;
    }

    trackProductEvent('signup_completed', { method: 'kakao' });
    router.replace(nextPath);
    router.refresh();
  }

  async function handleSwitchAccount() {
    setLoading(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace('/signup');
    router.refresh();
  }

  return (
    <AuthSplitLayout
      title="가입을 마무리해주세요"
      description="맞춤 지원사업을 안내받기 위해 기본 정보를 확인해주세요"
      showHomeLink
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-md" noValidate aria-busy={loading}>
        <div className="flex flex-col gap-xs">
          <Label htmlFor="completionName">이름</Label>
          <Input
            ref={nameInputRef}
            id="completionName"
            autoComplete="name"
            required
            maxLength={50}
            value={name}
            onChange={(event) => setName(event.target.value)}
            error={!!nameError}
            aria-describedby={nameError ? 'completion-name-error' : undefined}
            placeholder="홍길동"
          />
          {nameError && <p id="completion-name-error" role="alert" className="text-caption text-error">{nameError}</p>}
        </div>

        <div className="flex flex-col gap-xs">
          <Label htmlFor="completionCompany">회사명 <span className="font-normal text-stone">(선택)</span></Label>
          <Input
            id="completionCompany"
            autoComplete="organization"
            maxLength={100}
            value={companyName}
            onChange={(event) => setCompanyName(event.target.value)}
            placeholder="회사 또는 팀 이름"
          />
          <p className="text-caption text-stone">예비창업자라면 비워두셔도 돼요.</p>
        </div>

        <div className="flex flex-col gap-xs rounded-lg border border-hairline p-md">
          <div className="flex min-h-11 items-start gap-sm">
            <input
              ref={privacyCheckboxRef}
              id="completionPrivacyConsent"
              type="checkbox"
              checked={privacyConsent}
              onChange={(event) => setPrivacyConsent(event.target.checked)}
              aria-invalid={!!privacyError}
              aria-describedby={privacyError ? 'completion-privacy-error' : undefined}
              className="mt-1 h-4 w-4 shrink-0 accent-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-deep focus-visible:ring-offset-2"
            />
            <label htmlFor="completionPrivacyConsent" className="text-body-sm text-charcoal">
              <span className="font-medium text-ink">[필수]</span> 개인정보 수집 및 이용에 동의합니다.{' '}
              <Link href="/privacy" target="_blank" className="font-medium text-brand-blue-deep hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-deep">
                자세히 보기
              </Link>
            </label>
          </div>
          {privacyError && <p id="completion-privacy-error" role="alert" className="text-caption text-error">{privacyError}</p>}

          <details className="rounded-md bg-surface px-sm py-xs text-caption text-steel">
            <summary className="cursor-pointer font-medium text-charcoal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-deep">개인정보 수집 안내</summary>
            <ul className="mt-xs list-disc space-y-xxs pl-lg">
              <li>수집 항목: 이름, 이메일, 회사명(선택), 동의 기록</li>
              <li>이용 목적: 회원 관리와 맞춤 지원사업 서비스 제공</li>
              <li>보유 기간: 회원 탈퇴 또는 동의 철회 시까지</li>
              <li>필수 항목 동의를 거부할 수 있으나 회원가입은 제한됩니다.</li>
            </ul>
          </details>

          <div className="flex min-h-11 items-start gap-sm">
            <input
              id="completionMarketingConsent"
              type="checkbox"
              checked={marketingConsent}
              onChange={(event) => setMarketingConsent(event.target.checked)}
              className="mt-1 h-4 w-4 shrink-0 accent-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-deep focus-visible:ring-offset-2"
            />
            <label htmlFor="completionMarketingConsent" className="text-body-sm text-charcoal">
              <span className="font-medium text-ink">[선택]</span> 혜택 및 업데이트 소식 수신에 동의합니다.
              <span className="mt-xxs block text-caption text-stone">신규 지원사업과 서비스 소식을 이메일로 보내드려요.</span>
            </label>
          </div>
        </div>

        {submitError && <p role="alert" className="text-body-sm text-error">{submitError}</p>}
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? '저장 중…' : '동의하고 계속하기'}
        </Button>
        <button
          type="button"
          onClick={handleSwitchAccount}
          disabled={loading}
          className="min-h-11 rounded-full px-md text-body-sm-medium text-steel hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-deep focus-visible:ring-offset-2 disabled:opacity-60"
        >
          다른 계정으로 로그인
        </button>
      </form>
    </AuthSplitLayout>
  );
}

'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AuthSplitLayout } from '@/components/AuthSplitLayout';
import { KakaoLoginButton } from '@/components/KakaoLoginButton';
import { CheckCircle2, XCircle } from 'lucide-react';
import { trackProductEvent } from '@/lib/telemetry/client';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PRIVACY_POLICY_VERSION = '2026-08-27';

type FieldErrors = Partial<Record<'name' | 'email' | 'password' | 'confirmPassword' | 'privacy', string>>;

export default function SignupPage() {
  const router = useRouter();
  const nameInputRef = useRef<HTMLInputElement>(null);
  const privacyCheckboxRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [privacyConsent, setPrivacyConsent] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const emailFormatValid = EMAIL_PATTERN.test(email);
  const confirmationState = confirmPassword.length === 0
    ? 'empty'
    : password.length < 6
      ? 'password-invalid'
      : password === confirmPassword
        ? 'match'
        : 'mismatch';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const nextErrors: FieldErrors = {};

    if (!name.trim()) nextErrors.name = '이름을 입력해주세요.';
    if (!EMAIL_PATTERN.test(email)) {
      nextErrors.email = '올바른 이메일 주소를 입력해주세요.';
    }
    if (password.length < 6) {
      nextErrors.password = '비밀번호는 6자 이상이어야 해요.';
    }
    if (password !== confirmPassword) {
      nextErrors.confirmPassword = '비밀번호가 일치하지 않아요.';
    }
    if (!privacyConsent) {
      nextErrors.privacy = '개인정보 수집 및 이용 동의가 필요해요.';
    }
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      if (nextErrors.name) nameInputRef.current?.focus();
      else if (nextErrors.privacy) privacyCheckboxRef.current?.focus();
      return;
    }

    setLoading(true);

    const supabase = createClient();
    const consentedAt = new Date().toISOString();
    const { data, error: signupError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        data: {
          user_name: name.trim(),
          company_name: companyName.trim() || null,
          privacy_consent_at: consentedAt,
          privacy_policy_version: PRIVACY_POLICY_VERSION,
          marketing_consent: marketingConsent,
          marketing_consent_updated_at: consentedAt,
        },
      },
    });

    setLoading(false);

    if (signupError) {
      setError('가입을 완료하지 못했어요. 잠시 후 다시 시도해주세요.');
      return;
    }

    // Email confirmation disabled in Supabase project settings → session exists immediately
    if (data.session) {
      trackProductEvent('signup_completed', { method: 'email' });
      router.push('/onboard');
      router.refresh();
      return;
    }

    // Keep this response identical for new and existing addresses. Supabase intentionally
    // obscures duplicate signups, and the UI must not turn that into an account-discovery signal.
    setSent(true);
  }

  return (
    <AuthSplitLayout
      title="회원가입"
      description="가입하고 모든 지원사업 매칭과 AI 기능을 무료로 이용해보세요"
      showHomeLink
    >
      {sent ? (
        <div
          role="status"
          className="flex flex-col items-start gap-sm rounded-md bg-success-bg px-md py-sm"
        >
          <p className="text-body-sm text-success-text">
            가입 가능한 주소라면 <strong>{email}</strong>로 인증 안내를 보내드려요. 메일함을
            확인해주세요.
          </p>
          <p className="text-caption text-success-text">
            이미 가입한 계정이라면 새 메일이 오지 않을 수 있어요. 기존 비밀번호로 로그인해
            주세요.
          </p>
          <Link href="/login" className="w-full">
            <Button className="w-full">로그인하기</Button>
          </Link>
        </div>
      ) : (
        <>
          <KakaoLoginButton />
          <p className="mt-xs text-center text-caption text-stone">
            카카오로 계속하면 가입 후 이름과 동의 항목을 확인해요.
          </p>

          <div className="my-lg flex items-center gap-sm text-caption text-stone">
            <span className="h-px flex-1 bg-hairline" />
            또는 이메일로 가입
            <span className="h-px flex-1 bg-hairline" />
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-md" noValidate aria-busy={loading}>
            <div className="flex flex-col gap-xs">
              <Label htmlFor="name">이름</Label>
              <Input
                ref={nameInputRef}
                id="name"
                autoComplete="name"
                required
                maxLength={50}
                error={!!fieldErrors.name}
                aria-describedby={fieldErrors.name ? 'name-error' : undefined}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="홍길동"
              />
              {fieldErrors.name && <p id="name-error" role="alert" className="text-caption text-error">{fieldErrors.name}</p>}
            </div>
            <div className="flex flex-col gap-xs">
              <Label htmlFor="companyName">회사명 <span className="font-normal text-stone">(선택)</span></Label>
              <Input
                id="companyName"
                autoComplete="organization"
                maxLength={100}
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="회사 또는 팀 이름"
              />
              <p className="text-caption text-stone">예비창업자라면 비워두셔도 돼요.</p>
            </div>
            <div className="flex flex-col gap-xs">
              <Label htmlFor="email">이메일</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                error={!!fieldErrors.email}
                aria-describedby={fieldErrors.email ? 'email-error' : undefined}
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (fieldErrors.email) {
                    setFieldErrors((current) => ({ ...current, email: undefined }));
                  }
                }}
                placeholder="you@example.com"
              />
              {fieldErrors.email ? (
                <p id="email-error" role="alert" className="text-caption text-error">{fieldErrors.email}</p>
              ) : email.length > 0 && emailFormatValid ? (
                <p className="flex items-center gap-xxs text-caption text-success-text">
                  <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                  이메일 형식이 확인됐어요.
                </p>
              ) : null}
            </div>
            <div className="flex flex-col gap-xs">
              <Label htmlFor="password">비밀번호</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={6}
                error={!!fieldErrors.password}
                aria-describedby={fieldErrors.password ? 'password-error password-hint' : 'password-hint'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <p id="password-hint" className="text-caption text-stone">
                6자 이상 입력해주세요
              </p>
              {fieldErrors.password && <p id="password-error" role="alert" className="text-caption text-error">{fieldErrors.password}</p>}
            </div>
            <div className="flex flex-col gap-xs">
              <Label htmlFor="confirmPassword">비밀번호 확인</Label>
              <Input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                error={!!fieldErrors.confirmPassword || confirmationState === 'mismatch'}
                aria-invalid={confirmationState === 'mismatch' || !!fieldErrors.confirmPassword}
                aria-describedby="confirm-password-status"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  if (fieldErrors.confirmPassword) {
                    setFieldErrors((current) => ({ ...current, confirmPassword: undefined }));
                  }
                }}
              />
              <p
                id="confirm-password-status"
                role="status"
                aria-live="polite"
                aria-atomic="true"
                className={`flex min-h-5 items-center gap-xxs text-caption ${
                  confirmationState === 'match'
                    ? 'text-success-text'
                    : confirmationState === 'mismatch'
                      ? 'text-error'
                      : 'text-stone'
                }`}
              >
                {confirmationState === 'match' && <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />}
                {confirmationState === 'mismatch' && <XCircle className="h-4 w-4 shrink-0" aria-hidden="true" />}
                {confirmationState === 'empty' && '비밀번호를 한 번 더 입력해주세요.'}
                {confirmationState === 'password-invalid' && '먼저 비밀번호 조건을 확인해주세요.'}
                {confirmationState === 'match' && '비밀번호가 일치해요.'}
                {confirmationState === 'mismatch' && '비밀번호가 일치하지 않아요.'}
              </p>
            </div>
            <div className="flex flex-col gap-xs rounded-lg border border-hairline p-md">
              <div className="flex min-h-11 items-start gap-sm">
                <input
                  ref={privacyCheckboxRef}
                  id="privacyConsent"
                  type="checkbox"
                  checked={privacyConsent}
                  onChange={(e) => setPrivacyConsent(e.target.checked)}
                  aria-invalid={!!fieldErrors.privacy}
                  aria-describedby={fieldErrors.privacy ? 'privacy-error' : undefined}
                  className="mt-1 h-4 w-4 shrink-0 accent-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-deep focus-visible:ring-offset-2"
                />
                <label htmlFor="privacyConsent" className="text-body-sm text-charcoal">
                  <span className="font-medium text-ink">[필수]</span> 개인정보 수집 및 이용에 동의합니다.{' '}
                  <Link href="/privacy" target="_blank" className="font-medium text-brand-blue-deep hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-deep">
                    자세히 보기
                  </Link>
                </label>
              </div>
              {fieldErrors.privacy && <p id="privacy-error" role="alert" className="text-caption text-error">{fieldErrors.privacy}</p>}
              <div className="flex min-h-11 items-start gap-sm">
                <input
                  id="marketingConsent"
                  type="checkbox"
                  checked={marketingConsent}
                  onChange={(e) => setMarketingConsent(e.target.checked)}
                  className="mt-1 h-4 w-4 shrink-0 accent-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-deep focus-visible:ring-offset-2"
                />
                <label htmlFor="marketingConsent" className="text-body-sm text-charcoal">
                  <span className="font-medium text-ink">[선택]</span> 혜택 및 업데이트 소식 수신에 동의합니다.
                  <span className="mt-xxs block text-caption text-stone">신규 지원사업과 서비스 소식을 이메일로 보내드려요. 언제든 설정에서 변경할 수 있어요.</span>
                </label>
              </div>
            </div>
            {error && (
              <p role="alert" className="text-body-sm text-error">
                {error}
              </p>
            )}
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? '가입 중...' : '이메일로 회원가입'}
            </Button>
          </form>

          <p className="mt-lg text-center text-body-sm text-steel">
            이미 계정이 있으신가요?{' '}
            <Link href="/login" className="font-medium text-brand-blue-deep hover:underline">
              로그인
            </Link>
          </p>
        </>
      )}
    </AuthSplitLayout>
  );
}

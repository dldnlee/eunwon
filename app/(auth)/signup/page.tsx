'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AuthSplitLayout } from '@/components/AuthSplitLayout';
import { KakaoLoginButton } from '@/components/KakaoLoginButton';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Native HTML validation is off (noValidate below) since Supabase's own error
    // messages are English/unstyled — check the basics ourselves first.
    if (!EMAIL_PATTERN.test(email)) {
      setError('올바른 이메일 주소를 입력해주세요.');
      return;
    }
    if (password.length < 6) {
      setError('비밀번호는 6자 이상이어야 해요.');
      return;
    }
    if (password !== confirmPassword) {
      setError('비밀번호가 일치하지 않아요.');
      return;
    }

    setLoading(true);

    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    // Email confirmation disabled in Supabase project settings → session exists immediately
    if (data.session) {
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
      description="무료로 5개 지원사업 매칭을 받아보세요"
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

          <div className="my-lg flex items-center gap-sm text-caption text-stone">
            <span className="h-px flex-1 bg-hairline" />
            또는
            <span className="h-px flex-1 bg-hairline" />
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-md" noValidate>
            <div className="flex flex-col gap-xs">
              <Label htmlFor="email">이메일</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                error={!!error}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>
            <div className="flex flex-col gap-xs">
              <Label htmlFor="password">비밀번호</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={6}
                error={!!error}
                aria-describedby="password-hint"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <p id="password-hint" className="text-caption text-stone">
                6자 이상 입력해주세요
              </p>
            </div>
            <div className="flex flex-col gap-xs">
              <Label htmlFor="confirmPassword">비밀번호 확인</Label>
              <Input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                error={!!error}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
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

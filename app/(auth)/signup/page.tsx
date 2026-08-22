'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Logo } from '@/components/Logo';
import { Check, X } from 'lucide-react';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_CHECK_DEBOUNCE_MS = 500;

type EmailCheckStatus = 'idle' | 'checking' | 'available' | 'taken';

/** Small circular status indicator shown inside the email field — mirrors the live-availability
 *  pattern from signup forms elsewhere (checking/available/taken), using DESIGN.md's existing
 *  success/error tokens rather than introducing new colors. */
function EmailCheckIndicator({ status }: { status: EmailCheckStatus }) {
  if (status === 'idle') return null;

  if (status === 'checking') {
    return (
      <span
        role="status"
        aria-label="이메일 확인 중"
        className="h-4 w-4 animate-spin rounded-full border-2 border-hairline border-t-steel"
      />
    );
  }

  if (status === 'available') {
    return (
      <span
        role="status"
        aria-label="사용 가능한 이메일이에요"
        className="flex h-5 w-5 items-center justify-center rounded-full bg-success-bg text-success-text"
      >
        <Check className="h-3 w-3" strokeWidth={3} aria-hidden="true" />
      </span>
    );
  }

  return (
    <span
      role="status"
      aria-label="이미 가입된 이메일이에요"
      className="flex h-5 w-5 items-center justify-center rounded-full bg-error/10 text-error"
    >
      <X className="h-3 w-3" strokeWidth={3} aria-hidden="true" />
    </span>
  );
}

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [alreadyRegistered, setAlreadyRegistered] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [emailCheckStatus, setEmailCheckStatus] = useState<EmailCheckStatus>('idle');

  // Tracks the most recently *requested* email so a slow/out-of-order response can't overwrite
  // the indicator with a stale result once the user has kept typing.
  const latestCheckedEmail = useRef<string>('');

  useEffect(() => {
    if (!EMAIL_PATTERN.test(email)) {
      setEmailCheckStatus('idle');
      return;
    }

    setEmailCheckStatus('checking');
    const emailAtRequestTime = email;

    const timer = setTimeout(async () => {
      const supabase = createClient();
      const { data, error: rpcError } = await supabase.rpc('email_is_registered', {
        check_email: emailAtRequestTime,
      });

      if (emailAtRequestTime !== email) return; // a newer keystroke has already superseded this
      latestCheckedEmail.current = emailAtRequestTime;

      if (rpcError) {
        // Fail open — don't block signup on the live-check endpoint itself failing;
        // handleSubmit's post-signUp identities-array check still catches duplicates.
        setEmailCheckStatus('idle');
        return;
      }

      setEmailCheckStatus(data ? 'taken' : 'available');
    }, EMAIL_CHECK_DEBOUNCE_MS);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally re-runs only on email change
  }, [email]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setAlreadyRegistered(false);

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

    // The live check already told us — skip the wasted signUp round-trip.
    if (emailCheckStatus === 'taken' && latestCheckedEmail.current === email) {
      setAlreadyRegistered(true);
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

    // Supabase deliberately doesn't error on signUp for an already-registered email (to avoid
    // leaking which emails have accounts) — it instead returns a user object with an empty
    // `identities` array and no session. That's the documented signal to detect this case
    // ourselves, since without it we'd show "인증 메일을 보냈어요" for an email that already
    // has an account and never actually got a real signup email.
    if (data.user && data.user.identities?.length === 0) {
      setAlreadyRegistered(true);
      return;
    }

    setSent(true);
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-lg bg-surface p-md">
      <Logo className="h-8 w-auto" />
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>회원가입</CardTitle>
          <CardDescription>무료로 5개 지원사업 매칭을 받아보세요</CardDescription>
        </CardHeader>
        <CardContent>
          {sent ? (
            <div className="flex flex-col items-start gap-xs rounded-md bg-success-bg px-md py-sm">
              <p className="text-body-sm text-success-text">
                <strong>{email}</strong>로 인증 메일을 보냈어요. 메일함을 확인해주세요.
              </p>
            </div>
          ) : alreadyRegistered ? (
            <div className="flex flex-col items-start gap-sm rounded-md bg-surface-soft px-md py-sm">
              <p className="text-body-sm text-charcoal">
                <strong>{email}</strong>은(는) 이미 가입된 이메일이에요. 로그인해주세요.
              </p>
              <div className="flex w-full gap-sm">
                <Link href="/login" className="flex-1">
                  <Button className="w-full">로그인하러 가기</Button>
                </Link>
                <Button variant="outline" onClick={() => setAlreadyRegistered(false)}>
                  다른 이메일로 가입
                </Button>
              </div>
            </div>
          ) : (
            <>
              <form onSubmit={handleSubmit} className="flex flex-col gap-md" noValidate>
                <div className="flex flex-col gap-xs">
                  <Label htmlFor="email">이메일</Label>
                  <div className="relative">
                    <Input
                      id="email"
                      type="email"
                      autoComplete="email"
                      required
                      error={!!error || emailCheckStatus === 'taken'}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="pr-11"
                    />
                    <div className="pointer-events-none absolute inset-y-0 right-md flex items-center">
                      <EmailCheckIndicator status={emailCheckStatus} />
                    </div>
                  </div>
                  {emailCheckStatus === 'taken' && (
                    <p className="text-caption text-error">이미 가입된 이메일이에요.</p>
                  )}
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
                  {loading ? '가입 중...' : '회원가입'}
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
        </CardContent>
      </Card>
    </div>
  );
}

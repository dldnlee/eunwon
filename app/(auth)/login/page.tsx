'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Logo } from '@/components/Logo';
import { KakaoLoginButton } from '@/components/KakaoLoginButton';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(() =>
    searchParams.get('error') === 'oauth_callback'
      ? '카카오 로그인에 실패했어요. 잠시 후 다시 시도해 주세요.'
      : null
  );
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push(searchParams.get('next') ?? '/dashboard');
    router.refresh();
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>로그인</CardTitle>
        <CardDescription>내 사업에 맞는 지원사업을 찾아보세요</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-md" noValidate>
          <div className="flex flex-col gap-xs">
            <Label htmlFor="email">이메일</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              error={!!error}
              aria-describedby={error ? 'login-error' : undefined}
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
              autoComplete="current-password"
              required
              error={!!error}
              aria-describedby={error ? 'login-error' : undefined}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && (
            <p id="login-error" role="alert" className="text-body-sm text-error">
              {error}
            </p>
          )}
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? '로그인 중...' : '로그인'}
          </Button>
        </form>
        <div className="my-lg flex items-center gap-sm text-caption text-stone">
          <span className="h-px flex-1 bg-hairline" />
          또는
          <span className="h-px flex-1 bg-hairline" />
        </div>
        <KakaoLoginButton nextPath={searchParams.get('next') ?? undefined} />
        <p className="mt-lg text-center text-body-sm text-steel">
          계정이 없으신가요?{' '}
          <Link href="/signup" className="font-medium text-brand-blue-deep hover:underline">
            회원가입
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-lg bg-surface p-md">
      <Logo className="h-8 w-auto" />
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}

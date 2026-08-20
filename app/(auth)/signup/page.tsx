'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

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

    setSent(true);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface p-md">
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
          ) : (
            <>
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

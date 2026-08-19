import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TOSS_ENABLED } from '@/lib/payments';
import { CheckCircle2, Search, Sparkles, FileText } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <header className="border-b border-slate-100">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <span className="text-lg font-bold text-slate-900">지원사업매칭</span>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" size="sm">로그인</Button>
            </Link>
            <Link href="/signup">
              <Button size="sm">무료로 시작하기</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-4xl px-6 py-24 text-center">
        <Badge variant="default" className="mb-4">Upstage Solar Pro 기반 AI 매칭</Badge>
        <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
          놓치고 있는 정부지원사업을
          <br />
          찾아드립니다
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-600">
          내 사업 정보만 입력하면, 수백 개의 정부지원사업 중 지금 신청할 수 있는 것만
          골라드려요. 소상공인, 스타트업, 중소기업을 위한 가장 쉬운 지원사업 매칭 서비스.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link href="/signup">
            <Button size="lg">내 사업에 맞는 지원사업 찾기</Button>
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid gap-6 sm:grid-cols-3">
          <Card>
            <CardHeader>
              <Search className="mb-2 h-8 w-8 text-blue-600" />
              <CardTitle>정확한 매칭</CardTitle>
              <CardDescription>
                업종, 지역, 업력, 규모까지 반영해 신청 가능한 사업만 보여드려요.
              </CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <Sparkles className="mb-2 h-8 w-8 text-blue-600" />
              <CardTitle>AI 요약 &amp; 설명</CardTitle>
              <CardDescription>
                복잡한 공고문을 Solar Pro가 이해하기 쉬운 한국어로 요약해드려요.
              </CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <FileText className="mb-2 h-8 w-8 text-blue-600" />
              <CardTitle>신청서 초안 작성</CardTitle>
              <CardDescription>
                사업계획서 목차와 작성 가이드까지 AI가 함께 만들어드려요.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </section>

      {/* Pricing */}
      <section className="border-t border-slate-100 bg-slate-50 py-20">
        <div className="mx-auto max-w-4xl px-6">
          <h2 className="text-center text-3xl font-bold text-slate-900">요금제</h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>무료</CardTitle>
                <CardDescription>가볍게 시작해보세요</CardDescription>
                <p className="mt-2 text-3xl font-bold text-slate-900">₩0</p>
              </CardHeader>
              <CardContent>
                <ul className="flex flex-col gap-2 text-sm text-slate-600">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" /> 매칭 결과 5건
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" /> 기본 AI 요약
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" /> 북마크 기능
                  </li>
                </ul>
                <Link href="/signup" className="mt-6 block">
                  <Button variant="outline" className="w-full">무료로 시작</Button>
                </Link>
              </CardContent>
            </Card>
            <Card className="border-blue-600 ring-1 ring-blue-600">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <CardTitle>Pro</CardTitle>
                  <Badge variant={TOSS_ENABLED ? 'default' : 'secondary'}>
                    {TOSS_ENABLED ? '추천' : '출시 예정'}
                  </Badge>
                </div>
                <CardDescription>본격적으로 지원사업을 찾는다면</CardDescription>
                <p className="mt-2 text-3xl font-bold text-slate-900">
                  ₩39,000<span className="text-base font-normal text-slate-500">/월</span>
                </p>
              </CardHeader>
              <CardContent>
                <ul className="flex flex-col gap-2 text-sm text-slate-600">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" /> 무제한 매칭
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" /> &ldquo;왜 나에게 맞나요?&rdquo; AI 설명
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" /> 신청서 초안 작성 도우미
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" /> 신규 매칭 이메일 알림
                  </li>
                </ul>
                {TOSS_ENABLED ? (
                  <Link href="/signup" className="mt-6 block">
                    <Button className="w-full">Pro로 시작하기</Button>
                  </Link>
                ) : (
                  <Button className="mt-6 w-full" variant="secondary" disabled>
                    출시 예정
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-100 py-8 text-center text-sm text-slate-400">
        © {new Date().getFullYear()} 지원사업매칭
      </footer>
    </div>
  );
}

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TOSS_ENABLED } from '@/lib/payments';
import { CheckCircle2, Search, Sparkles, FileText } from 'lucide-react';

const FEATURES = [
  {
    icon: Search,
    title: '정확한 매칭',
    description: '업종, 지역, 업력, 규모까지 반영해 신청 가능한 사업만 보여드려요.',
  },
  {
    icon: Sparkles,
    title: 'AI 요약 & 설명',
    description: '복잡한 공고문을 Solar Pro가 이해하기 쉬운 한국어로 요약해드려요.',
  },
  {
    icon: FileText,
    title: '사업계획서 생성',
    description: '사업 개요부터 기대 효과까지, 신청서에 바로 쓸 수 있는 초안을 AI가 작성해드려요.',
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-canvas">
      {/* Nav */}
      <header className="border-b border-hairline-soft">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-xl py-md">
          <span className="text-card-title text-ink">Eunwon AI</span>
          <div className="flex items-center gap-xs">
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
      <section className="mx-auto max-w-4xl px-xl py-section-lg text-center sm:py-hero">
        <Badge variant="default" className="mb-md">Upstage Solar Pro 기반 AI 매칭</Badge>
        <h1 className="text-heading-md text-balance text-ink sm:text-heading-lg lg:text-display-lg">
          놓치고 있는 정부지원사업을
          <br />
          찾아드립니다
        </h1>
        <p className="mx-auto mt-lg max-w-2xl text-body-md text-steel sm:text-subtitle">
          내 사업 정보만 입력하면, 수백 개의 정부지원사업 중 지금 신청할 수 있는 것만
          골라드려요. 소상공인, 스타트업, 중소기업을 위한 가장 쉬운 지원사업 매칭 서비스.
        </p>
        <div className="mt-xl flex justify-center gap-sm">
          <Link href="/signup">
            <Button size="lg">내 사업에 맞는 지원사업 찾기</Button>
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-xl py-section">
        <div className="grid gap-lg sm:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, description }) => (
            <Card key={title} className="border-none bg-surface">
              <CardHeader>
                <div className="mb-xs flex h-10 w-10 items-center justify-center rounded-full bg-canvas">
                  <Icon className="h-5 w-5 text-ink" aria-hidden="true" />
                </div>
                <CardTitle>{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section className="border-t border-hairline-soft bg-surface py-section">
        <div className="mx-auto max-w-4xl px-xl">
          <h2 className="text-center text-heading-md text-ink">요금제</h2>
          <div className="mt-xxl grid gap-lg sm:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>무료</CardTitle>
                <CardDescription>가볍게 시작해보세요</CardDescription>
                <p className="mt-xs text-heading-md text-ink">₩0</p>
              </CardHeader>
              <CardContent>
                <ul className="flex flex-col gap-sm text-body-sm text-charcoal">
                  <li className="flex items-center gap-xs">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-success-text" /> 매칭 결과 5건
                  </li>
                  <li className="flex items-center gap-xs">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-success-text" /> 기본 AI 요약
                  </li>
                  <li className="flex items-center gap-xs">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-success-text" /> 북마크 기능
                  </li>
                </ul>
                <Link href="/signup" className="mt-xl block">
                  <Button variant="outline" className="w-full">무료로 시작</Button>
                </Link>
              </CardContent>
            </Card>
            <Card className="border-brand-blue-deep ring-1 ring-brand-blue-deep">
              <CardHeader>
                <div className="flex items-center gap-xs">
                  <CardTitle>Pro</CardTitle>
                  <Badge variant={TOSS_ENABLED ? 'default' : 'secondary'}>
                    {TOSS_ENABLED ? '추천' : '출시 예정'}
                  </Badge>
                </div>
                <CardDescription>본격적으로 지원사업을 찾는다면</CardDescription>
                <p className="mt-xs text-heading-md text-ink">
                  ₩39,000<span className="text-body-md font-normal text-steel">/월</span>
                </p>
              </CardHeader>
              <CardContent>
                <ul className="flex flex-col gap-sm text-body-sm text-charcoal">
                  <li className="flex items-center gap-xs">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-success-text" /> 무제한 매칭
                  </li>
                  <li className="flex items-center gap-xs">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-success-text" /> &ldquo;왜 나에게 맞나요?&rdquo; AI 설명
                  </li>
                  <li className="flex items-center gap-xs">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-success-text" /> 사업계획서 생성 도우미
                  </li>
                  <li className="flex items-center gap-xs">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-success-text" /> 신규 매칭 · 마감 임박 이메일 알림
                  </li>
                  <li className="flex items-center gap-xs">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-success-text" /> 중복수혜 제한 확인
                  </li>
                </ul>
                {TOSS_ENABLED ? (
                  <Link href="/signup" className="mt-xl block">
                    <Button className="w-full">Pro로 시작하기</Button>
                  </Link>
                ) : (
                  <Button className="mt-xl w-full" variant="secondary" disabled>
                    출시 예정
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <footer className="border-t border-hairline-soft py-xl text-center text-caption text-stone">
        © {new Date().getFullYear()} Eunwon AI
      </footer>
    </div>
  );
}

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Logo } from '@/components/Logo';
import { TOSS_ENABLED } from '@/lib/payments';
import { CheckCircle2, Search, Sparkles, FileText } from 'lucide-react';

const FEATURES = [
  {
    icon: Search,
    title: '정확한 매칭',
    description: '업종, 지역, 업력, 규모까지 반영해 신청 가능한 사업만 보여드려요.',
    iconBg: 'bg-brand-blue-200',
    iconColor: 'text-brand-blue-deep',
  },
  {
    icon: Sparkles,
    title: 'AI 요약 & 설명',
    description: '복잡한 공고문을 Solar Pro가 이해하기 쉬운 한국어로 요약해드려요.',
    iconBg: 'bg-brand-purple/10',
    iconColor: 'text-brand-purple',
  },
  {
    icon: FileText,
    title: '사업계획서 생성',
    description: '사업 개요부터 기대 효과까지, 신청서에 바로 쓸 수 있는 초안을 AI가 작성해드려요.',
    iconBg: 'bg-brand-coral/10',
    iconColor: 'text-brand-coral',
  },
];

// Shared glass-panel treatment: translucent canvas + blur + a soft light
// border, so the fixed color blobs behind read through every panel.
const GLASS = 'border-white/60 bg-canvas/50 backdrop-blur-xl';

export default function LandingPage() {
  return (
    <div className="relative isolate min-h-screen overflow-hidden bg-canvas">
      {/* Background color field, spread down the full page height so every glass panel — however far down you scroll — has some color behind it */}
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
        <div className="absolute -left-24 top-0 h-96 w-96 rounded-full bg-brand-blue-mid opacity-30 blur-3xl" />
        <div className="absolute -right-20 top-10 h-80 w-80 rounded-full bg-brand-coral opacity-25 blur-3xl" />
        <div className="absolute left-1/4 top-[45%] h-72 w-72 rounded-full bg-brand-purple opacity-20 blur-3xl" />
        <div className="absolute -right-16 top-[55%] h-96 w-96 rounded-full bg-brand-cyan opacity-20 blur-3xl" />
        <div className="absolute -left-16 top-[80%] h-80 w-80 rounded-full bg-brand-coral opacity-15 blur-3xl" />
        <div className="absolute -right-24 bottom-0 h-96 w-96 rounded-full bg-brand-blue-mid opacity-25 blur-3xl" />
      </div>

      {/* Nav */}
      <header className={`sticky top-0 z-20 border-b ${GLASS}`}>
        <div className="mx-auto flex max-w-6xl items-center justify-between px-xl py-md">
          <span className="flex items-center gap-xs text-card-title text-ink">
            <Logo className="h-6 w-auto" />
            eunwon AI
          </span>
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
      <section className="relative">
        <div className="relative mx-auto max-w-4xl px-xl py-section-lg text-center sm:py-hero">
          <Badge className={`mb-md border ${GLASS} text-brand-blue-deep`}>
            Upstage Solar Pro 기반 AI 매칭
          </Badge>
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
        </div>
      </section>

      {/* Features */}
      <section className="relative mx-auto max-w-6xl px-xl py-section">
        <div className="grid gap-lg sm:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, description, iconBg, iconColor }) => (
            <Card key={title} className={`border ${GLASS} shadow-[0_8px_32px_rgba(0,0,0,0.06)]`}>
              <CardHeader>
                <div className={`mb-xs flex h-10 w-10 items-center justify-center rounded-full ${iconBg}`}>
                  <Icon className={`h-5 w-5 ${iconColor}`} aria-hidden="true" />
                </div>
                <CardTitle>{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section className="relative border-t border-white/60 py-section">
        <div className="relative mx-auto max-w-4xl px-xl">
          <h2 className="text-center text-heading-md text-ink">요금제</h2>
          <div className="mt-xxl grid gap-lg sm:grid-cols-2">
            <Card className={`border ${GLASS} shadow-[0_8px_32px_rgba(0,0,0,0.06)]`}>
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
            <Card className={`border-brand-blue-deep/60 ${GLASS} ring-1 ring-brand-blue-deep/60 shadow-[0_0_32px_rgba(20,86,240,0.22)]`}>
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

      <footer className={`relative border-t ${GLASS} py-xl text-center text-caption text-stone`}>
        © {new Date().getFullYear()} eunwon AI
      </footer>
    </div>
  );
}

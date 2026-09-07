import Link from 'next/link';
import Image from 'next/image';
import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Logo } from '@/components/Logo';
import { Footer } from '@/components/Footer';
import { ReviewsMarquee } from '@/components/ReviewsMarquee';
import { ProductShowcase } from '@/components/ProductShowcase';
import { FaqSection } from '@/components/FaqSection';
import { MotionProvider } from '@/components/motion/MotionProvider';
import { FadeIn } from '@/components/motion/FadeIn';
import { HighlightText } from '@/components/motion/HighlightText';
import { createClient } from '@/lib/supabase/server';
import type { Review } from '@/lib/types';
import { FAQS } from '@/components/FaqSection';
import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/site-url';

export const metadata: Metadata = {
  alternates: { canonical: '/' },
  openGraph: { url: '/' },
};

// Single accent color (brand-blue) instead of a different brand color per card — a numbered
// label stands in for the old per-feature icon.
const FEATURES = [
  {
    number: '01',
    title: '정확한 매칭',
    description: '업종, 지역, 업력, 규모, 인증까지 반영해 신청 자격을 충족하는 사업만 보여드려요.',
  },
  {
    number: '02',
    title: 'AI 요약 & 설명',
    description: '복잡한 공고문을 AI가 핵심만 정리하고, 왜 나에게 맞는지도 구체적으로 설명해드려요.',
  },
  {
    number: '03',
    title: '사업계획서 생성',
    description: '사업 개요부터 기대 효과까지, 신청서에 바로 쓸 초안을 AI가 먼저 작성해드려요.',
  },
];

// Shared glass-panel treatment: translucent canvas + blur + a soft light
// border, so the fixed color blobs behind read through every panel.
const GLASS = 'border-white/60 bg-canvas/50 backdrop-blur-xl';

async function getReviews(): Promise<Review[]> {
  // Swallow errors so a not-yet-migrated `reviews` table just hides the
  // section instead of breaking the landing page.
  try {
    const supabase = createClient();
    const { data } = await supabase
      .from('reviews')
      .select('*')
      .eq('is_published', true)
      .order('created_at', { ascending: false });
    return (data ?? []) as Review[];
  } catch {
    return [];
  }
}

export default async function LandingPage({
  searchParams,
}: {
  searchParams: { code?: string | string[] };
}) {
  // Recovery for Supabase Auth projects whose Site URL is configured as `/`.
  // If an OAuth redirectTo is missing from the allowlist, Supabase falls back
  // here with the authorization code. Route it immediately to the server-only
  // exchange handler rather than rendering the landing page with the code.
  const oauthCode = Array.isArray(searchParams.code) ? searchParams.code[0] : searchParams.code;
  if (oauthCode) redirect(`/auth/callback?code=${encodeURIComponent(oauthCode)}`);

  const reviews = await getReviews();
  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${SITE_URL}/#organization`,
        name: 'eunwon AI',
        url: SITE_URL,
        logo: `${SITE_URL}/icon.png`,
        email: 'hello@eunwon.com',
      },
      {
        '@type': 'WebSite',
        '@id': `${SITE_URL}/#website`,
        url: SITE_URL,
        name: 'eunwon AI',
        inLanguage: 'ko-KR',
        publisher: { '@id': `${SITE_URL}/#organization` },
      },
      {
        '@type': 'SoftwareApplication',
        name: 'eunwon AI 정부지원사업 매칭',
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Web',
        url: SITE_URL,
        inLanguage: 'ko-KR',
        description: '소상공인, 스타트업, 중소기업을 위한 정부지원사업 AI 맞춤 매칭 서비스',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'KRW' },
      },
      {
        '@type': 'FAQPage',
        mainEntity: FAQS.map(({ question, answer }) => ({
          '@type': 'Question',
          name: question,
          acceptedAnswer: { '@type': 'Answer', text: answer },
        })),
      },
    ],
  };

  return (
    <MotionProvider>
    <div className="relative isolate min-h-screen overflow-hidden bg-canvas">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, '\\u003c') }}
      />
      {/* Background color field, spread down the full page height so every glass panel — however far down you scroll — has some color behind it */}
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
        <div className="absolute -left-24 top-0 h-96 w-96 rounded-full bg-brand-blue-mid opacity-30 blur-3xl" />
        <div className="absolute -right-20 top-10 h-80 w-80 rounded-full bg-brand-coral opacity-25 blur-3xl" />
        <div className="absolute left-1/4 top-[45%] h-72 w-72 rounded-full bg-brand-purple opacity-20 blur-3xl" />
        <div className="absolute -right-16 top-[55%] h-96 w-96 rounded-full bg-brand-cyan opacity-20 blur-3xl" />
        <div className="absolute -left-16 top-[80%] h-80 w-80 rounded-full bg-brand-coral opacity-15 blur-3xl" />
        <div className="absolute -right-24 bottom-0 h-96 w-96 rounded-full bg-brand-blue-mid opacity-25 blur-3xl" />
      </div>

      {/* Nav — fixed (not sticky) so it stays pinned regardless of the overflow-hidden root above,
          and so its glass background keeps showing the blobs behind it as content scrolls under it.
          FadeIn renders directly as the <header> (see its own comment) so the fixed positioning
          isn't broken by an animated wrapper. */}
      <FadeIn as="header" className={`fixed inset-x-0 top-0 z-20 border-b ${GLASS}`}>
        <div className="mx-auto flex max-w-6xl flex-nowrap items-center justify-between gap-sm px-md py-md sm:px-xl">
          <span className="flex shrink-0 items-center gap-xs whitespace-nowrap text-card-title text-ink">
            <Logo className="h-6 w-auto" />
            eunwon AI
          </span>
          <div className="flex shrink-0 items-center gap-xs">
            <Link href="/login" className="hidden sm:block">
              <Button variant="ghost" size="sm" className="whitespace-nowrap">로그인</Button>
            </Link>
            <Link href="/signup">
              <Button size="sm" className="whitespace-nowrap">
                <span className="sm:hidden">시작하기</span>
                <span className="hidden sm:inline">무료로 시작하기</span>
              </Button>
            </Link>
          </div>
        </div>
      </FadeIn>
      {/* Spacer for the fixed header above (measured ~69-77px depending on breakpoint) */}
      <div className="h-20" aria-hidden="true" />

      {/* Hero */}
      <main id="main-content" tabIndex={-1} className="focus:outline-none">
      <section className="relative" aria-labelledby="landing-title">
        <div className="relative mx-auto grid max-w-6xl items-center gap-xxl px-xl py-section-lg sm:py-hero md:grid-cols-[minmax(0,1fr)_360px] lg:grid-cols-[minmax(0,1fr)_440px]">
          <div className="text-center md:text-left">
            <FadeIn>
              <Badge className={`mb-md border font-normal ${GLASS} text-brand-blue-deep`}>
                지원을 찾는 가장 쉬운 이름, <strong className="font-bold">eunwon</strong>
              </Badge>
            </FadeIn>
            <FadeIn delay={0.1}>
              <h1 id="landing-title" className="text-heading-md text-balance text-ink sm:text-heading-lg lg:text-display-lg">
                정부지원사업,{' '}
                <HighlightText>
                  <strong className="font-bold">eunwon</strong>
                </HighlightText>
                이 먼저 찾습니다
              </h1>
            </FadeIn>
            <FadeIn delay={0.2}>
              <p className="mx-auto mt-lg max-w-2xl text-body-md text-steel sm:text-subtitle md:mx-0">
                사업 정보만 입력하면, 신청 조건과 마감일까지 한 번에 정리해드려요.
              </p>
            </FadeIn>
            <FadeIn delay={0.3} className="mt-xl flex justify-center gap-sm md:justify-start">
              <Link href="/signup">
                <Button size="lg">내가 받을 지원사업 확인하기</Button>
              </Link>
            </FadeIn>
          </div>
          <FadeIn
            delay={0.15}
            className="relative mx-auto h-64 w-full max-w-[440px] overflow-hidden sm:h-72 md:h-80"
            ariaLabel="eunwon AI 매칭 안내 마스코트"
          >
            <div className={`absolute inset-x-xs bottom-sm h-48 rounded-hero border ${GLASS}`} aria-hidden="true" />
            <Image
              src="/mascot/on-plane.png"
              alt="비행기를 타고 맞춤 지원사업을 찾아가는 eunwon 마스코트"
              width={1095}
              height={1369}
              priority
              sizes="(max-width: 767px) 112vw, 493px"
              className="absolute left-1/2 top-[-72px] z-10 h-auto w-[112%] max-w-none -translate-x-1/2 drop-shadow-[0_8px_16px_rgba(0,0,0,0.10)] sm:top-[-80px] md:top-[-92px]"
            />
          </FadeIn>
        </div>
      </section>

      {/* Features */}
      <section className="relative mx-auto max-w-6xl px-xl py-section">
        <div className="grid gap-lg sm:grid-cols-3">
          {FEATURES.map(({ number, title, description }, index) => (
            <FadeIn key={title} delay={index * 0.1} className="h-full">
              <Card className={`h-full border ${GLASS} shadow-[0_8px_32px_rgba(0,0,0,0.06)]`}>
                <CardHeader>
                  <span className="mb-xs text-heading-sm font-semibold text-brand-blue-deep">
                    {number}
                  </span>
                  <CardTitle>{title}</CardTitle>
                  <CardDescription className="leading-relaxed">{description}</CardDescription>
                </CardHeader>
              </Card>
            </FadeIn>
          ))}
        </div>
      </section>

      <ProductShowcase />

      {/* Reviews */}
      {reviews.length > 0 && (
        <FadeIn as="section" className="relative py-section">
          <h2 className="mb-xl text-center text-heading-md text-ink">이용자들의 후기</h2>
          <ReviewsMarquee reviews={reviews} />
        </FadeIn>
      )}

      {/* Open access */}
      <FadeIn as="section" id="pricing" className="relative border-t border-white/60 py-section">
        <div className="relative mx-auto max-w-4xl px-xl text-center">
          <Card className={`border ${GLASS} shadow-[0_8px_32px_rgba(0,0,0,0.06)]`}>
            <CardContent className="flex flex-col items-center gap-md p-xxl sm:p-section-sm">
              <p className="text-caption-bold text-success-text">지금은 모든 기능 무료</p>
              <h2 className="text-heading-md text-ink">좋은 지원사업을 찾는 데 장벽이 없도록</h2>
              <p className="max-w-2xl text-body-md text-charcoal">
                무제한 맞춤 매칭부터 AI 설명, 사업계획서 생성, 이메일 알림까지 모두 이용해보세요.
              </p>
              <Link href="/signup">
                <Button>무료로 시작하기</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </FadeIn>

      <FadeIn as="div">
        <FaqSection />
      </FadeIn>
      </main>

      <Footer />
    </div>
    </MotionProvider>
  );
}

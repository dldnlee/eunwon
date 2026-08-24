import Link from 'next/link';
import { ArrowRight, CalendarClock, CheckCircle2, GitCompareArrows, HelpCircle } from 'lucide-react';
import type { SimilarProgramRecommendation } from '@/lib/similar-programs';
import { formatKoreanDate } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

function ExplanationList({
  title,
  items,
  variant,
}: {
  title: string;
  items: string[];
  variant: 'reason' | 'difference';
}) {
  const Icon = variant === 'reason' ? CheckCircle2 : GitCompareArrows;
  return (
    <div>
      <p className="flex items-center gap-xxs text-caption-bold text-charcoal">
        <Icon
          className={`h-3.5 w-3.5 shrink-0 ${variant === 'reason' ? 'text-success-text' : 'text-steel'}`}
          aria-hidden="true"
        />
        {title}
      </p>
      {items.length > 0 ? (
        <ul className="mt-xs flex flex-col gap-xxs">
          {items.map((item) => (
            <li key={item} className="flex items-start gap-xs text-caption text-steel">
              <span className="mt-[0.65rem] h-1 w-1 shrink-0 rounded-full bg-stone" aria-hidden="true" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-xs inline-flex items-start gap-xxs text-caption text-steel">
          <HelpCircle className="mt-xxs h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          상세 내용 확인 필요
        </p>
      )}
    </div>
  );
}

export function SimilarPrograms({ recommendations }: { recommendations: SimilarProgramRecommendation[] }) {
  if (recommendations.length === 0) return null;

  return (
    <section aria-labelledby="similar-programs-title">
      <div className="mb-md">
        <h2 id="similar-programs-title" className="text-card-title text-ink">
          함께 검토할 비슷한 지원사업
        </h2>
        <p className="mt-xxs text-caption text-steel">
          공고 내용과 조건이 비슷한 사업이에요. 유사하다는 이유만으로 신청 자격이 확인되는 것은 아니에요.
        </p>
      </div>

      <div className="grid gap-md sm:grid-cols-2">
        {recommendations.map(({ program, score, reasons, differences }) => (
          <Card key={program.id} className="flex flex-col">
            <CardHeader className="gap-xs">
              <div className="flex flex-wrap items-center justify-between gap-xs">
                {program.category ? (
                  <span className="rounded-full border border-hairline bg-surface px-xs py-xxs text-micro text-charcoal">
                    {program.category}
                  </span>
                ) : (
                  <span />
                )}
                <span
                  className="rounded-full border border-hairline bg-surface px-xs py-xxs text-micro font-semibold text-charcoal"
                  title="신청 가능성이 아닌 공고 내용과 조건의 유사도"
                >
                  공고 유사도 {Math.round(score)}/100
                </span>
              </div>
              <CardTitle>
                <Link
                  href={`/program/${program.id}`}
                  className="rounded-sm underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-deep focus-visible:ring-offset-2"
                >
                  {program.title}
                </Link>
              </CardTitle>
              <p className="text-caption text-steel">{program.agency}</p>
              <p className="flex items-center gap-xxs text-caption text-steel">
                <CalendarClock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                {program.deadline_end ? `마감 ${formatKoreanDate(program.deadline_end)}` : '마감일 확인 필요'}
              </p>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col gap-md">
              <ExplanationList title="비슷한 이유" items={reasons} variant="reason" />
              <ExplanationList title="꼭 확인할 차이" items={differences} variant="difference" />
              <div className="mt-auto border-t border-hairline-soft pt-md">
                <Link
                  href={`/program/${program.id}`}
                  className="inline-flex min-h-11 w-full items-center justify-center gap-xs rounded-full bg-primary px-lg text-button-md text-on-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-deep focus-visible:ring-offset-2"
                >
                  조건 자세히 보기
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <p className="mt-sm text-caption text-steel">
        각 사업의 자격 조건, 중복수혜 제한, 신청 기간은 서로 다를 수 있어요. 저장된 사업 프로필과 최신
        공고 원문을 기준으로 각각 확인해 주세요.
      </p>
    </section>
  );
}

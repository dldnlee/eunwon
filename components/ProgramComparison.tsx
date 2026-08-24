import Link from 'next/link';
import { AlertCircle, CheckCircle2, ExternalLink, HelpCircle, XCircle } from 'lucide-react';
import type { ProgramComparisonItem } from '@/lib/program-comparison';
import { formatKoreanDate } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const ELIGIBILITY_PRESENTATION = {
  aligned: { label: '확인한 조건 일치', icon: CheckCircle2, className: 'text-success-text' },
  mismatch: { label: '현재 정보상 불충족 있음', icon: XCircle, className: 'text-error' },
  unknown: { label: '확인 필요', icon: HelpCircle, className: 'text-steel' },
} as const;

function safeExternalUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.toString() : null;
  } catch {
    return null;
  }
}

function Unknown({ detail }: { detail?: string }) {
  return (
    <span className="inline-flex items-start gap-xxs text-caption text-steel">
      <HelpCircle className="mt-xxs h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>확인 필요{detail ? ` · ${detail}` : ''}</span>
    </span>
  );
}

function EligibilityValue({ item }: { item: ProgramComparisonItem }) {
  const presentation = ELIGIBILITY_PRESENTATION[item.eligibility.status];
  const Icon = presentation.icon;
  return (
    <div>
      <span className={`inline-flex items-center gap-xxs text-caption-bold ${presentation.className}`}>
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        {presentation.label}
      </span>
      <p className="mt-xxs text-caption text-steel">
        충족 {item.eligibility.met} · 불충족 {item.eligibility.notMet} · 확인 필요 {item.eligibility.unknown}
      </p>
    </div>
  );
}

function BenefitValue({ item }: { item: ProgramComparisonItem }) {
  if (!item.benefit.label && item.benefit.amountKrw === null) return <Unknown detail="지원 규모 원문 확인" />;
  return (
    <div className="text-caption text-charcoal">
      {item.benefit.label && <p>{item.benefit.label}</p>}
      {item.benefit.amountKrw !== null && (
        <p className="mt-xxs text-caption-bold text-ink">
          {new Intl.NumberFormat('ko-KR').format(item.benefit.amountKrw)}원
        </p>
      )}
    </div>
  );
}

function ApplicationValue({ item }: { item: ProgramComparisonItem }) {
  if (!item.application) return <Unknown detail="저장 후 신청 진행을 기록할 수 있어요" />;
  return (
    <div>
      <p className="text-caption-bold text-ink">{item.application.status || '진행 상태 확인 필요'}</p>
      {item.application.nextAction ? (
        <p className="mt-xxs text-caption text-charcoal">다음 행동 · {item.application.nextAction}</p>
      ) : (
        <p className="mt-xxs text-caption text-steel">다음 행동 확인 필요</p>
      )}
      {item.application.dueAt && (
        <p className="mt-xxs text-caption text-steel">예정일 {formatKoreanDate(item.application.dueAt)}</p>
      )}
    </div>
  );
}

function ComparisonValue({ item, field }: { item: ProgramComparisonItem; field: string }) {
  switch (field) {
    case 'eligibility':
      return <EligibilityValue item={item} />;
    case 'quality':
      return item.qualityScore === null ? (
        <Unknown detail="자료 품질 분석 없음" />
      ) : (
        <div>
          <p className="text-caption-bold text-ink">{item.qualityScore}/100</p>
          <p className="mt-xxs text-caption text-steel">합격 확률이 아닌 자료 품질</p>
        </div>
      );
    case 'benefit':
      return <BenefitValue item={item} />;
    case 'deadline':
      return item.deadlineEnd ? (
        <p className="text-caption-bold text-ink">{formatKoreanDate(item.deadlineEnd)}</p>
      ) : (
        <Unknown detail="마감일 원문 확인" />
      );
    case 'preparation':
      return item.preparation ? (
        <div>
          <p className="text-caption-bold text-ink">
            {item.preparation.completed}/{item.preparation.total} 완료
          </p>
          <p className="mt-xxs text-caption text-steel">준비 항목 진행</p>
        </div>
      ) : (
        <Unknown detail="준비 목록 없음" />
      );
    case 'application':
      return <ApplicationValue item={item} />;
    default:
      return null;
  }
}

const ROWS = [
  { key: 'eligibility', label: '신청 조건' },
  { key: 'quality', label: '판단 자료 품질' },
  { key: 'benefit', label: '지원 혜택' },
  { key: 'deadline', label: '신청 마감' },
  { key: 'preparation', label: '준비 현황' },
  { key: 'application', label: '신청 진행과 다음 행동' },
] as const;

function ProgramActions({ item }: { item: ProgramComparisonItem }) {
  const applyUrl = safeExternalUrl(item.applyUrl);
  return (
    <div className="mt-sm flex flex-wrap gap-xs">
      <Link
        href={item.detailHref}
        className="inline-flex min-h-11 items-center justify-center rounded-full bg-primary px-lg text-button-md text-on-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-deep focus-visible:ring-offset-2"
      >
        상세 보기
      </Link>
      {applyUrl && (
        <a
          href={applyUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center justify-center gap-xxs rounded-full border border-ink px-lg text-button-md text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-deep focus-visible:ring-offset-2"
        >
          신청 페이지
          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="sr-only">새 창에서 열기</span>
        </a>
      )}
    </div>
  );
}

export function ProgramComparison({ items }: { items: ProgramComparisonItem[] }) {
  if (items.length < 2) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-sm p-xxl text-center">
          <AlertCircle className="h-8 w-8 text-stone" aria-hidden="true" />
          <p className="text-body-sm-medium text-ink">비교할 지원사업을 2개 이상 선택해 주세요.</p>
          <p className="text-caption text-steel">대시보드에서 최대 4개까지 선택할 수 있어요.</p>
          <Link
            href="/dashboard"
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-primary px-xl text-button-md text-on-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-deep focus-visible:ring-offset-2"
          >
            대시보드에서 선택
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <div>
      <div className="mb-xl">
        <h1 className="text-heading-sm text-ink">지원사업 비교</h1>
        <p className="mt-xs text-body-sm text-steel">
          조건과 준비 상황을 나란히 살펴보세요. 확인 필요 항목은 공고 원문을 기준으로 판단해야 해요.
        </p>
      </div>

      <div className="hidden overflow-x-auto rounded-xl border border-hairline bg-canvas lg:block">
        <table className="w-full min-w-[56rem] table-fixed border-collapse text-left">
          <caption className="sr-only">선택한 지원사업 {items.length}개의 조건, 혜택, 일정 및 신청 준비 비교</caption>
          <thead>
            <tr className="border-b border-hairline bg-surface">
              <th scope="col" className="w-40 p-md text-caption-bold text-steel">비교 항목</th>
              {items.map((item) => (
                <th key={item.id} scope="col" className="p-md align-top">
                  {item.category && (
                    <span className="mb-xs inline-flex rounded-full border border-hairline bg-canvas px-xs py-xxs text-micro text-charcoal">
                      {item.category}
                    </span>
                  )}
                  <Link href={item.detailHref} className="block rounded-sm text-body-sm-medium text-ink underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-deep focus-visible:ring-offset-2">
                    {item.title}
                  </Link>
                  <p className="mt-xxs text-caption text-steel">{item.agency}</p>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => (
              <tr key={row.key} className="border-b border-hairline-soft last:border-b-0">
                <th scope="row" className="bg-surface p-md align-top text-caption-bold text-charcoal">{row.label}</th>
                {items.map((item) => (
                  <td key={item.id} className="p-md align-top"><ComparisonValue item={item} field={row.key} /></td>
                ))}
              </tr>
            ))}
            <tr>
              <th scope="row" className="bg-surface p-md text-caption-bold text-charcoal">바로가기</th>
              {items.map((item) => <td key={item.id} className="p-md align-top"><ProgramActions item={item} /></td>)}
            </tr>
          </tbody>
        </table>
      </div>

      <div className="grid gap-md lg:hidden">
        {items.map((item) => (
          <Card key={item.id}>
            <CardHeader>
              {item.category && (
                <span className="self-start rounded-full border border-hairline bg-surface px-xs py-xxs text-micro text-charcoal">
                  {item.category}
                </span>
              )}
              <CardTitle>{item.title}</CardTitle>
              <p className="text-caption text-steel">{item.agency}</p>
            </CardHeader>
            <CardContent>
              <dl className="divide-y divide-hairline-soft border-y border-hairline-soft">
                {ROWS.map((row) => (
                  <div key={row.key} className="grid grid-cols-[7rem_minmax(0,1fr)] gap-sm py-sm">
                    <dt className="text-caption-bold text-charcoal">{row.label}</dt>
                    <dd><ComparisonValue item={item} field={row.key} /></dd>
                  </div>
                ))}
              </dl>
              <ProgramActions item={item} />
            </CardContent>
          </Card>
        ))}
      </div>

      <p className="mt-md text-caption text-steel">
        비교 결과는 신청 자격이나 선정 가능성을 확정하지 않아요. 불충족·확인 필요 항목과 최신 공고
        원문을 신청 전에 다시 확인해 주세요.
      </p>
    </div>
  );
}

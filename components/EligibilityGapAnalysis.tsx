import Link from 'next/link';
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  HelpCircle,
  UserRoundPen,
  XCircle,
} from 'lucide-react';
import type {
  EligibilityGapAnalysis as EligibilityGapAnalysisResult,
  EligibilityGapItem,
} from '@/lib/eligibility/gap-analysis';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const STATUS_PRESENTATION: Record<
  EligibilityGapItem['status'],
  {
    label: string;
    icon: typeof CheckCircle2;
    iconClassName: string;
    badgeClassName: string;
  }
> = {
  met: {
    label: '충족',
    icon: CheckCircle2,
    iconClassName: 'text-success-text',
    badgeClassName: 'bg-success-bg text-success-text',
  },
  not_met: {
    label: '현재 정보상 불충족',
    icon: XCircle,
    iconClassName: 'text-error',
    badgeClassName: 'border border-error/40 bg-canvas text-error',
  },
  unknown: {
    label: '확인 필요',
    icon: HelpCircle,
    iconClassName: 'text-steel',
    badgeClassName: 'border border-hairline bg-surface text-charcoal',
  },
};

const PROFILE_FIELD_LABELS: Record<string, string> = {
  entity_type: '사업 형태',
  region: '사업장 지역',
  age_months: '창업일',
  employee_count: '직원 수',
  annual_revenue_krw: '연 매출',
  industry_name: '업종',
  certifications: '보유 인증',
  business_traits: '사업 특성',
  tech_domains: '기술 분야',
  extra_tags: '기업 특성',
  rnd_capability: '연구개발 역량',
  investment_stage: '투자 단계',
};

function safeExternalUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.toString() : null;
  } catch {
    return null;
  }
}

function Evidence({ item }: { item: EligibilityGapItem }) {
  const sourceUrl = safeExternalUrl(item.sourceUrl);
  const hasEvidence = Boolean(item.evidenceQuote || item.sourceTitle || sourceUrl);
  if (!hasEvidence) return null;

  return (
    <details className="mt-sm rounded-lg border border-hairline-soft bg-surface px-sm py-xs">
      <summary className="min-h-11 cursor-pointer rounded-sm py-sm text-caption-bold text-charcoal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-deep focus-visible:ring-offset-2">
        판단 근거 보기
      </summary>
      <div className="border-t border-hairline-soft pb-xs pt-sm text-caption text-steel">
        {item.evidenceQuote && (
          <blockquote className="border-l-2 border-hairline pl-sm">“{item.evidenceQuote}”</blockquote>
        )}
        {sourceUrl ? (
          <a
            href={sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-xs inline-flex min-h-11 items-center gap-xxs rounded-sm font-medium text-ink underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-deep focus-visible:ring-offset-2"
          >
            {item.sourceTitle || '공고 원문'}
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="sr-only">새 창에서 열기</span>
          </a>
        ) : item.sourceTitle ? (
          <p className="mt-xs">출처 · {item.sourceTitle}</p>
        ) : null}
      </div>
    </details>
  );
}

export function EligibilityGapAnalysis({ analysis }: { analysis: EligibilityGapAnalysisResult }) {
  if (analysis.status === 'unavailable') {
    return (
      <Card aria-labelledby="eligibility-gap-title">
        <CardHeader>
          <CardTitle id="eligibility-gap-title">내 사업 정보로 본 신청 조건</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-sm rounded-lg border border-dashed border-hairline bg-surface p-md">
            <AlertCircle className="mt-xxs h-4 w-4 shrink-0 text-steel" aria-hidden="true" />
            <div>
              <p className="text-body-sm-medium text-ink">아직 비교할 수 있는 공고 근거가 부족해요.</p>
              <p className="mt-xxs text-caption text-steel">
                자동 분석이 준비되기 전에는 원문 공고에서 신청 조건을 직접 확인해 주세요.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const hasMissingProfile = analysis.items.some((item) => item.profileIssue === 'missing');

  return (
    <Card aria-labelledby="eligibility-gap-title">
      <CardHeader className="gap-sm">
        <div className="flex flex-wrap items-start justify-between gap-sm">
          <div>
            <CardTitle id="eligibility-gap-title">내 사업 정보로 본 신청 조건</CardTitle>
            <p className="mt-xxs text-caption text-steel">
              저장된 사업 정보와 출처가 있는 공고 조건을 항목별로 비교했어요.
            </p>
          </div>
          <div className="flex flex-wrap gap-xs" aria-label="조건 비교 요약">
            <span className="rounded-full bg-success-bg px-sm py-xxs text-caption-bold text-success-text">
              충족 {analysis.counts.met}
            </span>
            <span className="rounded-full border border-error/40 bg-canvas px-sm py-xxs text-caption-bold text-error">
              불충족 {analysis.counts.notMet}
            </span>
            <span className="rounded-full border border-hairline bg-surface px-sm py-xxs text-caption-bold text-charcoal">
              확인 필요 {analysis.counts.unknown}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {hasMissingProfile && (
          <div className="mb-md flex flex-col items-start gap-sm rounded-lg border border-hairline bg-surface p-md sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-sm">
              <UserRoundPen className="mt-xxs h-4 w-4 shrink-0 text-ink" aria-hidden="true" />
              <div>
                <p className="text-body-sm-medium text-ink">프로필 정보가 없어 판단하지 못한 조건이 있어요.</p>
                <p className="mt-xxs text-caption text-steel">
                  정보 누락은 자격 미달이 아니에요. 프로필을 채우면 다시 비교해 드려요.
                </p>
              </div>
            </div>
            <Link
              href="/settings/profile"
              className="inline-flex min-h-11 w-full shrink-0 items-center justify-center rounded-full border border-ink px-lg text-button-md text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-deep focus-visible:ring-offset-2 sm:w-auto"
            >
              프로필 보완
            </Link>
          </div>
        )}

        <ul className="divide-y divide-hairline-soft border-y border-hairline-soft">
          {analysis.items.map((item) => {
            const presentation = STATUS_PRESENTATION[item.status];
            const StatusIcon = presentation.icon;
            return (
              <li key={item.id} className="py-md">
                <article className="grid gap-sm sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                  <div className="min-w-0">
                    <div className="flex items-start gap-xs">
                      <StatusIcon
                        className={`mt-xxs h-4 w-4 shrink-0 ${presentation.iconClassName}`}
                        aria-hidden="true"
                      />
                      <div className="min-w-0">
                        <h3 className="text-body-sm-medium text-ink">{item.requirement}</h3>
                        <p className="mt-xxs text-caption text-steel">{item.reason}</p>
                        {item.profileIssue === 'missing' && item.profileField && (
                          <p className="mt-xs text-caption text-charcoal">
                            프로필에서 확인할 정보 · {PROFILE_FIELD_LABELS[item.profileField] ?? item.profileField}
                          </p>
                        )}
                      </div>
                    </div>
                    <Evidence item={item} />
                  </div>

                  <div className="flex flex-wrap items-center gap-xs sm:max-w-52 sm:justify-end">
                    <span
                      className={`rounded-full px-xs py-xxs text-micro font-semibold ${presentation.badgeClassName}`}
                    >
                      {presentation.label}
                    </span>
                    <span
                      className={`rounded-full px-xs py-xxs text-micro font-semibold ${
                        item.verification === 'verified'
                          ? 'bg-success-bg text-success-text'
                          : 'border border-hairline bg-surface text-charcoal'
                      }`}
                    >
                      {item.verification === 'verified' ? '공고 확인' : 'AI 해석 · 확인 필요'}
                    </span>
                    {item.verification === 'inferred' && item.confidence !== null && (
                      <span className="text-micro text-stone">
                        신뢰도 {Math.round(item.confidence * 100)}%
                      </span>
                    )}
                  </div>
                </article>
              </li>
            );
          })}
        </ul>

        <p className="mt-md text-caption text-steel">
          이 비교는 신청 가능성을 돕는 참고 정보이며 자격을 확정하지 않아요. 불충족 또는 확인 필요
          항목은 신청 전 공고 원문과 담당 기관을 통해 확인해 주세요.
        </p>
      </CardContent>
    </Card>
  );
}

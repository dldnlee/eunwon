import { AlertCircle, CheckCircle2, HelpCircle, ShieldCheck, XCircle } from 'lucide-react';
import type { MatchConfidenceAssessment } from '@/lib/match-confidence';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const RESULT_PRESENTATION = {
  aligned: {
    label: '확인한 조건은 현재 프로필과 일치',
    description: '현재 비교할 수 있는 조건에서는 다른 정보가 발견되지 않았어요.',
    icon: CheckCircle2,
    iconClassName: 'text-success-text',
    badgeClassName: 'bg-success-bg text-success-text',
  },
  mismatch: {
    label: '현재 정보와 다른 조건 있음',
    description: '아래 신청 조건에서 불충족 항목을 먼저 확인해 주세요.',
    icon: XCircle,
    iconClassName: 'text-error',
    badgeClassName: 'border border-error/40 bg-canvas text-error',
  },
  unknown: {
    label: '추가 확인 필요',
    description: '프로필 또는 공고 근거가 부족해 일부 조건을 판단하지 못했어요.',
    icon: HelpCircle,
    iconClassName: 'text-steel',
    badgeClassName: 'border border-hairline bg-surface text-charcoal',
  },
} as const;

function QualityRow({
  label,
  value,
  description,
}: {
  label: string;
  value: number;
  description: string;
}) {
  const percentage = Math.round(value * 100);
  return (
    <div>
      <div className="flex items-baseline justify-between gap-sm">
        <p className="text-body-sm-medium text-ink">{label}</p>
        <span className="shrink-0 text-caption-bold text-charcoal">{percentage}%</span>
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percentage}
        className="mt-xs h-2 overflow-hidden rounded-full bg-hairline-soft"
      >
        <span className="block h-full rounded-full bg-ink" style={{ width: `${percentage}%` }} />
      </div>
      <p className="mt-xxs text-caption text-steel">{description}</p>
    </div>
  );
}

function freshnessCopy(assessment: MatchConfidenceAssessment): string {
  if (assessment.freshnessDays === null) return '분석 시점을 확인할 수 없어 최신성 판단이 필요해요.';
  if (assessment.components.freshnessScore === 0) {
    return '공고가 분석 이후 바뀌었거나 오래된 근거예요. 원문을 다시 확인해 주세요.';
  }
  if (assessment.freshnessDays === 0) return '오늘 확인한 공고 근거예요.';
  return `${assessment.freshnessDays}일 전에 확인한 공고 근거예요.`;
}

export function MatchConfidence({ assessment }: { assessment: MatchConfidenceAssessment }) {
  const result = RESULT_PRESENTATION[assessment.resultState];
  const ResultIcon = result.icon;

  return (
    <Card aria-labelledby="match-confidence-title">
      <CardHeader className="gap-sm">
        <div className="flex flex-wrap items-start justify-between gap-sm">
          <div>
            <div className="flex items-center gap-xs">
              <ShieldCheck className="h-4 w-4 text-ink" aria-hidden="true" />
              <CardTitle id="match-confidence-title">매칭 판단 자료 품질</CardTitle>
            </div>
            <p className="mt-xxs text-caption text-steel">
              합격 가능성이 아니라 공고 근거, 프로필 정보, 분석 최신성을 나타내요.
            </p>
          </div>
          <span className="rounded-full border border-hairline bg-surface px-sm py-xxs text-caption-bold text-charcoal">
            자료 품질 {assessment.confidenceScore}/100
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-start gap-sm rounded-lg border border-hairline bg-surface p-md">
          <ResultIcon className={`mt-xxs h-4 w-4 shrink-0 ${result.iconClassName}`} aria-hidden="true" />
          <div className="min-w-0">
            <span className={`inline-flex rounded-full px-xs py-xxs text-micro font-semibold ${result.badgeClassName}`}>
              {result.label}
            </span>
            <p className="mt-xs text-caption text-charcoal">{result.description}</p>
          </div>
        </div>

        {assessment.components.total > 0 ? (
          <div className="mt-md grid gap-md sm:grid-cols-3">
            <QualityRow
              label="공고 근거"
              value={assessment.evidenceCoverage}
              description={`${assessment.components.total}개 중 ${assessment.components.verified}개를 원문에서 직접 확인했어요.`}
            />
            <QualityRow
              label="프로필 비교"
              value={assessment.profileCoverage}
              description={`${assessment.components.total}개 중 ${assessment.components.met + assessment.components.notMet}개를 현재 프로필로 비교했어요.`}
            />
            <QualityRow
              label="근거 최신성"
              value={assessment.components.freshnessScore}
              description={freshnessCopy(assessment)}
            />
          </div>
        ) : (
          <div className="mt-md flex items-start gap-sm rounded-lg border border-dashed border-hairline p-md">
            <AlertCircle className="mt-xxs h-4 w-4 shrink-0 text-steel" aria-hidden="true" />
            <p className="text-caption text-steel">
              비교할 수 있는 공고 조건이 없어 자료 품질을 판단하지 못했어요.
            </p>
          </div>
        )}

        <p className="mt-md text-caption text-steel">
          자료 품질 점수가 높아도 불충족 항목이 충족으로 바뀌거나 신청 자격이 확정되지는 않아요.
          최종 판단은 아래 조건별 근거와 공고 원문을 기준으로 해 주세요.
        </p>
      </CardContent>
    </Card>
  );
}

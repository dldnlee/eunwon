import { AlertTriangle, ExternalLink, HelpCircle } from 'lucide-react';

export interface DuplicateBenefitEvidence {
  level: 'possible_conflict' | 'needs_confirmation';
  priorTitle: string;
  clause: string | null;
  sourceUrl: string | null;
}

function safeExternalUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.toString() : null;
  } catch {
    return null;
  }
}

export function DuplicateBenefitNotice({ evidence }: { evidence: DuplicateBenefitEvidence }) {
  const possibleConflict = evidence.level === 'possible_conflict';
  const Icon = possibleConflict ? AlertTriangle : HelpCircle;
  const sourceUrl = safeExternalUrl(evidence.sourceUrl);
  const heading = possibleConflict ? '중복수혜 가능성을 확인해 주세요' : '중복수혜 조건을 추가로 확인해야 해요';

  return (
    <section
      aria-labelledby="duplicate-benefit-heading"
      className="rounded-lg border border-hairline bg-surface-soft p-md"
    >
      <div className="flex items-start gap-sm">
        <Icon
          className={`mt-xxs h-4 w-4 shrink-0 ${possibleConflict ? 'text-error' : 'text-steel'}`}
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-xs">
            <h2 id="duplicate-benefit-heading" className="text-body-sm-medium text-ink">
              {heading}
            </h2>
            <span
              className={`rounded-full px-xs py-xxs text-micro font-semibold ${
                possibleConflict
                  ? 'border border-error/40 bg-canvas text-error'
                  : 'border border-hairline bg-canvas text-charcoal'
              }`}
            >
              {possibleConflict ? '가능성 있음' : '근거 확인 필요'}
            </span>
          </div>

          <p className="mt-xs text-body-sm text-charcoal">
            이전 수혜 사업 <strong>“{evidence.priorTitle}”</strong>과(와) 관련된 제한 조항이 있을 수
            있어요. 이 안내만으로 중복수혜 여부를 확정할 수는 없어요.
          </p>

          {evidence.clause ? (
            <div className="mt-sm rounded-lg border border-hairline-soft bg-canvas p-sm">
              <p className="text-caption-bold text-charcoal">공고에서 확인한 조항</p>
              <blockquote className="mt-xs border-l-2 border-hairline pl-sm text-caption text-steel">
                “{evidence.clause}”
              </blockquote>
              {sourceUrl && (
                <a
                  href={sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-xs inline-flex min-h-11 items-center gap-xxs rounded-sm text-caption-bold text-ink underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-deep focus-visible:ring-offset-2"
                >
                  조항 출처 원문 보기
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                  <span className="sr-only">새 창에서 열기</span>
                </a>
              )}
            </div>
          ) : (
            <p className="mt-sm text-caption text-steel">
              직접 인용할 수 있는 제한 조항이 없어 공고 원문 또는 담당 기관 확인이 필요해요.
            </p>
          )}

          <p className="mt-sm text-caption text-steel">
            실제 중복수혜 제한 적용 여부는 지원 내용·기간·재원과 기관 기준에 따라 달라질 수 있어요.
            신청 전 공고 원문과 담당 기관에 확인해 주세요.
          </p>
        </div>
      </div>
    </section>
  );
}

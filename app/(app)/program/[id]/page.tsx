import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SaveToggleButton } from '@/components/SaveToggleButton';
import { ShareButton } from '@/components/ShareButton';
import { MatchExplanation } from '@/components/MatchExplanation';
import { EligibilityGapAnalysis } from '@/components/EligibilityGapAnalysis';
import { TOSS_ENABLED } from '@/lib/payments';
import { findDuplicateBenefitConflict } from '@/lib/matching';
import {
  evaluateEligibilityGaps,
  type EligibilityGapRequirement,
} from '@/lib/eligibility/gap-analysis';
import { ELIGIBILITY_EXTRACTOR_VERSION } from '@/lib/eligibility/extraction';
import type { Profile } from '@/lib/types';
import { isProUser } from '@/lib/trial';
import { formatKoreanDate } from '@/lib/utils';
import { ExternalLink, AlertTriangle } from 'lucide-react';

export default async function ProgramDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const [{ data: program }, { data: profile }, { data: savedRow }] = await Promise.all([
    supabase.from('programs').select('*').eq('id', params.id).maybeSingle(),
    supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
    supabase
      .from('saved_programs')
      .select('id')
      .eq('user_id', user.id)
      .eq('program_id', params.id)
      .maybeSingle(),
  ]);

  if (!program) notFound();

  const isPro = !!profile && isProUser(profile.subscription, user.created_at);
  const duplicateConflict = await findDuplicateBenefitConflict(supabase, user.id, program);
  const { data: extractionRun } = await supabase
    .from('program_extraction_runs')
    .select('id')
    .eq('program_id', program.id)
    .eq('extractor_version', ELIGIBILITY_EXTRACTOR_VERSION)
    .eq('status', 'succeeded')
    .order('completed_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: requirementRows } = extractionRun
    ? await supabase
        .from('program_eligibility_requirements')
        .select('id,requirement_type,operator,value_json,normalized_text,verification,confidence,evidence_quote,program_source_documents(title,source_url)')
        .eq('extraction_run_id', extractionRun.id)
        .order('created_at', { ascending: true })
    : { data: null };

  const requirements = (requirementRows ?? []).map((row) => {
    const joinedSource = Array.isArray(row.program_source_documents)
      ? row.program_source_documents[0] ?? null
      : row.program_source_documents;
    return {
      id: row.id,
      requirementType: row.requirement_type,
      operator: row.operator,
      value: row.value_json,
      normalizedText: row.normalized_text,
      verification: row.verification,
      confidence: row.confidence,
      evidenceQuote: row.evidence_quote,
      sourceTitle: joinedSource?.title ?? null,
      sourceUrl: joinedSource?.source_url ?? null,
    } as EligibilityGapRequirement;
  });
  const gapAnalysis = profile
    ? evaluateEligibilityGaps(requirements, profile as Profile)
    : { status: 'unavailable' as const, items: [], counts: { met: 0, notMet: 0, unknown: 0 } };

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-lg">
      <div>
        <div className="mb-sm flex flex-wrap gap-xs">
          {program.category && <Badge variant="outline">{program.category}</Badge>}
          {program.region.map((r: string) => (
            <Badge key={r}>{r}</Badge>
          ))}
        </div>
        <h1 className="text-heading-sm text-ink">{program.title}</h1>
        <p className="mt-xs text-body-sm text-steel">
          {program.agency}{program.exec_agency ? ` · ${program.exec_agency}` : ''}
        </p>
      </div>

      {duplicateConflict && (
        <div className="flex items-start gap-sm rounded-md border border-hairline bg-surface-soft p-md text-body-sm text-charcoal">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-error" aria-hidden="true" />
          <p>
            이미 수혜받은 &ldquo;{duplicateConflict.title}&rdquo;과 같은 분야({program.category})의 지원사업이에요 —
            중복수혜 제한에 해당될 수 있으니 신청 전 반드시 확인해보세요.
          </p>
        </div>
      )}

      <div className="flex flex-wrap gap-sm">
        <SaveToggleButton userId={user.id} programId={program.id} initialSaved={!!savedRow} />
        <ShareButton title={program.title} />
        {program.apply_url && (
          <a href={program.apply_url} target="_blank" rel="noopener noreferrer">
            <Button>신청 페이지로 이동</Button>
          </a>
        )}
      </div>

      {isPro && <MatchExplanation programId={program.id} />}

      <EligibilityGapAnalysis analysis={gapAnalysis} />

      <Card>
        <CardHeader>
          <CardTitle>지원 개요</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-md text-body-sm">
          <div>
            <p className="text-stone">접수 기간</p>
            <p className="font-medium text-ink">
              {formatKoreanDate(program.deadline_start)} ~ {formatKoreanDate(program.deadline_end)}
            </p>
          </div>
          <div>
            <p className="text-stone">지원 대상</p>
            <p className="font-medium text-ink">{program.target_raw ?? '-'}</p>
          </div>
        </CardContent>
      </Card>

      {(program.apply_steps?.length > 0 || program.apply_method) && (
        <Card>
          <CardHeader>
            <CardTitle>신청 방법</CardTitle>
          </CardHeader>
          <CardContent>
            {program.apply_steps?.length > 0 ? (
              <ol className="flex flex-col gap-sm">
                {program.apply_steps.map((step: string, i: number) => (
                  <li key={i} className="flex gap-sm">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink text-caption font-semibold text-on-primary">
                      {i + 1}
                    </span>
                    <p className="text-body-sm leading-relaxed text-charcoal">{step}</p>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-body-sm leading-relaxed text-charcoal">{program.apply_method}</p>
            )}
          </CardContent>
        </Card>
      )}

      {program.ai_summary && (
        <Card>
          <CardHeader>
            <CardTitle>AI 요약</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-body-sm leading-relaxed text-charcoal">{program.ai_summary}</p>
            {program.ai_tags?.length > 0 && (
              <div className="mt-sm flex flex-wrap gap-xs">
                {program.ai_tags.map((tag: string) => (
                  <Badge key={tag} variant="default">#{tag}</Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {program.description && (
        <Card>
          <CardHeader>
            <CardTitle>상세 내용</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-line text-body-sm leading-relaxed text-charcoal">
              {program.description}
            </p>
          </CardContent>
        </Card>
      )}

      {isPro ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-sm p-lg text-center sm:flex-row sm:justify-between sm:text-left">
            <p className="text-body-sm text-charcoal">사업계획서 초안을 AI로 작성해드려요.</p>
            <Link href={`/program/${program.id}/generate`} className="shrink-0">
              <Button size="sm">사업계획서 생성</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-sm p-lg text-center sm:flex-row sm:justify-between sm:text-left">
            <p className="text-body-sm text-charcoal">
              {TOSS_ENABLED
                ? 'Pro 플랜에서 사업계획서를 AI로 작성할 수 있어요.'
                : 'Pro 플랜은 결제 연동 준비 중이에요.'}
            </p>
            {TOSS_ENABLED && (
              <Link href="/upgrade" className="shrink-0">
                <Button variant="outline" size="sm">Pro 업그레이드</Button>
              </Link>
            )}
          </CardContent>
        </Card>
      )}

      {program.detail_url && (
        <a
          href={program.detail_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center gap-1 self-start rounded-sm py-sm text-body-sm text-brand-blue-deep hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-deep focus-visible:ring-offset-2"
        >
          원본 공고 보기 <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
        </a>
      )}
    </div>
  );
}

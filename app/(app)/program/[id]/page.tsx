import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SaveToggleButton } from '@/components/SaveToggleButton';
import { ShareButton } from '@/components/ShareButton';
import { MatchExplanation } from '@/components/MatchExplanation';
import { DraftAssistant } from '@/components/DraftAssistant';
import { TOSS_ENABLED } from '@/lib/payments';
import { formatAmount, formatKoreanDate } from '@/lib/utils';
import { ExternalLink } from 'lucide-react';

export default async function ProgramDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const [{ data: program }, { data: profile }, { data: savedRow }] = await Promise.all([
    supabase.from('programs').select('*').eq('id', params.id).maybeSingle(),
    supabase.from('profiles').select('subscription').eq('id', user.id).maybeSingle(),
    supabase
      .from('saved_programs')
      .select('id')
      .eq('user_id', user.id)
      .eq('program_id', params.id)
      .maybeSingle(),
  ]);

  if (!program) notFound();

  const isPro = profile?.subscription === 'pro';

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

      <Card>
        <CardHeader>
          <CardTitle>지원 개요</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-md text-body-sm">
          <div>
            <p className="text-stone">지원 금액</p>
            <p className="font-medium text-ink">{formatAmount(program.amount_text, program.amount_max)}</p>
          </div>
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
          <div>
            <p className="text-stone">신청 방법</p>
            <p className="font-medium text-ink">{program.apply_method ?? '-'}</p>
          </div>
        </CardContent>
      </Card>

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
        <DraftAssistant programId={program.id} />
      ) : (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-sm p-lg text-center sm:flex-row sm:justify-between sm:text-left">
            <p className="text-body-sm text-charcoal">
              {TOSS_ENABLED
                ? 'Pro 플랜에서 신청서 초안을 AI로 작성할 수 있어요.'
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

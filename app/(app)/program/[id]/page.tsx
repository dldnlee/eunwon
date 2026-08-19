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
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {program.category && <Badge variant="outline">{program.category}</Badge>}
          {program.region.map((r: string) => (
            <Badge key={r} variant="secondary">{r}</Badge>
          ))}
        </div>
        <h1 className="text-2xl font-bold text-slate-900">{program.title}</h1>
        <p className="mt-1 text-slate-500">{program.agency}{program.exec_agency ? ` · ${program.exec_agency}` : ''}</p>
      </div>

      <div className="flex flex-wrap gap-3">
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
        <CardContent className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-slate-400">지원 금액</p>
            <p className="font-medium text-slate-900">{formatAmount(program.amount_text, program.amount_max)}</p>
          </div>
          <div>
            <p className="text-slate-400">접수 기간</p>
            <p className="font-medium text-slate-900">
              {formatKoreanDate(program.deadline_start)} ~ {formatKoreanDate(program.deadline_end)}
            </p>
          </div>
          <div>
            <p className="text-slate-400">지원 대상</p>
            <p className="font-medium text-slate-900">{program.target_raw ?? '-'}</p>
          </div>
          <div>
            <p className="text-slate-400">신청 방법</p>
            <p className="font-medium text-slate-900">{program.apply_method ?? '-'}</p>
          </div>
        </CardContent>
      </Card>

      {program.ai_summary && (
        <Card>
          <CardHeader>
            <CardTitle>AI 요약</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed text-slate-700">{program.ai_summary}</p>
            {program.ai_tags?.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
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
            <p className="whitespace-pre-line text-sm leading-relaxed text-slate-700">
              {program.description}
            </p>
          </CardContent>
        </Card>
      )}

      {isPro ? (
        <DraftAssistant programId={program.id} />
      ) : (
        <Card className="border-dashed">
          <CardContent className="flex items-center justify-between p-5">
            <p className="text-sm text-slate-600">
              {TOSS_ENABLED
                ? 'Pro 플랜에서 신청서 초안을 AI로 작성할 수 있어요.'
                : 'Pro 플랜은 결제 연동 준비 중이에요.'}
            </p>
            {TOSS_ENABLED && (
              <Link href="/upgrade">
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
          className="text-sm text-blue-600 hover:underline"
        >
          원본 공고 보기 →
        </a>
      )}
    </div>
  );
}

import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { DocumentGenerator } from '@/components/DocumentGenerator';
import { Card, CardContent } from '@/components/ui/card';
import { ChevronLeft } from 'lucide-react';

export default async function GenerateDocumentPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const [{ data: program }, { data: profile }] = await Promise.all([
    supabase.from('programs').select('id, title, agency').eq('id', params.id).maybeSingle(),
    supabase.from('profiles').select('subscription').eq('id', user.id).maybeSingle(),
  ]);

  if (!program) notFound();

  if (profile?.subscription !== 'pro') {
    redirect(`/program/${params.id}`);
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-lg">
      <Link
        href={`/program/${program.id}`}
        className="inline-flex min-h-11 w-fit items-center gap-1 text-body-sm text-steel hover:text-ink"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" /> 지원사업으로 돌아가기
      </Link>

      <div>
        <h1 className="text-heading-sm text-ink">사업계획서 생성</h1>
        <p className="mt-xs text-body-sm text-steel">
          {program.title} · {program.agency}
        </p>
      </div>

      <DocumentGenerator programId={program.id} />

      <Card className="border-dashed">
        <CardContent className="p-lg text-body-sm text-steel">
          생성된 초안은 참고용이에요. 제출 전 반드시 실제 공고문의 요구사항과 대조해서 검토해주세요.
        </CardContent>
      </Card>
    </div>
  );
}

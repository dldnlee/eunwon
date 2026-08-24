'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Sparkles } from 'lucide-react';

export function MatchExplanation({ programId }: { programId: string }) {
  const [explanation, setExplanation] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchExplanation() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/ai/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ programId }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? '설명을 불러오지 못했어요.');
      }

      const data = await res.json();
      setExplanation(data.explanation);
    } catch (e) {
      setError(e instanceof Error ? e.message : '알 수 없는 오류가 발생했어요.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card id="explain" className="border-brand-blue-200 bg-brand-blue-200/10">
      <CardHeader>
        <CardTitle className="flex items-center gap-xs text-card-title">
          <Sparkles className="h-4 w-4 text-brand-blue-deep" aria-hidden="true" /> AI가 설명하는 매칭 맥락
        </CardTitle>
      </CardHeader>
      <CardContent>
        {explanation ? (
          <div aria-live="polite">
            <p className="text-body-sm text-charcoal">{explanation}</p>
            <p className="mt-sm text-caption text-steel">
              AI 설명은 보조 정보예요. 위 조건별 불충족·확인 필요 판단보다 우선하지 않으며,
              신청 전 공고 원문을 확인해야 해요.
            </p>
          </div>
        ) : loading ? (
          <div className="flex items-center gap-sm text-body-sm text-steel" role="status">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-hairline border-t-brand-blue-deep" aria-hidden="true" />
            AI가 매칭 맥락을 정리하고 있어요…
          </div>
        ) : (
          <div>
            <p className="mb-sm text-caption text-steel">
              조건별 판단을 바꾸지 않는 범위에서 사업 정보와 공고의 연결점을 설명해 드려요.
            </p>
            <Button size="sm" onClick={fetchExplanation} disabled={loading}>
              AI 보조 설명 보기
            </Button>
          </div>
        )}
        {error && (
          <p role="alert" className="mt-sm text-body-sm text-error">
            {error}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

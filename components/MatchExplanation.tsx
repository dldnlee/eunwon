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
          <Sparkles className="h-4 w-4 text-brand-blue-deep" aria-hidden="true" /> 왜 나에게 맞나요?
        </CardTitle>
      </CardHeader>
      <CardContent>
        {explanation ? (
          <p className="text-body-sm text-charcoal">{explanation}</p>
        ) : loading ? (
          <div className="flex items-center gap-sm text-body-sm text-steel">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-hairline border-t-brand-blue-deep" aria-hidden="true" />
            AI가 매칭 이유를 분석하고 있어요...
          </div>
        ) : (
          <Button size="sm" onClick={fetchExplanation} disabled={loading}>
            AI 설명 보기
          </Button>
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

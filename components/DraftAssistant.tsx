'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText } from 'lucide-react';

export function DraftAssistant({ programId }: { programId: string }) {
  const [outline, setOutline] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchDraft() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/ai/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ programId }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? '초안을 생성하지 못했어요.');
      }

      const data = await res.json();
      setOutline(data.outline);
    } catch (e) {
      setError(e instanceof Error ? e.message : '알 수 없는 오류가 발생했어요.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-xs text-card-title">
          <FileText className="h-4 w-4 text-brand-blue-deep" aria-hidden="true" /> 신청서 초안 작성
        </CardTitle>
      </CardHeader>
      <CardContent>
        {outline ? (
          <pre className="whitespace-pre-wrap font-sans text-body-sm text-charcoal">{outline}</pre>
        ) : loading ? (
          <div className="flex items-center gap-sm text-body-sm text-steel">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-hairline border-t-brand-blue-deep" aria-hidden="true" />
            사업계획서 목차를 작성하고 있어요...
          </div>
        ) : (
          <Button size="sm" onClick={fetchDraft} disabled={loading}>
            사업계획서 목차 생성
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

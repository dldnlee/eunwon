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
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="h-4 w-4 text-blue-600" /> 신청서 초안 작성
        </CardTitle>
      </CardHeader>
      <CardContent>
        {outline ? (
          <pre className="whitespace-pre-wrap font-sans text-sm text-slate-700">{outline}</pre>
        ) : (
          <Button size="sm" onClick={fetchDraft} disabled={loading}>
            {loading ? '작성 중...' : '사업계획서 목차 생성'}
          </Button>
        )}
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </CardContent>
    </Card>
  );
}

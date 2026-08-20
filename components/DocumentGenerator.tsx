'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { FileText, Copy, Check } from 'lucide-react';

export function DocumentGenerator({ programId }: { programId: string }) {
  const [document, setDocument] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleGenerate() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/ai/generate-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ programId }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? '신청서를 생성하지 못했어요.');
      }

      const data = await res.json();
      setDocument(data.document);
    } catch (e) {
      setError(e instanceof Error ? e.message : '알 수 없는 오류가 발생했어요.');
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    if (!document) return;
    await navigator.clipboard.writeText(document);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-xs text-card-title">
          <FileText className="h-4 w-4 text-brand-blue-deep" aria-hidden="true" /> 사업계획서 생성
        </CardTitle>
        <CardDescription>
          사업 개요 → 신청 배경 → 추진 계획 → 기대 효과 순으로, 등록하신 사업 정보를 바탕으로 초안을 작성해드려요.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-md">
        {document ? (
          <>
            <div className="whitespace-pre-wrap rounded-md border border-hairline bg-surface p-lg text-body-sm text-charcoal">
              {document}
            </div>
            <Button variant="secondary" size="sm" onClick={handleCopy} className="self-start">
              {copied ? (
                <>
                  <Check className="h-4 w-4" aria-hidden="true" /> 복사됨
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" aria-hidden="true" /> 전체 복사
                </>
              )}
            </Button>
          </>
        ) : loading ? (
          <div className="flex items-center gap-sm text-body-sm text-steel">
            <span
              className="h-4 w-4 animate-spin rounded-full border-2 border-hairline border-t-brand-blue-deep"
              aria-hidden="true"
            />
            AI가 신청서를 작성하고 있어요... (최대 30초 정도 걸려요)
          </div>
        ) : (
          <Button onClick={handleGenerate} disabled={loading} className="self-start">
            사업계획서 초안 생성
          </Button>
        )}
        {error && (
          <p role="alert" className="text-body-sm text-error">
            {error}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

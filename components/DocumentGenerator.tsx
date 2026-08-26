'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { FileText, Copy, Check, FileDown } from 'lucide-react';

type ExportFormat = 'docx' | 'hwpx';

export function DocumentGenerator({ programId }: { programId: string }) {
  const [draft, setDraft] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState<ExportFormat | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

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
      setDraft(data.document);
    } catch (e) {
      setError(e instanceof Error ? e.message : '알 수 없는 오류가 발생했어요.');
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    if (!draft) return;
    await navigator.clipboard.writeText(draft);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleDownload(format: ExportFormat) {
    if (!draft) return;
    setDownloading(format);
    setDownloadError(null);

    try {
      const res = await fetch(`/api/ai/generate-document/${format}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ programId, document: draft }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? '파일을 만들지 못했어요.');
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = window.document.createElement('a');
      link.href = url;
      link.download = `eunwon-business-plan-${programId}.${format}`;
      window.document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      setDownloadError(e instanceof Error ? e.message : '알 수 없는 오류가 발생했어요.');
    } finally {
      setDownloading(null);
    }
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
        {draft ? (
          <>
            <div className="rounded-md border border-hairline bg-surface p-lg text-body-sm text-charcoal">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  h1: ({ children }) => <h2 className="mb-xs mt-lg text-card-title text-ink first:mt-0">{children}</h2>,
                  h2: ({ children }) => <h2 className="mb-xs mt-lg text-card-title text-ink first:mt-0">{children}</h2>,
                  h3: ({ children }) => <h3 className="mb-xs mt-md text-body-md-bold text-ink first:mt-0">{children}</h3>,
                  p: ({ children }) => <p className="mb-sm leading-relaxed last:mb-0">{children}</p>,
                  ul: ({ children }) => <ul className="mb-sm list-disc space-y-xxs pl-lg last:mb-0">{children}</ul>,
                  ol: ({ children }) => <ol className="mb-sm list-decimal space-y-xxs pl-lg last:mb-0">{children}</ol>,
                  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                  strong: ({ children }) => <strong className="font-semibold text-ink">{children}</strong>,
                }}
              >
                {draft}
              </ReactMarkdown>
            </div>
            <div className="flex flex-wrap items-center gap-xs">
              <Button variant="secondary" size="sm" onClick={handleCopy}>
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
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleDownload('docx')}
                disabled={downloading !== null}
                aria-label="사업계획서 워드(.docx) 다운로드"
              >
                <FileDown className="h-4 w-4" aria-hidden="true" />
                {downloading === 'docx' ? '만드는 중...' : '.docx 다운로드'}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleDownload('hwpx')}
                disabled={downloading !== null}
                aria-label="사업계획서 한글(.hwpx) 다운로드"
              >
                <FileDown className="h-4 w-4" aria-hidden="true" />
                {downloading === 'hwpx' ? '만드는 중...' : '.hwpx 다운로드'}
              </Button>
            </div>
            {downloadError && (
              <p role="alert" className="text-body-sm text-error">
                {downloadError}
              </p>
            )}
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

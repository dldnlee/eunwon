'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, ExternalLink, FileCheck2, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Verification = 'verified' | 'inferred' | 'user';

type ChecklistItem = {
  id: string;
  label: string;
  completed: boolean;
  verification: Verification;
  confidence: number | null;
  evidenceQuote: string | null;
  sourceTitle: string | null;
  sourceUrl: string | null;
};

type ChecklistResponse = {
  items: ChecklistItem[];
  sourceStatus: 'ready' | 'pending' | 'unavailable';
};

const VERIFICATION_COPY: Record<Verification, { label: string; className: string }> = {
  verified: { label: '공고 확인', className: 'bg-success-bg text-success-text' },
  inferred: { label: '확인 필요', className: 'border border-hairline bg-surface text-charcoal' },
  user: { label: '직접 추가', className: 'border border-hairline bg-canvas text-steel' },
};

export function PreparationChecklist({ savedId }: { savedId: string }) {
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [sourceStatus, setSourceStatus] = useState<ChecklistResponse['sourceStatus']>('pending');
  const [newItem, setNewItem] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [busyItemId, setBusyItemId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const loadChecklist = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/saved-programs/${savedId}/checklist`);
      if (!response.ok) throw new Error('checklist fetch failed');
      const data = (await response.json()) as ChecklistResponse;
      setItems(data.items);
      setSourceStatus(data.sourceStatus);
    } catch {
      setError('준비 목록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setLoading(false);
    }
  }, [savedId]);

  useEffect(() => {
    void loadChecklist();
  }, [loadChecklist]);

  async function addItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const label = newItem.trim();
    if (!label || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const response = await fetch(`/api/saved-programs/${savedId}/checklist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label }),
      });
      if (!response.ok) throw new Error('checklist create failed');
      setNewItem('');
      await loadChecklist();
    } catch {
      setError('항목을 추가하지 못했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleItem(item: ChecklistItem) {
    if (busyItemId) return;
    const completed = !item.completed;
    setBusyItemId(item.id);
    setError('');
    setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, completed } : entry));
    try {
      const response = await fetch(`/api/saved-programs/${savedId}/checklist`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: item.id, completed }),
      });
      if (!response.ok) throw new Error('checklist update failed');
    } catch {
      setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, completed: item.completed } : entry));
      setError('완료 상태를 저장하지 못했어요. 다시 시도해 주세요.');
    } finally {
      setBusyItemId(null);
    }
  }

  async function deleteItem(item: ChecklistItem) {
    if (busyItemId) return;
    setBusyItemId(item.id);
    setError('');
    try {
      const response = await fetch(`/api/saved-programs/${savedId}/checklist`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: item.id }),
      });
      if (!response.ok) throw new Error('checklist delete failed');
      setItems((current) => current.filter((entry) => entry.id !== item.id));
    } catch {
      setError('항목을 삭제하지 못했어요. 다시 시도해 주세요.');
    } finally {
      setBusyItemId(null);
    }
  }

  const completedCount = items.filter((item) => item.completed).length;

  return (
    <section aria-labelledby={`preparation-${savedId}`} className="rounded-lg border border-hairline bg-canvas p-md">
      <div className="flex items-start justify-between gap-md max-sm:flex-col">
        <div className="min-w-0">
          <div className="flex items-center gap-xs">
            <FileCheck2 className="h-4 w-4 shrink-0 text-ink" aria-hidden="true" />
            <h3 id={`preparation-${savedId}`} className="text-caption-bold text-ink">준비할 서류와 확인 사항</h3>
          </div>
          <p className="mt-xxs text-caption text-steel">공고 근거와 AI 해석을 구분했어요. 제출 전 원문을 꼭 확인해 주세요.</p>
        </div>
        {!loading && items.length > 0 && (
          <span className="shrink-0 rounded-full bg-surface px-sm py-xxs text-caption-bold text-charcoal" aria-label={`${items.length}개 중 ${completedCount}개 완료`}>
            {completedCount}/{items.length} 완료
          </span>
        )}
      </div>

      {loading ? (
        <div className="mt-md flex items-center gap-sm rounded-lg bg-surface p-md" role="status">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-hairline border-t-ink" aria-hidden="true" />
          <span className="text-body-sm text-steel">공고 근거에서 준비 항목을 확인하고 있어요…</span>
        </div>
      ) : (
        <>
          {items.length > 0 ? (
            <ul className="mt-md divide-y divide-hairline-soft border-y border-hairline-soft">
              {items.map((item) => {
                const verification = VERIFICATION_COPY[item.verification];
                const hasEvidence = Boolean(item.evidenceQuote || item.sourceTitle || item.sourceUrl);
                return (
                  <li key={item.id} className="py-sm">
                    <div className="flex items-start gap-xs">
                      <label className="flex min-h-11 min-w-0 flex-1 cursor-pointer items-start gap-sm rounded-sm py-xs focus-within:ring-2 focus-within:ring-brand-blue-deep focus-within:ring-offset-2">
                        <input
                          type="checkbox"
                          checked={item.completed}
                          disabled={busyItemId === item.id}
                          onChange={() => void toggleItem(item)}
                          className="mt-xxs h-4 w-4 shrink-0 accent-primary"
                        />
                        <span className="min-w-0">
                          <span className={`block text-body-sm ${item.completed ? 'text-stone line-through' : 'text-charcoal'}`}>{item.label}</span>
                          <span className="mt-xxs flex flex-wrap items-center gap-xs">
                            <span className={`rounded-full px-xs py-xxs text-micro font-semibold ${verification.className}`}>{verification.label}</span>
                            {item.verification === 'inferred' && item.confidence !== null && (
                              <span className="text-micro text-stone">AI 신뢰도 {Math.round(item.confidence * 100)}%</span>
                            )}
                          </span>
                        </span>
                      </label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={busyItemId === item.id}
                        onClick={() => void deleteItem(item)}
                        aria-label={`${item.label} 삭제`}
                        className="shrink-0 text-stone hover:text-error"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </div>
                    {hasEvidence && (
                      <details className="ml-[1.75rem] mt-xs rounded-lg bg-surface px-sm py-xs">
                        <summary className="cursor-pointer rounded-sm text-caption font-medium text-charcoal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-deep focus-visible:ring-offset-2">
                          근거 보기
                        </summary>
                        <div className="mt-xs border-t border-hairline-soft pt-xs text-caption text-steel">
                          {item.evidenceQuote && <blockquote className="border-l-2 border-hairline pl-sm">“{item.evidenceQuote}”</blockquote>}
                          {item.sourceUrl ? (
                            <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-xs inline-flex min-h-11 items-center gap-xxs rounded-sm font-medium text-ink underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-deep focus-visible:ring-offset-2">
                              {item.sourceTitle || '공고 원문'}
                              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                              <span className="sr-only">새 창에서 열기</span>
                            </a>
                          ) : item.sourceTitle ? <p className="mt-xs">출처 · {item.sourceTitle}</p> : null}
                        </div>
                      </details>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="mt-md rounded-lg border border-dashed border-hairline bg-surface p-md">
              <p className="text-body-sm-medium text-ink">아직 준비 항목이 없어요.</p>
              <p className="mt-xxs text-caption text-steel">
                {sourceStatus === 'pending' && '공고 분석이 끝나면 출처가 있는 항목을 자동으로 보여드려요.'}
                {sourceStatus === 'unavailable' && '이 공고는 자동 분석 근거가 부족해요. 원문을 확인하며 직접 추가해 주세요.'}
                {sourceStatus === 'ready' && '필요한 서류나 확인할 내용을 직접 추가해 보세요.'}
              </p>
            </div>
          )}

          <form onSubmit={addItem} className="mt-md flex gap-xs max-sm:flex-col">
            <label htmlFor={`new-checklist-${savedId}`} className="sr-only">준비 항목 추가</label>
            <Input
              id={`new-checklist-${savedId}`}
              value={newItem}
              onChange={(event) => setNewItem(event.target.value)}
              placeholder="예: 사업자등록증 최신본 준비"
              maxLength={500}
              disabled={submitting}
              className="flex-1"
            />
            <Button type="submit" variant="secondary" disabled={!newItem.trim() || submitting} className="shrink-0 max-sm:w-full">
              <Plus className="h-4 w-4" aria-hidden="true" />
              {submitting ? '추가 중…' : '직접 추가'}
            </Button>
          </form>
        </>
      )}

      {error && (
        <div className="mt-sm flex items-start justify-between gap-sm" role="alert">
          <p className="flex items-start gap-xs text-caption text-error"><AlertCircle className="mt-xxs h-4 w-4 shrink-0" aria-hidden="true" />{error}</p>
          <button type="button" onClick={() => void loadChecklist()} className="min-h-11 shrink-0 rounded-full px-sm text-caption-bold text-ink underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-deep focus-visible:ring-offset-2">다시 시도</button>
        </div>
      )}

      {!loading && items.length > 0 && completedCount === items.length && (
        <p className="mt-sm inline-flex items-center gap-xs text-caption text-success-text" role="status">
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />준비 항목을 모두 확인했어요.
        </p>
      )}
    </section>
  );
}

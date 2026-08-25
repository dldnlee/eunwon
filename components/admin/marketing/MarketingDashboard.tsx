'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { PillTabs } from '@/components/ui/tabs';
import type {
  FactSnapshot,
  GeneratedContent,
  MarketingPostRow,
  MarketingPostStatus,
  SlideContent,
} from '@/lib/marketing/types';

const STATUS_LABELS: Record<MarketingPostStatus, string> = {
  candidate: '후보',
  generating: '생성 중',
  validation_failed: '검증 실패',
  awaiting_approval: '승인 대기',
  rejected: '거절됨',
  approved: '승인됨',
  scheduled: '예약됨',
  publishing: '게시 중',
  published: '게시 완료',
  publish_failed: '게시 실패',
  cancelled: '취소됨',
};

const STATUS_BADGE_VARIANT: Record<MarketingPostStatus, 'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'outline'> = {
  candidate: 'outline',
  generating: 'default',
  validation_failed: 'destructive',
  awaiting_approval: 'warning',
  rejected: 'destructive',
  approved: 'success',
  scheduled: 'default',
  publishing: 'default',
  published: 'success',
  publish_failed: 'destructive',
  cancelled: 'secondary',
};

const QUEUE_FILTERS = [
  { value: 'awaiting_approval', label: '승인 대기' },
  { value: 'validation_failed', label: '검증 실패' },
  { value: 'approved', label: '승인됨' },
  { value: 'scheduled', label: '예약됨' },
  { value: 'published', label: '게시 완료' },
  { value: 'rejected', label: '거절됨' },
  { value: 'all', label: '전체' },
] as const;

function formatDate(iso: string | null): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' });
}

function formatKrw(amount: number): string {
  if (amount >= 100_000_000 && amount % 100_000_000 === 0) return `${amount / 100_000_000}억원`;
  if (amount >= 10_000 && amount % 10_000 === 0) return `${amount / 10_000}만원`;
  return `${amount.toLocaleString('ko-KR')}원`;
}

/** CSS-rendered carousel preview — real templates arrive with the Phase 2 renderer. */
function SlidePreview({ slide, index, total }: { slide: SlideContent; index: number; total: number }) {
  const isCta = slide.type === 'cta';
  return (
    <div
      className={`flex aspect-[4/5] w-36 shrink-0 flex-col justify-between rounded-md border p-md ${
        isCta ? 'border-primary bg-primary text-on-primary' : 'border-hairline bg-canvas'
      }`}
    >
      <div>
        <p className={`text-[10px] font-semibold uppercase tracking-wide ${isCta ? 'text-white/70' : 'text-muted'}`}>
          {slide.type}
        </p>
        <p className={`mt-xs text-[13px] font-bold leading-snug ${isCta ? '' : 'text-ink'}`}>{slide.headline}</p>
        {'body' in slide && slide.body ? (
          <p className={`mt-xs whitespace-pre-wrap text-[11px] leading-relaxed ${isCta ? 'text-white/90' : 'text-charcoal'}`}>
            {slide.body}
          </p>
        ) : null}
        {'bullets' in slide && slide.bullets?.length ? (
          <ul className="mt-xs space-y-1">
            {slide.bullets.map((bullet, bulletIndex) => (
              <li key={bulletIndex} className="flex gap-1 text-[11px] leading-snug text-charcoal">
                <span aria-hidden className="text-brand-blue-deep">·</span>
                {bullet}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <p className={`text-[9px] ${isCta ? 'text-white/60' : 'text-stone'}`}>{index + 1}/{total} · @eunwon</p>
    </div>
  );
}

interface FactRow {
  label: string;
  value: string;
}

function factRows(snapshot: FactSnapshot): FactRow[] {
  return [
    { label: '프로그램명', value: snapshot.title },
    { label: '주관기관', value: snapshot.agency },
    { label: '지원 대상 업태', value: snapshot.entity_types.join(', ') || '제한 없음(원문 확인)' },
    { label: '지역', value: snapshot.is_nationwide ? '전국' : snapshot.eligible_regions.join(', ') || '미확인' },
    { label: '업력 제한', value: snapshot.business_age_constraint ?? '제한 없음' },
    { label: '지원 금액', value: snapshot.benefit_text ?? (snapshot.funding_amount_krw !== null ? formatKrw(snapshot.funding_amount_krw) : '미공개') },
    { label: '신청 기간', value: [snapshot.deadline_start, snapshot.deadline_end].filter(Boolean).join(' ~ ') || '상시/미공개' },
  ];
}

export function MarketingDashboard({ initialPosts }: { initialPosts: MarketingPostRow[] }) {
  const router = useRouter();
  // Derived from props (not copied into state) so router.refresh() after each mutation
  // immediately reflects the new rows while local UI state (tab/selection) survives.
  const posts = initialPosts;
  const [filter, setFilter] = useState<string>('awaiting_approval');
  const [selectedId, setSelectedId] = useState<string | null>(initialPosts[0]?.id ?? null);
  const [captionDraft, setCaptionDraft] = useState<string | null>(null);
  const [scheduleAt, setScheduleAt] = useState('');
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const post of posts) map.set(post.status, (map.get(post.status) ?? 0) + 1);
    return map;
  }, [posts]);

  const visiblePosts = useMemo(() => {
    const filtered = filter === 'all' ? posts : posts.filter((post) => post.status === filter);
    return filtered;
  }, [posts, filter]);

  const selected = posts.find((post) => post.id === selectedId) ?? visiblePosts[0] ?? null;
  const content: GeneratedContent | null = selected?.generated_content ?? null;

  async function act(action: string, run: () => Promise<Response>, successText: string) {
    setBusyAction(action);
    setMessage(null);
    try {
      const res = await run();
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ tone: 'error', text: body.error ?? '요청이 실패했습니다' });
        return;
      }
      setMessage({ tone: 'ok', text: successText });
      if (action === 'generate') setSelectedId(body.postIds?.[0] ?? null);
      startTransition(() => router.refresh());
    } finally {
      setBusyAction(null);
    }
  }

  function patch(id: string, payload: Record<string, unknown>, successText: string) {
    return act(
      payload.action as string,
      () => fetch(`/api/admin/marketing/posts/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      }),
      successText,
    );
  }

  const canEditCaption = selected && ['awaiting_approval', 'rejected'].includes(selected.status);
  const captionValue = captionDraft ?? selected?.caption ?? '';

  if (initialPosts.length === 0) {
    return (
      <div className="space-y-xl">
        <Header
          onGenerate={() =>
            act('generate', () => fetch('/api/admin/marketing/generate', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ count: 3 }),
            }), '초안 생성을 시작했습니다')}
          generateDisabled={pending || busyAction === 'generate'}
        />
        <Card className="p-xxl text-center">
          <p className="text-body-sm text-steel">아직 마케팅 게시물이 없습니다.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-xl">
      <Header
        onGenerate={() =>
          act('generate', () => fetch('/api/admin/marketing/generate', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ count: 3 }),
          }), '초안 생성을 시작했습니다')}
        generateDisabled={pending || busyAction === 'generate'}
      />

      {message ? (
        <p role="status" className={`rounded-sm border px-md py-sm text-body-sm ${message.tone === 'ok' ? 'border-success-text/30 bg-success-bg text-success-text' : 'border-error/40 bg-canvas text-error'}`}>
          {message.text}
        </p>
      ) : null}

      <PillTabs
        items={QUEUE_FILTERS.map((f) => ({
          value: f.value,
          label: f.value === 'all' ? f.label : `${f.label} ${counts.get(f.value) ?? 0}`,
        }))}
        value={filter}
        onChange={setFilter}
      />

      <div className="grid gap-lg lg:grid-cols-[320px_1fr]">
        {/* ── queue list ─────────────────────────────────────────────── */}
        <div className="space-y-sm" role="list">
          {visiblePosts.length === 0 ? (
            <Card className="p-lg text-body-sm text-steel">해당 상태의 게시물이 없습니다.</Card>
          ) : (
            visiblePosts.map((post) => (
              <button
                key={post.id}
                type="button"
                role="listitem"
                onClick={() => { setSelectedId(post.id); setCaptionDraft(null); }}
                className={`w-full rounded-md border p-md text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-deep ${
                  selected?.id === post.id ? 'border-primary bg-canvas shadow-card' : 'border-hairline bg-canvas hover:bg-surface'
                }`}
              >
                <div className="flex items-center justify-between gap-sm">
                  <Badge variant={STATUS_BADGE_VARIANT[post.status]}>{STATUS_LABELS[post.status]}</Badge>
                  {post.candidate_score !== null ? (
                    <span className="text-caption text-stone">score {post.candidate_score.toFixed(2)}</span>
                  ) : null}
                </div>
                <p className="mt-sm line-clamp-2 text-card-title text-ink">{post.fact_snapshot.title}</p>
                <p className="mt-xxs text-body-sm text-steel">
                  {post.fact_snapshot.agency}
                  {post.scheduled_for ? ` · ${formatDate(post.scheduled_for)} 예약` : ''}
                </p>
              </button>
            ))
          )}
        </div>

        {/* ── detail panel ───────────────────────────────────────────── */}
        {selected ? (
          <Card className="space-y-lg p-lg">
            <div className="flex flex-wrap items-center justify-between gap-sm">
              <Badge variant={STATUS_BADGE_VARIANT[selected.status]}>{STATUS_LABELS[selected.status]}</Badge>
              <a
                href={selected.source_url ?? selected.fact_snapshot.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-body-sm text-ink underline underline-offset-4 hover:text-charcoal"
              >
                원본 공고 열기 ↗
              </a>
            </div>

            {selected.validation_errors?.length ? (
              <div className="rounded-sm border border-error/40 bg-canvas p-md">
                <p className="text-button-md font-semibold text-error">검증 실패 사유</p>
                <ul className="mt-xs list-inside list-disc space-y-xxs text-body-sm text-error">
                  {selected.validation_errors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {/* facts beside generated claims — plan §4 step 6 */}
            <section aria-label="사실 스냅샷 대조">
              <h3 className="text-heading-sm text-ink">사실 스냅샷 대조</h3>
              <dl className="mt-sm divide-y divide-hairline rounded-md border border-hairline">
                {factRows(selected.fact_snapshot).map((row) => (
                  <div key={row.label} className="grid grid-cols-[110px_1fr] gap-sm px-md py-sm">
                    <dt className="text-caption font-semibold text-steel">{row.label}</dt>
                    <dd className="text-body-sm text-charcoal">{row.value}</dd>
                  </div>
                ))}
                <div className="grid grid-cols-[110px_1fr] gap-sm px-md py-sm">
                  <dt className="text-caption font-semibold text-steel">스냅샷 시각</dt>
                  <dd className="text-body-sm text-charcoal">{formatDate(selected.fact_snapshot.retrieved_at)}</dd>
                </div>
              </dl>
            </section>

            {content ? (
              <>
                <section aria-label="카드뉴스 미리보기">
                  <h3 className="text-heading-sm text-ink">카드뉴스 미리보기</h3>
                  <p className="mt-xxs text-caption text-stone">훅: {content.hook} · 대상: {content.audience}</p>
                  <div className="mt-sm flex gap-sm overflow-x-auto pb-sm">
                    {(content.slides ?? []).map((slide, index) => (
                      <SlidePreview key={index} slide={slide} index={index} total={content.slides.length} />
                    ))}
                  </div>
                  <p className="mt-xs text-caption text-steel">출처 표기: {content.sourceLabel} · {content.disclaimer}</p>
                </section>

                <section aria-label="캡션">
                  <div className="flex items-center justify-between">
                    <h3 className="text-heading-sm text-ink">캡션</h3>
                    <div className="flex gap-xs">
                      {hashtagBadges(content.hashtags)}
                    </div>
                  </div>
                  <Textarea
                    className="mt-sm min-h-[140px]"
                    value={captionValue}
                    onChange={(event) => setCaptionDraft(event.target.value)}
                    disabled={!canEditCaption}
                    aria-label="캡션 편집"
                  />
                  {canEditCaption ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      className="mt-sm"
                      disabled={captionDraft === null || busyAction !== null}
                      onClick={() =>
                        selected &&
                        act('update_caption', () => fetch(`/api/admin/marketing/posts/${selected.id}`, {
                          method: 'PATCH',
                          headers: { 'content-type': 'application/json' },
                          body: JSON.stringify({ action: 'update_caption', caption: captionValue }),
                        }), '캡션을 저장했습니다').then(() => setCaptionDraft(null))
                      }
                    >
                      캡션 저장
                    </Button>
                  ) : null}
                </section>
              </>
            ) : (
              <p className="text-body-sm text-steel">생성된 콘텐츠가 없습니다. 재생성을 시도해주세요.</p>
            )}

            {/* ── actions ─────────────────────────────────────────── */}
            <section aria-label="워크플로 작업" className="space-y-sm border-t border-hairline pt-lg">
              <div className="flex flex-wrap items-center gap-sm">
                {selected.status === 'awaiting_approval' ? (
                  <Button
                    size="sm"
                    disabled={busyAction !== null}
                    onClick={() =>
                      selected &&
                      patch(selected.id, { action: 'approve' }, '승인했습니다. 예약 단계로 진행하세요.')
                    }
                  >
                    승인
                  </Button>
                ) : null}

                {['awaiting_approval', 'validation_failed', 'approved', 'scheduled'].includes(selected.status) ? (
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={busyAction !== null}
                    onClick={() => {
                      const reason = window.prompt('거절 사유를 입력하세요 (감사 기록에 남습니다)');
                      if (reason && reason.trim().length >= 3 && selected) {
                        void patch(selected.id, { action: 'reject', reason: reason.trim() }, '거절 처리했습니다');
                      }
                    }}
                  >
                    거절
                  </Button>
                ) : null}

                {['awaiting_approval', 'validation_failed', 'rejected'].includes(selected.status) ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={busyAction !== null}
                    onClick={() =>
                      selected &&
                      act('regenerate', () => fetch(`/api/admin/marketing/posts/${selected.id}`, { method: 'POST' }), '재생성했습니다')
                    }
                  >
                    재생성
                  </Button>
                ) : null}

                {selected.status === 'approved' ? (
                  <div className="flex items-center gap-sm">
                    <input
                      type="datetime-local"
                      value={scheduleAt}
                      onChange={(event) => setScheduleAt(event.target.value)}
                      className="rounded-full border border-hairline bg-canvas px-md py-xs text-body-sm text-ink"
                      aria-label="게시 예약 시각"
                    />
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={!scheduleAt || busyAction !== null}
                      onClick={() => {
                        if (!selected || !scheduleAt) return;
                        const iso = new Date(scheduleAt).toISOString();
                        void patch(selected.id, { action: 'schedule', scheduledFor: iso }, '게시를 예약했습니다');
                      }}
                    >
                      이 시각에 예약
                    </Button>
                  </div>
                ) : null}
              </div>

              <p className="text-caption text-stone">
                최종 수정 {formatDate(selected.updated_at)}
                {selected.approved_at ? ` · 승인 ${formatDate(selected.approved_at)}` : ''}
                {selected.rejected_reason ? ` · 거절 사유: ${selected.rejected_reason}` : ''}
              </p>
              {selected.status === 'scheduled' ? (
                <p className="text-caption text-steel">
                  게시 예정: {formatDate(selected.scheduled_for)} — Phase 4(인스타그램 발행 연동) 적용 전까지는 이 상태에서 대기합니다.
                </p>
              ) : null}
            </section>
          </Card>
        ) : null}
      </div>
    </div>
  );
}

function hashtagBadges(hashtags: string[]) {
  return (
    <div className="flex flex-wrap justify-end gap-xxs">
      {hashtags.slice(0, 5).map((tag) => (
        <Badge key={tag} variant="secondary">#{tag}</Badge>
      ))}
    </div>
  );
}

function Header({ onGenerate, generateDisabled }: { onGenerate: () => void; generateDisabled: boolean }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-md">
      <div>
        <h1 className="text-heading-sm text-ink">마케팅 워크플로</h1>
        <p className="mt-xxs text-body-sm text-steel">
          활성 지원사업 데이터로 만든 인스타그램 초안을 검증하고 승인합니다.
        </p>
      </div>
      <Button onClick={onGenerate} disabled={generateDisabled}>
        {generateDisabled ? '생성 중…' : '오늘의 초안 생성'}
      </Button>
    </div>
  );
}

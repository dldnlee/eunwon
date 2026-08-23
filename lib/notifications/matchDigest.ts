import { matchPercent } from '@/lib/matching';
import { formatKoreanDate } from '@/lib/utils';
import type { Profile, Program } from '@/lib/types';

export interface CachedAiRating {
  matchRate: number;
  reason: string;
}

export interface DigestConfig {
  maxItems: number;
  maxAiItems: number;
  minAiScore: number;
}

export interface DigestItem {
  program: Program;
  signal: 'ai' | 'profile';
  score: number;
  reason: string | null;
}

function boundedInt(value: string | undefined, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= min && parsed <= max ? parsed : fallback;
}

export function getDigestConfig(env: NodeJS.ProcessEnv = process.env): DigestConfig {
  const maxItems = boundedInt(env.MATCH_DIGEST_MAX_ITEMS, 5, 1, 10);
  return {
    maxItems,
    maxAiItems: boundedInt(env.MATCH_DIGEST_MAX_AI_ITEMS, 3, 0, maxItems),
    minAiScore: boundedInt(env.MATCH_DIGEST_MIN_AI_SCORE, 80, 0, 100),
  };
}

export function selectDigestItems(
  programs: Program[],
  profile: Profile,
  aiRatings: Record<string, CachedAiRating>,
  config: DigestConfig
): DigestItem[] {
  const candidates = programs.map((program) => ({
    program,
    profileScore: matchPercent(program, profile),
    ai: aiRatings[program.id],
  }));

  const aiItems = candidates
    .filter((candidate) => candidate.ai && candidate.ai.matchRate >= config.minAiScore)
    .sort((a, b) => b.ai!.matchRate - a.ai!.matchRate || b.profileScore - a.profileScore)
    .slice(0, Math.min(config.maxAiItems, config.maxItems))
    .map<DigestItem>((candidate) => ({
      program: candidate.program,
      signal: 'ai',
      score: candidate.ai!.matchRate,
      reason: candidate.ai!.reason.trim() || null,
    }));

  const selectedIds = new Set(aiItems.map((item) => item.program.id));
  const profileItems = candidates
    .filter((candidate) => !selectedIds.has(candidate.program.id))
    .sort((a, b) => b.profileScore - a.profileScore || deadlineTime(a.program) - deadlineTime(b.program))
    .slice(0, config.maxItems - aiItems.length)
    .map<DigestItem>((candidate) => ({
      program: candidate.program,
      signal: 'profile',
      score: candidate.profileScore,
      reason: '등록한 지역·기업 형태와 공고의 기본 자격 조건을 기준으로 추천했어요.',
    }));

  return [...aiItems, ...profileItems];
}

function deadlineTime(program: Program): number {
  return program.deadline_end ? new Date(program.deadline_end).getTime() : Number.MAX_SAFE_INTEGER;
}

export function escapeEmailHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function absoluteUrl(appUrl: string, path: string): string {
  return new URL(path, `${appUrl.replace(/\/$/, '')}/`).toString();
}

export function buildMatchDigestEmail(params: {
  items: DigestItem[];
  totalFresh: number;
  appUrl: string;
}): { subject: string; html: string; text: string } {
  const { items, totalFresh, appUrl } = params;
  const omitted = Math.max(0, totalFresh - items.length);
  const dashboardUrl = absoluteUrl(appUrl, '/dashboard?source=email');
  const cards = items.map((item) => {
    const programUrl = absoluteUrl(appUrl, `/program/${encodeURIComponent(item.program.id)}?source=email`);
    const label = item.signal === 'ai' ? `AI 추천 ${item.score}%` : `프로필 매칭 ${item.score}%`;
    const reason = item.reason
      ? `<p style="margin:12px 0 0;color:#222222;font-size:14px;line-height:1.6;"><strong>추천 이유</strong><br>${escapeEmailHtml(item.reason)}</p>`
      : '';
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 12px;border:1px solid #e5e7eb;border-radius:16px;"><tr><td style="padding:20px;">` +
      `<span style="display:inline-block;border-radius:9999px;background:#e8ffea;color:#1ba673;padding:4px 10px;font-size:12px;font-weight:600;">${label}</span>` +
      `<h2 style="margin:12px 0 4px;color:#0a0a0a;font-size:18px;line-height:1.45;">${escapeEmailHtml(item.program.title)}</h2>` +
      `<p style="margin:0;color:#8e8e93;font-size:13px;">${escapeEmailHtml(item.program.agency)} · ${item.program.deadline_end ? `~${formatKoreanDate(item.program.deadline_end)}` : '상시모집'}</p>` +
      reason +
      `<a href="${programUrl}" style="display:inline-block;margin-top:16px;border-radius:9999px;background:#0a0a0a;color:#ffffff;padding:12px 20px;font-size:14px;font-weight:600;text-decoration:none;">이 사업 자세히 보기</a>` +
      `</td></tr></table>`;
  }).join('');

  const omittedCopy = omitted > 0
    ? `<p style="margin:8px 0 20px;color:#5f5f5f;font-size:14px;">나머지 ${omitted}건은 대시보드에서 확인할 수 있어요.</p>`
    : '';
  const html = `<!doctype html><html lang="ko"><body style="margin:0;background:#f7f8fa;font-family:'DM Sans',Arial,sans-serif;">` +
    `<div style="display:none;max-height:0;overflow:hidden;">새로 신청할 만한 지원사업을 우선순위대로 확인하세요.</div>` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 16px;">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:16px;"><tr><td style="padding:24px;">` +
    `<p style="margin:0 0 8px;color:#5f5f5f;font-size:12px;font-weight:600;">매일 기회 브리핑</p>` +
    `<h1 style="margin:0;color:#0a0a0a;font-size:24px;line-height:1.35;">신청할 만한 지원사업을 추렸어요</h1>` +
    `<p style="margin:12px 0 20px;color:#45515e;font-size:14px;line-height:1.6;">AI 적합도와 사업자 프로필 기반 매칭도를 구분해 검토하고, 우선순위가 높은 ${items.length}건만 담았습니다. 최종 자격은 원문 공고와 담당 기관에서 확인해 주세요.</p>` +
    cards + omittedCopy +
    `<a href="${dashboardUrl}" style="display:block;box-sizing:border-box;width:100%;border-radius:9999px;background:#0a0a0a;color:#ffffff;padding:13px 20px;text-align:center;font-size:14px;font-weight:600;text-decoration:none;">전체 매칭 확인하기</a>` +
    `</td></tr></table></td></tr></table></body></html>`;

  const textItems = items.map((item, index) => {
    const url = absoluteUrl(appUrl, `/program/${encodeURIComponent(item.program.id)}?source=email`);
    const label = item.signal === 'ai' ? `AI 추천 ${item.score}%` : `프로필 매칭 ${item.score}%`;
    return `${index + 1}. ${item.program.title} (${label})\n${item.program.agency}\n${item.reason ?? ''}\n${url}`;
  }).join('\n\n');
  return {
    subject: `신청할 만한 새 지원사업 ${items.length}건을 확인해 보세요`,
    html,
    text: `매일 기회 브리핑\n\n${textItems}\n\n전체 매칭: ${dashboardUrl}`,
  };
}

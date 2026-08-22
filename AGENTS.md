# AGENTS.md

Guidance for Codex when working in this repository.

## Project Overview

정부지원사업 매칭 서비스 (eunwon) — matches Korean SMBs/startups against government support programs, enriched via Upstage Solar Pro. Next.js 14 (App Router) · Supabase (Postgres + Auth) · Tailwind CSS · 토스페이먼츠 · Resend. See [README.md](./README.md) and [docs/jiwon-plan.md](./docs/jiwon-plan.md) for full product/architecture context.

## Design System

All UI work — new pages, components, or styling changes — **must** follow [`DESIGN.md`](./DESIGN.md), the project's design system. Read its "eunwon Adaptation Notes" section first: the token set was extracted from a different company's site and that section explains how it maps to this product.

- Reference design tokens by name (`{colors.primary}`, `{typography.body-md}`, `{rounded.full}`, etc.) — don't introduce ad hoc colors, font sizes, or radii outside the system.
- Buttons, pill tabs, and badges are always `rounded-full`. Cards use the documented radius scale.
- DM Sans is the only typeface. Don't add a second display font.
- Primary CTAs are the black pill (`button-primary`); brand accent colors (coral/magenta/blue/purple) are reserved for the narrow uses called out in DESIGN.md's adaptation notes — not general UI chrome.

For any UI/UX work — visual design decisions, component styling, layout, responsiveness, accessibility — use the **`ui-designer`** subagent (`.Codex/agents/ui-designer.md`). It owns interpreting and applying DESIGN.md consistently across the app, and should be used proactively for styling work, not just when a "redesign" is explicitly requested.

## Test accounts

Reuse these instead of creating new throwaway users — both are real `auth.users` rows (service-role created, `email_confirm: true`, so they log in immediately, no verification email) in the project's actual Supabase instance, not a separate local/dev project.

- **`ui-verify-onboarding-20260822@example.com`** / `Verify1234!test` — general-purpose account for exercising flows end to end (onboarding, dashboard, settings). Onboarding starts out complete; reset it with `node .tmp-reset-onboarding.mjs` to walk through the questionnaire again. Recreate from scratch with `node .tmp-create-test-user.mjs` if it's ever deleted.
- **`homepage-showcase-20260822@example.com`** / `Showcase1234!test` — Pro-tier account pre-seeded with a full, realistic profile (그린테크 주식회사 — IT/소프트웨어, 서울, 법인, 벤처기업 인증 등) so the dashboard renders with real matched programs, scores, and badges already populated. Use this one for screenshots/demos rather than a mostly-empty profile. Recreate with `node .tmp-create-showcase-user.mjs`.

The `.tmp-*.mjs` helper scripts live in the repo root, use `SUPABASE_SERVICE_ROLE_KEY` from `.env.local`, and are intentionally left untracked (`.tmp-` prefix) — don't commit them.

# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Project Overview

정부지원사업 매칭 서비스 (eunwon) — matches Korean SMBs/startups against government support programs, enriched via Upstage Solar Pro. Next.js 14 (App Router) · Supabase (Postgres + Auth) · Tailwind CSS · 토스페이먼츠 · Resend. See [README.md](./README.md) and [docs/jiwon-plan.md](./docs/jiwon-plan.md) for full product/architecture context.

## Design System

All UI work — new pages, components, or styling changes — **must** follow [`DESIGN.md`](./DESIGN.md), the project's design system. Read its "eunwon Adaptation Notes" section first: the token set was extracted from a different company's site and that section explains how it maps to this product.

- Reference design tokens by name (`{colors.primary}`, `{typography.body-md}`, `{rounded.full}`, etc.) — don't introduce ad hoc colors, font sizes, or radii outside the system.
- Buttons, pill tabs, and badges are always `rounded-full`. Cards use the documented radius scale.
- DM Sans is the only typeface. Don't add a second display font.
- Primary CTAs are the black pill (`button-primary`); brand accent colors (coral/magenta/blue/purple) are reserved for the narrow uses called out in DESIGN.md's adaptation notes — not general UI chrome.

For any UI/UX work — visual design decisions, component styling, layout, responsiveness, accessibility — use the **`ui-designer`** subagent (`.claude/agents/ui-designer.md`). It owns interpreting and applying DESIGN.md consistently across the app, and should be used proactively for styling work, not just when a "redesign" is explicitly requested.

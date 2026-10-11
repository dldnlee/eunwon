# 재무·신용 관리

Signed-in users can open **재무·신용 관리** in the desktop or mobile navigation at
`/financial-health`. The feature turns annual financial statements into a reviewed
set of figures, seven calculated ratios, and an AI-generated 30/60/90-day action plan.

## User flow

1. Upload a PDF (1–20 pages), JPG, or PNG up to 4 MiB; paste 20–40,000 characters;
   or choose manual entry. Use a single company's annual statements, consistently
   consolidated or standalone. Interim statements are not supported.
2. Consent to sending the submitted material to Upstage. The app does not persist
   files, extracted text, financial figures, or generated plans in its database,
   object storage, analytics, or browser storage. Provider processing is separate;
   the UI does not claim that Upstage retains no data.
3. Review company, fiscal year, reporting unit (원/천원/백만원), and figures.
   Unknown amounts remain blank, not zero. Changing the unit does not convert
   existing entries. The optional prior-year revenue must cover a comparable year.
4. Confirm the figures and generate the plan. Assets, liabilities, equity, revenue,
   and operating profit are required. Additional current accounts, profit, interest,
   cash flow, and prior revenue improve the analysis.
5. Download the report as Markdown before leaving. Editing a figure clears the
   displayed report and confirmation to prevent using results from stale inputs.

## Implementation

- `app/(app)/financial-health/page.tsx`: authenticated page, company-name prefill only.
- `components/FinancialHealthClient.tsx`: accessible input/review/result flow and download.
- `app/api/financial-health/{extract,analyze}/route.ts`: authenticated Node routes.
- `lib/financial-health/requests.ts`: bounded request bodies, consent and confirmation,
  same-origin checks when Origin is present, input validation, private/no-store responses,
  and redacted errors. Caller-supplied ratios are never used.
- `lib/financial-health/provider.ts`: Upstage Document Parse and Solar using the existing
  `UPSTAGE_API_KEY`. Each provider call has a 45-second timeout; Solar retries are disabled.
  File extraction uses up to two provider calls (parse, then structured extraction).
  The extraction route allows 120 seconds and the analysis route 60 seconds.
- `lib/financial-health/validation.ts`: finite numeric inputs, sign/unit/year validation,
  balance equation, and component-to-total consistency. A maximum of two reporting
  units of rounding is allowed; amounts are never auto-corrected.
- `lib/financial-health/metrics.ts`: deterministic calculations independent of AI.

Files have MIME and signature checks. PDFs are checked for readability, encryption,
and page count before sending to Upstage; only the generic filename `statement.pdf`
(or `.png`/`.jpg`) is forwarded. Extracted documents are limited to 40,000 characters.
The model returns a validated JSON structure. Truncated, malformed, incomplete, or
unexpected responses fail instead of being presented as successful reports.

## Ratios and interpretation

| Metric | Formula |
| --- | --- |
| 부채비율 | liabilities / equity × 100 |
| 자기자본비율 | equity / assets × 100 |
| 유동비율 | current assets / current liabilities × 100 |
| 영업이익률 | operating profit / revenue × 100 |
| 이자보상배율 | operating profit / interest expense |
| 영업현금흐름률 | operating cash flow / revenue × 100 |
| 매출액 증가율 | (revenue − previous revenue) / previous revenue × 100 |

Missing inputs, nonpositive denominators, and extreme/nonfinite ratios produce
`null` with a visible explanation. Negative equity is explicitly flagged and never
presented as a reassuring negative debt ratio. Zero interest expense does not imply
an infinite creditworthiness score. No industry-independent rating thresholds are used.

This is financial-management support, **not an official credit rating or an upgrade
guarantee**. The model is instructed to ground each action in reviewed numbers and
calculated ratios, avoid invented benchmarks and target grades, and distinguish
missing evidence from adverse evidence. Financing or equity actions require checking
cash needs, contracts, costs, and feasibility with the accountant or lender.

Background references, checked 2026-10-11:

- [NICE평가정보 — 평가 요소 및 반영 기간](https://www.niceinfo.co.kr/creditrating/bi_score_1_3.nice)
- [한국신용평가 — 신용평가 분석 체계](https://www.kisrating.com/business/creditrating.do)
- [Upstage Document Parse API](https://console.upstage.ai/api/parse/document-parsing)

These explain the general evaluation framework and provider integration; they are
not a reproduction of a rating agency's proprietary scoring model.

## Validation and operational limits

Run `npm test`, `npm run lint`, `npx tsc --noEmit --incremental false`, and
`npm run build`. Browser regressions are in `tests/e2e/financial-health.spec.ts`;
set `E2E_USER_EMAIL` / `E2E_USER_PASSWORD` to an existing repository test account,
then run `npm run test:e2e`. Browser tests mock financial AI responses while using
the actual auth/page flow, so they do not send company financial data to a provider.

A live smoke test with a synthetic one-page PDF successfully exercised Document
Parse, structured extraction, validation, and a five-action Solar plan on 2026-10-11.

The local per-user guard allows one in-flight operation and 12 extract/analyze
operations per hour **per process**. It is not a distributed quota: server restarts
and separate instances have separate budgets. Before a broad rollout, use a shared
quota store or gateway limit and review provider spend. No database migration is
needed for this version. No files or plans can be recovered after navigation/reload;
history and multi-year analysis are future extensions. OCR/model errors still
require human review, and official ratings also depend on business and nonfinancial
information absent from the submitted statements.

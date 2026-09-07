# Design-partner prospect pipeline: source and method note

Research date: 2026-09-05  
Pipeline: [`design-partner-prospects.csv`](./design-partner-prospects.csv)  
Playbook: [`design-partner-recruitment-playbook.md`](./design-partner-recruitment-playbook.md)

## Scope

The CSV contains 50 publicly verifiable research records: 30 founder-company candidates and 20 advisor, accelerator, or ecosystem candidates. It is a research queue, not a contact list and not evidence that any organization has agreed to participate.

Founder candidates were taken primarily from named 2026 accelerator or public open-innovation cohorts. Advisor candidates were taken from organizations that publicly describe a recurring government-support, cohort, portfolio, or consulting workflow. Current government, program-operator, organization, and reputable ecosystem sources were preferred. Search aggregators were used only where they exposed a current program or organization that still needs primary-source verification.

## Field rules

- `public_contact` and `role` are populated only when the cited page explicitly identifies the person, team, representative, or public business inbox. Blank means “not verified,” not “unknown person to guess.”
- No private data, guessed email pattern, personal phone number, or enrichment data was added.
- `public_trigger` is a paraphrase of the cited page, not an assertion that the candidate currently needs eunwon.
- `observed_date` is the date this research was checked, not necessarily the publication date.
- `contact_provenance` records the public origin. It does not authorize outreach.
- All rows remain `status=research`. They require founder approval and revalidation immediately before any contact.

## Scoring method

Scores follow the 100-point rubric in the recruitment playbook:

- active need: 30;
- ICP fit: 25;
- workflow frequency: 15;
- distribution: 10;
- recent public trigger: 10;
- access strength: 10.

A score is a prioritization hypothesis, not a factual claim about budget or purchase intent. A public 2026 cohort or active multi-company program raises trigger and active-need scores. An explicit public work inbox scores higher for access than a website-only route.

Eight founder records sourced from the 2025 representative KT collaboration cases score 46. Two sports-program records score 61. They are intentionally below the playbook's 65-point outreach threshold and must not be contacted until a new trigger, present company stage, and valid channel are verified. The remaining rows may enter manual review, but no score by itself authorizes contact.

## Source quality and limitations

The highest-confidence founder sources are the 2026 MARU batch announcement and the Seoul Metropolitan Government's 2026 Finovation selection notice. The KT Collaboration page identifies representatives and concrete projects, but labels them as 2025 representative cases; those rows are included as a requalification pool rather than an outreach-ready cohort.

Some advisor rows use public program listings or press-release distribution pages because a primary operator page did not surface in search. Before outreach, replace these with the operator's own current page and verify the responsible role. Organization size, client count, decision authority, company age, employee count, application frequency, and current willingness to pay were not inferred; the interview screener must establish them.

The pipeline intentionally does not contain invented proof, customer outcomes, or an assertion that cohort participation means a company is eligible for a particular support program.

## Pre-contact verification checklist

1. Open the source and confirm the page still exists and still supports the trigger.
2. Find a second current source, preferably the candidate's own site or post.
3. Verify company age, location, active application need, and responsible role.
4. Replace general public contact details with an explicitly published business channel if available; never derive an email.
5. Recalculate the score. Do not advance records below 65.
6. Check conflicts, prior contact, and `do_not_contact` status.
7. Draft the first two lines from the verified trigger and obtain founder approval before sending.

# Finance operations

This folder is the minimum finance system for Eunwon's first paid pilots. It is an operating aid,
not tax or accounting advice. The founder and Korean tax adviser remain responsible for invoice,
VAT, refund, and revenue-recognition decisions.

## Files

- `revenue-ledger.csv`: one row per invoice/order and recognition period.
- `expense-ledger.csv`: one row per supplier charge or reimbursement.
- `weekly-cash-metrics-template.md`: Friday cash, funnel, revenue, and cost review.

Keep source evidence (invoice, receipt, Toss settlement statement, bank entry, contract) in the
approved finance drive. Ledgers should link to that evidence; do not store card numbers, API keys,
customer documents, or sensitive payment credentials here.

## Recording VAT-inclusive pilots

Pilot prices are quoted as VAT-inclusive unless the signed order explicitly says otherwise. For a
standard Korean 10% taxable sale:

- gross billed = amount the customer owes;
- supply value = gross billed / 1.10;
- output VAT = gross billed - supply value.

Use the issued tax invoice as the authoritative split and preserve its rounding. Set
`vat_treatment` to `standard_10`, `zero_rated`, `exempt`, or `review_required`; never assume a
special treatment. Refunds and credit notes receive their own negative row linked through
`related_revenue_id` rather than overwriting the original sale.

## Recognized revenue versus collections

Collections measure cash received. Recognized revenue measures service delivered in the period.
They are not interchangeable.

- A one-time pilot delivered entirely in one month is normally recognized in that delivery month,
  subject to adviser review.
- An annual subscription collected upfront is allocated across its service term. Record one row per
  recognition month, using the same `order_id` and a unique `revenue_id`.
- An unpaid invoice may have recognized revenue but zero collections; an annual prepayment may have
  collections well ahead of recognized revenue.
- Enter amounts net of VAT in `recognized_revenue_krw`. Record customer cash including VAT in
  `collected_gross_krw`. Record processor fees separately in the expense ledger.

Reconcile `collected_gross_krw` to the bank and Toss settlements every month. Do not recognize a
contract merely because it was signed or an invoice was issued.

## AI budget alerts

Review provider usage weekly and record actual provider charges in the expense ledger. Until the
in-product usage ledger is fully instrumented and reconciled, treat dashboard estimates as
directional.

- Warning: projected monthly AI cost reaches 3% of recognized revenue or 70% of the approved
  monthly AI budget.
- Hard review: projected cost reaches 5% of recognized revenue, 90% of budget, or rises more than
  50% week over week without matching activation/revenue growth.
- Stop broad backfills and non-customer batch jobs if the approved ceiling is reached. Customer
  safety and contractual delivery exceptions require founder approval.

For a pre-revenue month, use the approved fixed KRW budget as the denominator; percentages of zero
revenue are not meaningful.

## Monthly close (complete by the fifth business day)

1. Freeze the prior-month ledger snapshot and collect missing invoices, receipts, settlements, and
   bank evidence.
2. Reconcile gross collections to bank deposits and payment-processor settlements.
3. Reconcile billed gross, supply value, and VAT to issued tax invoices and credit notes.
4. Allocate subscriptions and multi-period work to the delivered service periods; review deferred
   revenue and unpaid receivables.
5. Categorize expenses, split recoverable input VAT where supported, and identify founder
   reimbursements.
6. Reconcile Upstage, Supabase, Vercel, Resend, domain, and payment-processing charges to usage and
   contracts.
7. Review refunds, failed payments, overdue receivables, churn, unusual costs, and AI alert status.
8. Publish the final weekly/monthly report, obtain founder sign-off, and lock the closed period.

Corrections after close are appended with an explanation and reviewer; do not silently rewrite a
closed period.

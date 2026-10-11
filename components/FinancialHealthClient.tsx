'use client';

import { useRef, useState, type FormEvent } from 'react';
import { ArrowRight, Download, FileText, Loader2 } from 'lucide-react';
import { validateStatement } from '@/lib/financial-health/validation';
import {
  emptyStatement, FINANCIAL_FIELDS, FINANCIAL_DISCLAIMER, MAX_FILE_BYTES,
  MAX_STATEMENT_TEXT, MONEY_UNITS, type ExtractionResult, type FinancialReport,
  type FinancialStatement, type MoneyUnit,
} from '@/lib/financial-health/types';

const focus = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-deep focus-visible:ring-offset-2';
const button = `inline-flex min-h-11 items-center justify-center gap-xs rounded-full px-xl py-sm text-button-md disabled:cursor-not-allowed disabled:opacity-50 ${focus}`;
const input = `min-h-11 w-full rounded-md border border-hairline bg-canvas px-md py-sm text-body-md text-ink ${focus}`;
const card = 'rounded-xl border border-hairline bg-canvas p-lg sm:p-xl';

function reportMarkdown(report: FinancialReport): string {
  const { statement, plan } = report;
  return [
    `# ${statement.companyName} 재무·신용 개선 계획`,
    `기준: ${statement.fiscalYear}년 / 단위: ${statement.unit ? MONEY_UNITS[statement.unit] : '미확인'}`,
    `생성: ${report.generatedAt}`, '', report.disclaimer, '', '## 입력한 재무자료',
    ...FINANCIAL_FIELDS.map(({ key, label }) => `- ${label}: ${statement[key] == null ? '미입력' : statement[key]?.toLocaleString('ko-KR')}`),
    '', '## 핵심 지표', ...report.metrics.map((metric) => `- ${metric.label}: ${metric.value == null ? '계산 불가' : `${metric.value.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}${metric.unit}`}\n  계산식: ${metric.formula}\n  ${metric.note}`),
    '', '## 분석 요약', plan.summary, '', '### 강점', ...plan.strengths.map((s) => `- ${s}`),
    '', '### 점검할 위험', ...plan.risks.map((s) => `- ${s}`),
    '', '## 실행 계획', ...plan.actions.flatMap((action) => [
      `### ${action.timeframe}: ${action.title}`, action.rationale, ...action.steps.map((s) => `- ${s}`), `확인 기준: ${action.successMeasure}`, '',
    ]), '## 준비 자료', ...plan.documents.map((s) => `- ${s}`), '', '## 확인 사항과 한계',
    ...[...report.warnings, ...plan.limitations].map((s) => `- ${s}`), '', '## 참고 자료', ...report.sources.map((source) => `- ${source.title}: ${source.url}`),
  ].join('\n');
}

function TextList({ items }: { items: string[] }) {
  return items.length ? <ul className="list-disc space-y-xs pl-lg text-body-sm text-charcoal">{items.map((item, index) => <li key={index}>{item}</li>)}</ul> : <p className="text-body-sm text-steel">제공된 자료만으로 확인된 항목이 없습니다.</p>;
}

export function FinancialHealthClient({ companyName }: { companyName: string }) {
  const [mode, setMode] = useState<'file' | 'text'>('file');
  const [step, setStep] = useState<'source' | 'review'>('source');
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState('');
  const [consent, setConsent] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [statement, setStatement] = useState<FinancialStatement>(() => emptyStatement(companyName));
  const [warnings, setWarnings] = useState<string[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [pending, setPending] = useState<'extract' | 'analyze' | null>(null);
  const [report, setReport] = useState<FinancialReport | null>(null);
  const reviewHeading = useRef<HTMLHeadingElement>(null);
  const resultHeading = useRef<HTMLHeadingElement>(null);

  function openReview() {
    setStep('review');
    setError('');
    requestAnimationFrame(() => reviewHeading.current?.focus());
  }

  function updateStatement(patch: Partial<FinancialStatement>) {
    setStatement((current) => ({ ...current, ...patch }));
    setReport(null);
    setConfirmed(false);
    setFieldErrors({});
    setError('');
  }

  async function extract(event: FormEvent) {
    event.preventDefault();
    if (!consent || pending) return;
    setError('');
    setFieldErrors({});
    if (mode === 'file' && (!file || file.size > MAX_FILE_BYTES || !['application/pdf', 'image/jpeg', 'image/png'].includes(file.type))) {
      setError('4MB 이하의 PDF, JPG 또는 PNG 파일을 선택해 주세요.');
      return;
    }
    if (mode === 'text' && text.trim().length < 20) {
      setError('재무제표의 항목과 금액을 20자 이상 붙여넣어 주세요.');
      return;
    }
    setPending('extract');
    try {
      const form = new FormData();
      if (file) form.append('file', file);
      form.append('consent', 'true');
      const response = await fetch('/api/financial-health/extract', mode === 'file'
        ? { method: 'POST', body: form }
        : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, consent: true }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '자료를 읽지 못했습니다. 다시 시도하거나 직접 입력해 주세요.');
      const extracted = data as ExtractionResult;
      setStatement({ ...extracted.statement, companyName: extracted.statement.companyName || companyName });
      setWarnings(extracted.warnings);
      setConfirmed(false);
      setReport(null);
      openReview();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '연결을 확인하고 다시 시도해 주세요.');
    } finally { setPending(null); }
  }

  async function analyze(event: FormEvent) {
    event.preventDefault();
    if (!consent || !confirmed || pending) return;
    const validation = validateStatement(statement);
    if (Object.keys(validation.fieldErrors).length > 0) {
      setFieldErrors(validation.fieldErrors);
      setError(validation.fieldErrors.form || '표시된 항목의 숫자와 단위를 확인해 주세요.');
      return;
    }
    setPending('analyze');
    setError('');
    setFieldErrors({});
    setReport(null);
    try {
      const response = await fetch('/api/financial-health/analyze', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statement, confirmed: true, consent: true }),
      });
      const data = await response.json();
      if (!response.ok) {
        setFieldErrors(data.fieldErrors ?? {});
        throw new Error(data.error || '분석하지 못했습니다. 입력값을 확인하고 다시 시도해 주세요.');
      }
      setReport(data as FinancialReport);
      requestAnimationFrame(() => resultHeading.current?.focus());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '연결을 확인하고 다시 시도해 주세요.');
    } finally { setPending(null); }
  }

  function download() {
    if (!report) return;
    const url = URL.createObjectURL(new Blob([reportMarkdown(report)], { type: 'text/markdown;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `재무-신용-개선계획-${report.statement.fiscalYear}.md`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const consentControl = <label className="flex min-h-11 cursor-pointer items-start gap-sm rounded-md border border-hairline p-md text-body-sm text-charcoal">
    <input type="checkbox" checked={consent} onChange={(event) => { setConsent(event.target.checked); setReport(null); }} disabled={!!pending} className={`mt-xxs h-5 w-5 shrink-0 accent-primary ${focus}`} />
    <span>재무자료를 Upstage AI에 전송해 추출·분석하는 데 동의합니다. 주민등록번호·계좌번호 등 불필요한 개인정보는 제거해 주세요.</span>
  </label>;

  return <div className="space-y-xxl">
    <header className="max-w-3xl space-y-md">
      <p className="text-body-sm font-medium text-steel">기업 재무 진단</p>
      <h1 className="text-heading-md text-ink sm:text-heading-lg">재무·신용 관리</h1>
      <p className="text-body-md text-slate">재무제표를 바탕으로 재무 상태를 이해하고, 기업의 신용도 개선을 위한 30·60·90일 실행 계획을 세워보세요.</p>
      <p className="text-caption text-steel">{FINANCIAL_DISCLAIMER}</p>
    </header>

    <ol aria-label="분석 진행 단계" className="grid gap-sm text-body-sm sm:grid-cols-3">
      {['자료 준비', '숫자 확인', '개선 계획'].map((label, index) => <li key={label} aria-current={(report ? index === 2 : step === 'source' ? index === 0 : index === 1) ? 'step' : undefined} className={`flex items-center gap-sm rounded-xl border px-md py-sm ${(report ? index === 2 : step === 'source' ? index === 0 : index === 1) ? 'border-primary bg-canvas text-ink' : 'border-hairline text-steel'}`}><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-current text-micro">{index + 1}</span>{label}</li>)}
    </ol>

    <p className="text-body-sm text-slate">업로드 자료와 결과는 계정에 저장되지 않습니다. 페이지를 떠나기 전 필요한 결과를 다운로드하세요.</p>

    {step === 'source' ? <section className={card} aria-labelledby="source-title">
      <h2 id="source-title" className="text-heading-sm text-ink">분석할 재무제표를 준비해 주세요</h2>
      <p className="mt-xs text-body-sm text-steel">한 회사의 연간 결산 재무제표를 사용하세요. 분기·반기 자료는 지원하지 않습니다. 같은 회계연도의 재무상태표와 손익계산서가 필요하며, 현금흐름표가 있으면 더 상세하게 분석할 수 있습니다.</p>
      <form onSubmit={extract} className="mt-xl space-y-xl">
        <fieldset disabled={!!pending} className="space-y-xl">
          <legend className="sr-only">재무자료 입력 방식</legend>
          <div className="flex flex-wrap gap-xs" role="group" aria-label="자료 입력 방식">
            {([['file', '파일 업로드'], ['text', '텍스트 붙여넣기']] as const).map(([value, label]) => <button key={value} type="button" aria-pressed={mode === value} onClick={() => { setMode(value); setError(''); }} className={`${button} ${mode === value ? 'bg-primary text-on-primary' : 'border border-hairline text-ink'}`}>{label}</button>)}
          </div>
          {mode === 'file' ? <div className="rounded-xl border border-dashed border-hairline bg-surface p-xl">
            <FileText aria-hidden="true" className="mb-sm h-8 w-8 text-steel" />
            <label htmlFor="financial-file" className="block text-body-md font-medium text-ink">재무제표 파일</label>
            <p id="financial-file-help" className="mb-md mt-xs text-body-sm text-steel">PDF (1~20페이지), JPG, PNG · 최대 4MB · 비밀번호가 없는 파일</p>
            <input id="financial-file" type="file" accept="application/pdf,image/jpeg,image/png" required aria-describedby="financial-file-help" onChange={(event) => { setFile(event.target.files?.[0] ?? null); setError(''); }} className={`w-full min-w-0 rounded-md text-body-sm text-steel file:mr-sm file:min-h-11 file:rounded-full file:border file:border-hairline file:bg-canvas file:px-md file:text-button-md file:text-ink ${focus}`} />
            {file && <p className="mt-sm break-all text-caption text-charcoal">선택한 파일: {file.name} ({(file.size / 1024 / 1024).toFixed(2)}MB)</p>}
          </div> : <div>
            <label htmlFor="financial-text" className="mb-xs block text-body-sm font-medium text-ink">재무제표 텍스트</label>
            <textarea id="financial-text" required minLength={20} rows={10} maxLength={MAX_STATEMENT_TEXT} value={text} onChange={(event) => setText(event.target.value)} placeholder={'회사명, 회계연도, 금액 단위를 함께 입력하세요.\n예: 2025년 / 단위: 천원\n자산총계: …\n부채총계: …\n자본총계: …\n매출액: …\n영업이익: …'} aria-describedby="financial-text-help" className={input} />
            <p id="financial-text-help" className="mt-xs text-caption text-steel">표의 항목명과 금액을 함께 20자 이상 붙여넣어 주세요. {text.length.toLocaleString()} / {MAX_STATEMENT_TEXT.toLocaleString()}자</p>
          </div>}
          {consentControl}
          <div className="flex flex-col gap-sm sm:flex-row">
            <button type="submit" disabled={!consent || !!pending} className={`${button} bg-primary text-on-primary`}>{pending === 'extract' ? <><Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />자료 읽는 중…</> : <>자료에서 숫자 가져오기<ArrowRight aria-hidden="true" className="h-4 w-4" /></>}</button>
            <button type="button" onClick={openReview} className={`${button} border border-hairline text-ink`}>숫자 직접 입력하기</button>
          </div>
        </fieldset>
      </form>
    </section> : <section className={card} aria-labelledby="review-title">
      <div className="flex flex-col justify-between gap-md sm:flex-row sm:items-start">
        <div><h2 id="review-title" ref={reviewHeading} tabIndex={-1} className="text-heading-sm text-ink focus:outline-none">숫자와 단위를 확인해 주세요</h2><p className="mt-xs text-body-sm text-steel">AI가 읽은 값은 틀릴 수 있습니다. 원본과 대조하고 수정한 후 분석하세요. 필수 항목 외 모르는 값은 비워두세요.</p></div>
        <button type="button" disabled={!!pending} onClick={() => { setStep('source'); setReport(null); setError(''); }} className={`${button} shrink-0 border border-hairline text-ink`}>자료 다시 선택</button>
      </div>
      {warnings.length > 0 && <aside className="mt-xl rounded-lg bg-surface p-md"><h3 className="mb-xs text-body-sm font-semibold text-ink">추출 시 확인이 필요한 항목</h3><TextList items={warnings} /></aside>}
      <form onSubmit={analyze} className="mt-xl space-y-xl">
        <fieldset disabled={!!pending} className="space-y-xl">
          <legend className="sr-only">재무자료 검토</legend>
          <div className="grid gap-md sm:grid-cols-3">
            <div><label htmlFor="company-name" className="mb-xs block text-body-sm font-medium">회사명 (필수)</label><input id="company-name" required maxLength={120} value={statement.companyName} onChange={(event) => updateStatement({ companyName: event.target.value })} className={input} aria-invalid={!!fieldErrors.companyName} aria-describedby={fieldErrors.companyName ? 'error-companyName' : undefined} /><FieldError name="companyName" errors={fieldErrors} /></div>
            <div><label htmlFor="fiscal-year" className="mb-xs block text-body-sm font-medium">회계연도 (필수)</label><input id="fiscal-year" type="number" required min={1900} max={2100} placeholder="예: 2025" value={statement.fiscalYear ?? ''} onChange={(event) => updateStatement({ fiscalYear: event.target.value === '' ? null : Number(event.target.value) })} className={input} aria-invalid={!!fieldErrors.fiscalYear} aria-describedby={fieldErrors.fiscalYear ? 'error-fiscalYear' : undefined} /><FieldError name="fiscalYear" errors={fieldErrors} /></div>
            <div><label htmlFor="money-unit" className="mb-xs block text-body-sm font-medium">모든 금액의 단위 (필수)</label><select id="money-unit" required value={statement.unit ?? ''} onChange={(event) => updateStatement({ unit: event.target.value as MoneyUnit || null })} className={input} aria-invalid={!!fieldErrors.unit} aria-describedby={fieldErrors.unit ? 'error-unit' : undefined}><option value="">원본의 단위 선택</option>{Object.entries(MONEY_UNITS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><FieldError name="unit" errors={fieldErrors} /></div>
          </div>
          <p className="rounded-lg bg-surface p-md text-body-sm text-charcoal">금액 단위를 바꾸어도 입력한 숫자는 자동 환산되지 않습니다. 모든 항목을 같은 단위로 입력하세요. 연간 결산 자료만 입력하고, 직전 연도 매출액도 같은 기간 길이의 연간 자료를 사용하세요. 손실·자본잠식은 음수(-)로 입력할 수 있습니다.</p>
          {['재무상태표', '손익·현금흐름'].map((group) => <fieldset key={group}><legend className="mb-md text-card-title text-ink">{group}</legend><div className="grid gap-md sm:grid-cols-2 lg:grid-cols-3">{FINANCIAL_FIELDS.filter((field) => field.group === group).map((field) => <div key={field.key}>
            <label htmlFor={`financial-${field.key}`} className="mb-xs block text-body-sm font-medium text-charcoal">{field.label} {field.required ? '(필수)' : '(선택)'}</label>
            <div className="relative"><input id={`financial-${field.key}`} type="number" step="any" min={field.signed ? undefined : 0} required={field.required} value={statement[field.key] ?? ''} onChange={(event) => updateStatement({ [field.key]: event.target.value === '' ? null : Number(event.target.value) })} aria-invalid={!!fieldErrors[field.key]} aria-describedby={fieldErrors[field.key] ? `error-${field.key}` : undefined} className={`${input} pr-section-lg`} /><span className="pointer-events-none absolute inset-y-0 right-md flex items-center text-caption text-steel">{statement.unit ? MONEY_UNITS[statement.unit] : '단위 미정'}</span></div>
            <FieldError name={field.key} errors={fieldErrors} />
          </div>)}</div></fieldset>)}
          {consentControl}
          <label className="flex min-h-11 cursor-pointer items-start gap-sm text-body-sm text-charcoal"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} className={`mt-xxs h-5 w-5 shrink-0 accent-primary ${focus}`} /><span>회사명, 회계연도, 금액 단위와 입력한 숫자를 확인했습니다.</span></label>
          <button type="submit" disabled={!consent || !confirmed || !!pending} className={`${button} w-full bg-primary text-on-primary sm:w-auto`}>{pending === 'analyze' ? <><Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />재무 분석 및 계획 작성 중…</> : <>AI 분석 및 개선 계획 만들기<ArrowRight aria-hidden="true" className="h-4 w-4" /></>}</button>
        </fieldset>
      </form>
    </section>}

    {pending && <p role="status" className="text-body-sm text-slate">{pending === 'extract' ? '재무제표에서 항목과 금액을 읽고 있습니다.' : '확인한 숫자로 지표를 계산하고 실행 계획을 작성하고 있습니다.'} 잠시 기다려 주세요.</p>}
    {error && <div role="alert" className="rounded-xl border border-error bg-canvas p-lg text-body-sm text-ink"><p className="font-semibold">요청을 완료하지 못했습니다.</p><p className="mt-xs whitespace-pre-line">{error}</p><p className="mt-xs text-steel">입력한 내용은 유지됩니다. 확인 후 위의 버튼으로 다시 시도해 주세요.</p></div>}

    {report && <section aria-labelledby="result-title" className="space-y-xl">
      <div className="flex flex-col justify-between gap-md sm:flex-row sm:items-center"><div><p className="mb-xs text-body-sm text-steel">{report.statement.companyName} · {report.statement.fiscalYear}년</p><h2 id="result-title" ref={resultHeading} tabIndex={-1} className="text-heading-md text-ink focus:outline-none">재무 분석과 개선 계획</h2></div><button type="button" onClick={download} className={`${button} border border-primary bg-canvas text-ink`}><Download aria-hidden="true" className="h-4 w-4" />결과 다운로드 (.md)</button></div>
      <div className={card}><h3 className="mb-md text-card-title text-ink">AI 분석 요약</h3><p className="text-body-md text-charcoal">{report.plan.summary}</p><div className="mt-xl grid gap-xl sm:grid-cols-2"><div><h4 className="mb-sm text-body-md font-semibold">강점</h4><TextList items={report.plan.strengths} /></div><div><h4 className="mb-sm text-body-md font-semibold">점검할 위험</h4><TextList items={report.plan.risks} /></div></div></div>
      <div><h3 className="mb-md text-card-title text-ink">확인한 숫자로 계산한 지표</h3><div className="grid gap-md sm:grid-cols-2 lg:grid-cols-3">{report.metrics.map((metric) => <article key={metric.id} className={card}><h4 className="text-body-sm font-medium text-steel">{metric.label}</h4><p className="my-sm text-heading-sm text-ink">{metric.value == null ? '계산 불가' : `${metric.value.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}${metric.unit}`}</p><p className="text-caption text-steel">{metric.formula}</p><p className="mt-sm text-body-sm text-charcoal">{metric.note}</p></article>)}</div></div>
      <div><h3 className="mb-md text-card-title text-ink">30·60·90일 실행 계획</h3><div className="space-y-md">{report.plan.actions.map((action, index) => <article key={index} className={card}><div className="mb-md flex flex-wrap items-center gap-sm"><span className="rounded-full bg-surface px-sm py-xxs text-caption-bold text-ink">{action.timeframe}</span><h4 className="text-card-title text-ink">{action.title}</h4></div><p className="mb-md text-body-sm text-slate">{action.rationale}</p><TextList items={action.steps} /><p className="mt-md border-t border-hairline-soft pt-md text-body-sm text-charcoal"><strong className="font-semibold">확인 기준:</strong> {action.successMeasure}</p>{action.metricIds.length > 0 && <p className="mt-xs text-caption text-steel">관련 지표: {action.metricIds.map((id) => report.metrics.find((metric) => metric.id === id)?.label).filter(Boolean).join(', ')}</p>}</article>)}</div></div>
      <div className="grid gap-md sm:grid-cols-2"><section className={card}><h3 className="mb-md text-card-title text-ink">준비하면 좋은 자료</h3><TextList items={report.plan.documents} /></section><section className={card}><h3 className="mb-md text-card-title text-ink">확인 사항과 분석의 한계</h3><TextList items={[...report.warnings, ...report.plan.limitations]} /></section></div>
      <footer className="space-y-md text-caption text-steel"><p>{report.disclaimer}</p><p>생성 시각: {new Date(report.generatedAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })} (한국 시간)</p><div><p className="mb-xs font-semibold text-charcoal">평가 체계 참고 자료</p><ul className="space-y-xs">{report.sources.map((source) => <li key={source.url}><a href={source.url} target="_blank" rel="noopener noreferrer" className={`inline-flex min-h-11 items-center rounded-sm text-brand-blue-deep underline underline-offset-4 ${focus}`}>{source.title} (새 창)</a></li>)}</ul></div><p>숫자를 수정하면 기존 결과가 지워집니다. 변경한 자료로 다시 분석해 주세요.</p></footer>
    </section>}
  </div>;
}

function FieldError({ name, errors }: { name: string; errors: Record<string, string> }) {
  return errors[name] ? <p id={`error-${name}`} className="mt-xs text-body-sm text-charcoal">{errors[name]}</p> : null;
}

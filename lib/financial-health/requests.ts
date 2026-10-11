import { FinancialRequestError } from './errors';
import { calculateMetrics } from './metrics';
import { extractFinancialStatement, generateFinancialPlan, readFinancialDocument } from './provider';
import { validateStatement } from './validation';
import { FINANCIAL_DISCLAIMER, FINANCIAL_SOURCES, MAX_FILE_BYTES, MAX_STATEMENT_TEXT } from './types';

interface Dependencies {
  authorize: () => Promise<string | null>;
  extract?: typeof extractFinancialStatement;
  analyze?: typeof generateFinancialPlan;
  readDocument?: typeof readFinancialDocument;
  acquire?: (userId: string) => () => void;
}

// Bounds repeated clicks and concurrent spend per process. A distributed quota
// is a deployment follow-up; this is intentionally not a billing entitlement.
const usage = new Map<string, { count: number; expires: number; busy: boolean }>();
function acquireRequest(userId: string): () => void {
  const now = Date.now();
  usage.forEach((entry, key) => { if (entry.expires <= now && !entry.busy) usage.delete(key); });
  let entry = usage.get(userId);
  if (entry?.busy) throw new FinancialRequestError('이전 분석이 진행 중입니다. 완료 후 다시 시도해주세요.', 429);
  if (!entry) {
    if (usage.size >= 10_000) throw new FinancialRequestError('요청이 많습니다. 잠시 후 다시 시도해주세요.', 503);
    entry = { count: 0, expires: now + 3_600_000, busy: false };
    usage.set(userId, entry);
  }
  if (entry.count >= 12) throw new FinancialRequestError('분석 요청 한도에 도달했습니다. 한 시간 후 다시 시도해주세요.', 429);
  entry.count++;
  entry.busy = true;
  return () => { entry.busy = false; };
}

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });
}

/** Enforce actual bytes even when Content-Length is missing or dishonest. */
async function readBody(request: Request, limit: number): Promise<ArrayBuffer> {
  if (Number(request.headers.get('content-length')) > limit) throw new FinancialRequestError('입력 자료가 너무 큽니다.', 413);
  if (!request.body) throw new FinancialRequestError('입력 자료가 없습니다.');
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new FinancialRequestError('입력 자료가 너무 큽니다.', 413);
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return bytes.buffer;
}

async function readJson(request: Request) {
  if (!request.headers.get('content-type')?.startsWith('application/json')) throw new FinancialRequestError('JSON 형식으로 입력해주세요.', 415);
  const bytes = await readBody(request, MAX_STATEMENT_TEXT * 4 + 4096);
  try {
    const result = JSON.parse(new TextDecoder().decode(bytes));
    if (!result || typeof result !== 'object' || Array.isArray(result)) throw new Error('Expected object');
    return result;
  } catch { throw new FinancialRequestError('입력 데이터를 읽을 수 없습니다.'); }
}

async function handle(request: Request, deps: Dependencies, action: (userId: string) => Promise<Response>): Promise<Response> {
  try {
    const origin = request.headers.get('origin');
    if (origin && origin !== new URL(request.url).origin) return json({ error: '허용되지 않은 요청입니다.' }, 403);
    const userId = await deps.authorize();
    if (!userId) return json({ error: '로그인이 필요합니다. 다시 로그인해주세요.' }, 401);
    return await action(userId);
  } catch (error) {
    if (error instanceof FinancialRequestError) return json({ error: error.message }, error.status);
    // Never log statement contents, parsed data, or raw provider responses.
    return json({ error: 'AI 처리에 실패했습니다. 입력 내용은 유지됩니다. 잠시 후 다시 시도해주세요.' }, 502);
  }
}

export function handleExtractRequest(request: Request, deps: Dependencies): Promise<Response> {
  return handle(request, deps, async (userId) => {
    let text: string | undefined;
    let file: File | undefined;
    if (request.headers.get('content-type')?.startsWith('multipart/form-data')) {
      const bytes = await readBody(request, MAX_FILE_BYTES + 16_384);
      let form: FormData;
      try { form = await new Response(bytes, { headers: { 'Content-Type': request.headers.get('content-type')! } }).formData(); }
      catch { throw new FinancialRequestError('파일을 읽을 수 없습니다. 다시 선택해주세요.'); }
      if (form.get('consent') !== 'true') throw new FinancialRequestError('AI 자료 전송 동의가 필요합니다.');
      const value = form.get('file');
      if (!value || typeof value === 'string') throw new FinancialRequestError('재무제표 파일을 선택해주세요.');
      file = value;
    } else {
      const body = await readJson(request);
      if (body.consent !== true) throw new FinancialRequestError('AI 자료 전송 동의가 필요합니다.');
      if (typeof body.text !== 'string' || body.text.trim().length < 20 || body.text.length > MAX_STATEMENT_TEXT) {
        throw new FinancialRequestError('재무제표 텍스트를 20~40,000자로 입력해주세요.');
      }
      text = body.text.trim();
    }
    const release = (deps.acquire ?? acquireRequest)(userId);
    try {
      if (file) text = await (deps.readDocument ?? readFinancialDocument)(file);
      return json(await (deps.extract ?? extractFinancialStatement)(text!));
    } finally { release(); }
  });
}

export function handleAnalyzeRequest(request: Request, deps: Dependencies): Promise<Response> {
  return handle(request, deps, async (userId) => {
    const body = await readJson(request);
    if (body.consent !== true || body.confirmed !== true) throw new FinancialRequestError('AI 자료 전송에 동의하고 재무제표 수치를 확인해주세요.');
    const { statement, fieldErrors, warnings } = validateStatement(body.statement);
    if (Object.keys(fieldErrors).length) return json({ error: '입력한 재무제표를 확인해주세요.', fieldErrors }, 400);
    const release = (deps.acquire ?? acquireRequest)(userId);
    try {
      const metrics = calculateMetrics(statement);
      const plan = await (deps.analyze ?? generateFinancialPlan)(statement, metrics, warnings);
      return json({ statement, metrics, warnings, plan, generatedAt: new Date().toISOString(), disclaimer: FINANCIAL_DISCLAIMER, sources: FINANCIAL_SOURCES });
    } finally { release(); }
  });
}

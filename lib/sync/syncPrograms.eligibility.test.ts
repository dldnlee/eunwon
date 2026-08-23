import assert from 'node:assert/strict';
import test from 'node:test';
import type { createServiceClient } from '../supabase/server';
import { persistEligibilityEvidenceForSources } from './syncPrograms';

type Operation = { name: string; args: unknown[] };
type RecordedQuery = { table: string; operations: Operation[] };

function mockSupabase(resolveQuery: (query: RecordedQuery) => unknown) {
  const queries: RecordedQuery[] = [];

  const from = (table: string) => {
    const query: RecordedQuery = { table, operations: [] };
    queries.push(query);
    const builder: Record<string, unknown> = {};

    for (const name of ['upsert', 'select', 'eq', 'maybeSingle', 'single', 'delete', 'insert', 'update']) {
      builder[name] = (...args: unknown[]) => {
        query.operations.push({ name, args });
        return builder;
      };
    }
    builder.then = (fulfilled: (value: unknown) => unknown, rejected: (reason: unknown) => unknown) =>
      Promise.resolve(resolveQuery(query)).then(fulfilled, rejected);
    return builder;
  };

  return {
    client: { from } as unknown as ReturnType<typeof createServiceClient>,
    queries,
  };
}

const sourceInputs = [{
  sourceKey: 'target',
  sourceType: 'api_text' as const,
  contentText: '서울 소재 중소기업을 지원합니다.',
}];

test('eligibility persistence reuses a successful fingerprint and skips extraction', async () => {
  let extractionCalls = 0;
  const { client, queries } = mockSupabase((query) => {
    if (query.table === 'program_source_documents') {
      return { data: [{ id: 'source-1', source_key: 'target' }], error: null };
    }
    if (query.table === 'program_extraction_runs') {
      return { data: { id: 'cached-run' }, error: null };
    }
    throw new Error(`unexpected table: ${query.table}`);
  });

  await persistEligibilityEvidenceForSources(client, 'program-1', sourceInputs, {
    extract: async () => {
      extractionCalls += 1;
      throw new Error('extractor should not run');
    },
  });

  assert.equal(extractionCalls, 0);
  assert.equal(queries.filter((query) => query.table === 'program_extraction_runs').length, 1);
  assert.equal(queries.some((query) => query.table === 'program_eligibility_requirements'), false);
});

test('eligibility persistence retries a non-successful run and replaces only that run rows', async () => {
  const { client, queries } = mockSupabase((query) => {
    if (query.table === 'program_source_documents') {
      return { data: [{ id: 'source-1', source_key: 'target' }], error: null };
    }
    if (query.table === 'program_extraction_runs') {
      const operationNames = query.operations.map(({ name }) => name);
      if (operationNames.includes('maybeSingle')) return { data: null, error: null };
      if (operationNames.includes('upsert')) return { data: { id: 'retry-run' }, error: null };
      return { data: null, error: null };
    }
    if (query.table === 'program_eligibility_requirements') return { data: null, error: null };
    throw new Error(`unexpected table: ${query.table}`);
  });

  await persistEligibilityEvidenceForSources(client, 'program-1', sourceInputs, {
    now: () => new Date('2026-08-23T00:00:00.000Z'),
    extract: async () => ({
      sourceFingerprint: 'fingerprint',
      extractorVersion: 'eligibility-v2',
      model: 'mock-model',
      requirements: [{
        requirementType: 'region',
        operator: 'in',
        value: ['서울'],
        normalizedText: '서울 소재',
        sourceKey: 'target',
        evidenceQuote: '서울 소재',
        evidenceStart: 0,
        evidenceEnd: 5,
        verification: 'verified',
        confidence: 0.99,
      }],
    }),
  });

  const requirementQueries = queries.filter((query) => query.table === 'program_eligibility_requirements');
  assert.equal(requirementQueries.length, 2);
  const cleanup = requirementQueries[0].operations;
  assert.deepEqual(cleanup.map(({ name }) => name), ['delete', 'eq']);
  assert.deepEqual(cleanup[1].args, ['extraction_run_id', 'retry-run']);
  assert.equal(requirementQueries[1].operations[0].name, 'insert');

  const completion = queries.find((query) =>
    query.table === 'program_extraction_runs'
      && query.operations.some(({ name, args }) => name === 'update' && (args[0] as { status?: string }).status === 'succeeded')
  );
  assert.ok(completion);
});

test('a failed extraction marks the retry failed without deleting prior requirements', async () => {
  const { client, queries } = mockSupabase((query) => {
    if (query.table === 'program_source_documents') {
      return { data: [{ id: 'source-1', source_key: 'target' }], error: null };
    }
    if (query.table === 'program_extraction_runs') {
      const operationNames = query.operations.map(({ name }) => name);
      if (operationNames.includes('maybeSingle')) return { data: null, error: null };
      if (operationNames.includes('upsert')) return { data: { id: 'retry-run' }, error: null };
      return { data: null, error: null };
    }
    throw new Error(`unexpected table: ${query.table}`);
  });

  await assert.rejects(
    persistEligibilityEvidenceForSources(client, 'program-1', sourceInputs, {
      extract: async () => { throw new Error('bounded provider failure'); },
    }),
    /bounded provider failure/
  );

  assert.equal(queries.some((query) => query.table === 'program_eligibility_requirements'), false);
  const failure = queries.find((query) =>
    query.table === 'program_extraction_runs'
      && query.operations.some(({ name, args }) => name === 'update' && (args[0] as { status?: string }).status === 'failed')
  );
  assert.ok(failure);
});

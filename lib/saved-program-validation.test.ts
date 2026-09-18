import assert from 'node:assert/strict';
import test from 'node:test';
import { savedProgramUpdateSchema } from './saved-program-validation';

for (const field of ['receivedAt', 'nextActionDueAt'] as const) {
  test(`${field} rejects impossible calendar dates before database writes`, () => {
    for (const date of ['2026-02-30', '2026-02-29', '2100-02-29', '2026-04-31', '2026-13-01', '2026-00-10', '2026-01-00', '0000-01-01']) {
      const parsed = savedProgramUpdateSchema.safeParse({ [field]: date });
      assert.equal(parsed.success, false, `${field} must reject ${date}`);
      if (!parsed.success) {
        assert.deepEqual(parsed.error.issues[0].path, [field]);
        assert.equal(parsed.error.issues[0].message, '날짜 형식이 올바르지 않습니다.');
      }
    }
  });

  test(`${field} accepts real dates including leap days without changing them`, () => {
    for (const date of ['2026-02-28', '2024-02-29', '2000-02-29', '2026-04-30', '2026-12-31', '0001-01-01']) {
      assert.deepEqual(savedProgramUpdateSchema.parse({ [field]: date }), { [field]: date });
    }
  });

  test(`${field} remains optional and clearable`, () => {
    for (const date of ['', null]) {
      assert.deepEqual(savedProgramUpdateSchema.parse({ [field]: date }), { [field]: date });
    }
    assert.deepEqual(savedProgramUpdateSchema.parse({ notes: '서류 준비' }), { notes: '서류 준비' });
  });

  test(`${field} rejects timestamps, non-padded dates, and non-string values`, () => {
    for (const date of ['2026-09-18T00:00:00Z', '2026-9-18', ' 2026-09-18 ', '2026/09/18', 20260918, false]) {
      assert.equal(savedProgramUpdateSchema.safeParse({ [field]: date }).success, false);
    }
  });
}

test('saved program updates still reject empty and unknown-only payloads', () => {
  for (const input of [{}, { user_id: 'another-user' }, null]) {
    assert.equal(savedProgramUpdateSchema.safeParse(input).success, false);
  }
});

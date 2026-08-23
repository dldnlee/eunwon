import assert from 'node:assert/strict';
import test from 'node:test';
import {
  SAVED_STATUSES,
  canTransitionSavedStatus,
} from './application-status';

test('all active application stages can advance or be corrected', () => {
  assert.equal(canTransitionSavedStatus('considering', 'preparing'), true);
  assert.equal(canTransitionSavedStatus('submitted', 'preparing'), true);
  assert.equal(canTransitionSavedStatus('screening', 'selected'), true);
});

test('terminal stages must restart before moving to another stage', () => {
  for (const terminal of ['selected', 'rejected', 'withdrawn'] as const) {
    assert.equal(canTransitionSavedStatus(terminal, 'considering'), true);
    assert.equal(canTransitionSavedStatus(terminal, 'preparing'), false);
    assert.equal(canTransitionSavedStatus(terminal, terminal), true);
  }
});

test('status vocabulary remains the eight persisted tracker states', () => {
  assert.deepEqual(SAVED_STATUSES, [
    'considering', 'preparing', 'submitted', 'screening',
    'interview', 'selected', 'rejected', 'withdrawn',
  ]);
});

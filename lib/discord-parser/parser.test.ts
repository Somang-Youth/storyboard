import assert from 'node:assert/strict';
import { test } from 'vitest';
import { extractWorshipData } from './parser.ts';

test('normalizes a full Korean book name with chapter and verse words', () => {
  assert.deepEqual(extractWorshipData('말씀: 로마서 10장 14~21절'), {
    scripture: '롬 10:14~21',
  });
});

test('normalizes Korean single-verse and hyphen forms', () => {
  assert.deepEqual(extractWorshipData('말씀: 롬10장14절'), {
    scripture: '롬 10:14',
  });
  assert.deepEqual(extractWorshipData('말씀: 로마서 10장 14-21절'), {
    scripture: '롬 10:14~21',
  });
});

test('preserves existing colon notation behavior', () => {
  assert.deepEqual(extractWorshipData('말씀: 로마서 10:14~21'), {
    scripture: '롬 10:14~21',
  });
});

test('preserves unsupported cross-chapter Korean notation verbatim', () => {
  for (const scripture of [
    '로마서10장14절~11장2절',
    '로마서 10장 14절~11장 2절',
  ]) {
    assert.deepEqual(extractWorshipData(`말씀: ${scripture}`), {
      scripture,
    });
  }
});

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cosine, topMatches } from '../src/rank.js';

test('identical vectors score 1', () => {
  assert.ok(Math.abs(cosine([1, 0, 0], [1, 0, 0]) - 1) < 1e-9);
});

test('orthogonal vectors score 0', () => {
  assert.ok(Math.abs(cosine([1, 0], [0, 1])) < 1e-9);
});

test('mismatched lengths score 0 instead of throwing', () => {
  assert.equal(cosine([1, 0, 0], [1, 0]), 0);
});

test('topMatches puts the nearest chunk first', () => {
  const rows = [
    { id: 'far', vector: [0, 1, 0] },
    { id: 'near', vector: [0.9, 0.1, 0] },
    { id: 'exact', vector: [1, 0, 0] },
  ];
  const top = topMatches(rows, [1, 0, 0], 2);
  assert.deepEqual(top.map(row => row.id), ['exact', 'near']);
  assert.ok(top[0].score > top[1].score);
});

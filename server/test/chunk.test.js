import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chunkText } from '../src/chunk.js';

test('blank text produces no chunks', () => {
  assert.deepEqual(chunkText('   \n\n\t'), []);
});

test('a short note stays in one chunk', () => {
  const chunks = chunkText('buy oat milk\n\nthe blue carton');
  assert.equal(chunks.length, 1);
  assert.match(chunks[0].content, /oat milk/);
  assert.match(chunks[0].content, /blue carton/);
});

test('a long page overlaps the cut', () => {
  const para = Array.from({ length: 40 }, (_, i) => {
    return `Sentence number ${i} talks about rivers and bridges and boats.`;
  }).join(' ');
  const chunks = chunkText(`${para}\n\n${para}\n\n${para}`);
  assert.ok(chunks.length >= 2, `expected several chunks, got ${chunks.length}`);
  const tail = chunks[0].content.slice(-80).trim();
  assert.ok(chunks[1].content.includes(tail.slice(-40)), 'second chunk should repeat the end of the first');
});

test('a wall of text without punctuation still gets cut', () => {
  const chunks = chunkText('a'.repeat(5000));
  assert.ok(chunks.length >= 3);
  assert.ok(chunks.every(chunk => chunk.content.length > 0));
});

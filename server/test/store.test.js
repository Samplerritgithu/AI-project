import assert from 'node:assert/strict';
import { test } from 'node:test';

process.env.DB_PATH = ':memory:';

const { insertItem, loadChunks, deleteItem, listItems } = await import('../src/db.js');

test('a saved chunk round-trips its vector', () => {
  const item = insertItem({
    sourceType: 'note',
    title: 'Milk',
    url: null,
    body: 'buy milk',
    chunks: [{ content: 'buy milk', embedding: [0.25, -0.5, 1] }],
  });

  assert.equal(item.title, 'Milk');
  assert.equal(item.chunkCount, 1);
  assert.equal(item.preview, 'buy milk');

  const [chunk] = loadChunks();
  assert.equal(chunk.itemId, item.id);
  assert.ok(Math.abs(chunk.vector[0] - 0.25) < 1e-6);
  assert.ok(Math.abs(chunk.vector[1] + 0.5) < 1e-6);
  assert.ok(Math.abs(chunk.vector[2] - 1) < 1e-6);

  assert.equal(listItems().length, 1);
  assert.equal(deleteItem(item.id), true);
  assert.equal(loadChunks().length, 0);
  assert.equal(deleteItem(item.id), false);
});

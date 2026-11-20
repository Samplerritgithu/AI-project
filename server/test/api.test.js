import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { once } from 'node:events';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

process.env.DB_PATH = path.join(mkdtempSync(path.join(tmpdir(), 'inbox-')), 'test.db');
process.env.OPENAI_API_KEY ||= 'test-key-not-used';

const { createApp } = await import('../src/index.js');

test('bad notes, bad urls, and an empty inbox', async () => {
  await withServer(async base => {
    const emptyNote = await post(base, '/ingest', { type: 'note', content: '   ' });
    assert.equal(emptyNote.status, 400);
    assert.match(emptyNote.body.error, /empty/i);

    const junk = await fetch(`${base}/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{',
    });
    assert.equal(junk.status, 400);

    const local = await post(base, '/ingest', { type: 'url', url: 'http://127.0.0.1/secret' });
    assert.equal(local.status, 400);
    assert.match(local.body.error, /private/);

    const items = await fetch(`${base}/items`);
    assert.equal(items.status, 200);
    assert.deepEqual(await items.json(), { items: [] });

    const ask = await post(base, '/query', { question: 'what did I save?' });
    assert.equal(ask.status, 200);
    assert.equal(ask.body.answer, 'Nothing saved yet.');
    assert.deepEqual(ask.body.sources, []);

    const missing = await fetch(`${base}/nope`, { method: 'POST' });
    assert.equal(missing.status, 404);
  });
});

async function post(base, urlPath, body) {
  const res = await fetch(`${base}${urlPath}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}

async function withServer(fn) {
  const server = createApp().listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    await fn(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

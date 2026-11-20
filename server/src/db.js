import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS items (
  id TEXT PRIMARY KEY,
  source_type TEXT NOT NULL CHECK (source_type IN ('note', 'url')),
  title TEXT NOT NULL,
  url TEXT,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS chunks (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  idx INTEGER NOT NULL,
  text TEXT NOT NULL,
  embedding BLOB NOT NULL
) STRICT;

CREATE INDEX IF NOT EXISTS chunks_item ON chunks(item_id);
`;

let database;

function conn() {
  if (database) return database;
  const filename = process.env.DB_PATH || defaultFile();
  if (filename !== ':memory:') {
    mkdirSync(path.dirname(filename), { recursive: true });
  }
  database = new DatabaseSync(filename);
  database.exec('PRAGMA foreign_keys = ON');
  if (filename !== ':memory:') database.exec('PRAGMA journal_mode = WAL');
  database.exec(SCHEMA);
  return database;
}

function defaultFile() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  return path.join(root, 'data', 'inbox.db');
}

function statements() {
  const db = conn();
  return {
    insertItem: db.prepare(`
      INSERT INTO items (id, source_type, title, url, body, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `),
    insertChunk: db.prepare(`
      INSERT INTO chunks (id, item_id, idx, text, embedding)
      VALUES (?, ?, ?, ?, ?)
    `),
    remove: db.prepare('DELETE FROM items WHERE id = ?'),
    one: db.prepare(`
      SELECT items.*,
        (SELECT count(*) FROM chunks WHERE chunks.item_id = items.id) AS chunk_count
      FROM items WHERE id = ?
    `),
    list: db.prepare(`
      SELECT items.*,
        (SELECT count(*) FROM chunks WHERE chunks.item_id = items.id) AS chunk_count
      FROM items
      ORDER BY created_at DESC
    `),
    chunks: db.prepare(`
      SELECT chunks.id, chunks.item_id, chunks.idx, chunks.text, chunks.embedding,
             items.title, items.source_type, items.url
      FROM chunks
      JOIN items ON items.id = chunks.item_id
    `),
  };
}

export function insertItem({ sourceType, title, url, body, chunks }) {
  const db = conn();
  const sql = statements();
  const id = randomUUID();
  const createdAt = new Date().toISOString();

  db.exec('BEGIN IMMEDIATE');
  try {
    sql.insertItem.run(id, sourceType, title, url ?? null, body, createdAt);
    chunks.forEach((chunk, idx) => {
      sql.insertChunk.run(randomUUID(), id, idx, chunk.content, packVector(chunk.embedding));
    });
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
  return present(sql.one.get(id));
}

export function listItems() {
  return statements().list.all().map(present);
}

export function deleteItem(id) {
  return statements().remove.run(id).changes > 0;
}

// Every chunk, every time. Fine for one person. Tens of thousands of
// chunks is when this should move into sqlite-vec or Postgres.
export function loadChunks() {
  return statements().chunks.all().map(row => ({
    id: row.id,
    itemId: row.item_id,
    index: row.idx,
    text: row.text,
    title: row.title,
    sourceType: row.source_type,
    url: row.url,
    vector: unpackVector(row.embedding),
  }));
}

function present(row) {
  return {
    id: row.id,
    sourceType: row.source_type,
    title: row.title,
    url: row.url,
    preview: preview(row.body),
    body: row.body,
    chunkCount: row.chunk_count,
    createdAt: row.created_at,
  };
}

function preview(body) {
  const flat = body.replace(/\s+/g, ' ').trim();
  if (flat.length <= 160) return flat;
  return `${flat.slice(0, 157)}…`;
}

function packVector(values) {
  const buf = Buffer.allocUnsafe(values.length * 4);
  for (let i = 0; i < values.length; i++) buf.writeFloatLE(values[i], i * 4);
  return buf;
}

function unpackVector(blob) {
  const buf = Buffer.from(blob);
  const out = new Array(buf.length / 4);
  for (let i = 0; i < out.length; i++) out[i] = buf.readFloatLE(i * 4);
  return out;
}

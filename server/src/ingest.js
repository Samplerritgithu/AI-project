import { chunkText } from './chunk.js';
import { insertItem } from './db.js';
import { embed } from './embed.js';
import { HttpError } from './errors.js';
import { fetchPage } from './extract.js';
import { log } from './log.js';

export async function saveNote({ content, title }) {
  return saveItem({
    sourceType: 'note',
    title: title || titleFromNote(content),
    url: null,
    body: content,
  });
}

export async function saveUrl(url) {
  const page = await fetchPage(url);
  const title = (page.title || titleFromUrl(page.finalUrl)).slice(0, 120);
  return saveItem({
    sourceType: 'url',
    title,
    url: page.finalUrl,
    body: page.text,
  });
}

async function saveItem({ sourceType, title, url, body }) {
  const started = Date.now();
  const parts = chunkText(body);
  if (!parts.length) {
    throw new HttpError(422, 'Nothing left to save after cleaning that up.');
  }
  const vectors = await embed(parts.map(part => part.content));
  const item = insertItem({
    sourceType,
    title,
    url,
    body,
    chunks: parts.map((part, i) => ({ content: part.content, embedding: vectors[i] })),
  });
  log('info', 'saved', {
    id: item.id,
    sourceType,
    chunks: item.chunkCount,
    chars: body.length,
    ms: Date.now() - started,
  });
  return item;
}

function titleFromNote(content) {
  const line = content.split('\n').map(part => part.trim()).find(Boolean) || 'Note';
  return line.length > 80 ? `${line.slice(0, 77)}…` : line;
}

function titleFromUrl(url) {
  const parsed = new URL(url);
  const path = parsed.pathname === '/' ? '' : parsed.pathname;
  return `${parsed.hostname}${path}`.slice(0, 120);
}

import { HttpError } from './errors.js';

const NOTE_LIMIT = 100_000;
const QUESTION_LIMIT = 2_000;

export function parseIngest(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new HttpError(400, 'Expected a JSON object.');
  }

  const type = body.type || (body.url ? 'url' : body.content ? 'note' : '');
  if (type === 'note') {
    if (typeof body.content !== 'string' || !body.content.trim()) {
      throw new HttpError(400, 'Note is empty.');
    }
    if (body.content.length > NOTE_LIMIT) {
      throw new HttpError(413, 'Note is too long.');
    }
    return {
      type: 'note',
      content: body.content.trim(),
      title: optionalTitle(body.title),
    };
  }

  if (type === 'url') {
    if (typeof body.url !== 'string' || !body.url.trim()) {
      throw new HttpError(400, 'Missing url.');
    }
    if (body.url.trim().length > 2_000) {
      throw new HttpError(400, 'That URL is too long.');
    }
    return { type: 'url', url: body.url.trim() };
  }

  throw new HttpError(400, 'type should be "note" or "url".');
}

export function parseQuestion(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new HttpError(400, 'Expected a JSON object.');
  }
  if (typeof body.question !== 'string' || !body.question.trim()) {
    throw new HttpError(400, 'Question is empty.');
  }
  const question = body.question.trim();
  if (question.length > QUESTION_LIMIT) {
    throw new HttpError(400, 'Question is too long.');
  }
  return question;
}

function optionalTitle(value) {
  if (value == null || value === '') return null;
  if (typeof value !== 'string') throw new HttpError(400, 'Title should be text.');
  const title = value.trim();
  if (!title) return null;
  if (title.length > 120) throw new HttpError(400, 'Title is too long.');
  return title;
}

import OpenAI from 'openai';
import { HttpError } from './errors.js';
import { log } from './log.js';

const BATCH = 64;

let client;

function openai() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new HttpError(500, 'OPENAI_API_KEY is not set.');
  if (!client) client = new OpenAI({ apiKey });
  return client;
}

export async function embed(texts) {
  if (!texts.length) return [];
  const model = process.env.EMBED_MODEL || 'text-embedding-3-small';
  const out = [];

  for (let i = 0; i < texts.length; i += BATCH) {
    const input = texts.slice(i, i + BATCH);
    let res;
    try {
      res = await openai().embeddings.create({ model, input });
    } catch (err) {
      throw upstream(err, 'Embedding');
    }
    const ordered = [...res.data].sort((a, b) => a.index - b.index);
    for (const row of ordered) out.push(row.embedding);
  }

  if (out.length !== texts.length) {
    throw new HttpError(502, 'Embedding response was incomplete.');
  }
  return out;
}

export async function complete(messages) {
  const model = process.env.CHAT_MODEL || 'gpt-6-luna';
  try {
    // Luna returns 400 if you send temperature with the default reasoning
    // effort. Answering from a handful of notes isn't a puzzle, so effort is off.
    return await openai().chat.completions.create({
      model,
      reasoning_effort: 'none',
      temperature: 0.2,
      max_completion_tokens: 700,
      messages,
    });
  } catch (err) {
    throw upstream(err, 'The answer call');
  }
}

function upstream(err, what) {
  if (err instanceof HttpError) throw err;
  const detail = typeof err.message === 'string' ? err.message : '';
  log('error', 'openai failed', { what, status: err.status, code: err.code, message: detail });
  if (err.status === 401) throw new HttpError(502, 'OpenAI rejected the API key.');
  if (err.code === 'insufficient_quota' || /credit|quota|billing/i.test(detail)) {
    throw new HttpError(402, 'This OpenAI account has no API credits. Add credits at platform.openai.com/settings/organization/billing, then save again.');
  }
  if (err.status === 429) throw new HttpError(502, 'OpenAI rate limit hit. Give it a minute.');
  const short = detail.replace(/^\d+\s*/, '').slice(0, 180);
  throw new HttpError(502, short ? `${what} failed. ${short}` : `${what} failed.`);
}

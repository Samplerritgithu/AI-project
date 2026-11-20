import { loadChunks } from './db.js';
import { complete, embed } from './embed.js';
import { HttpError } from './errors.js';
import { log } from './log.js';
import { topMatches } from './rank.js';

const TOP_K = 5;

// Starting guess for text-embedding-3-small. I have not tuned it on a
// real pile of notes. If good questions get refused, lower it.
const MIN_SCORE = 0.22;

const SYSTEM = [
  'Answer the question using only the excerpts.',
  "If they don't contain the answer, say you don't have it in the inbox.",
  'Cite an excerpt you used as [1] or [2], matching the numbers given.',
  'Plain sentences. No markdown, no preamble.',
].join(' ');

export async function answerQuestion(question) {
  const started = Date.now();
  const chunks = loadChunks();
  if (!chunks.length) {
    return { answer: 'Nothing saved yet.', sources: [] };
  }

  const [queryVec] = await embed([question]);
  const ranked = topMatches(chunks, queryVec, TOP_K);
  const best = ranked[0]?.score ?? 0;
  if (best < MIN_SCORE) {
    log('info', 'query missed', { chars: question.length, top: round(best), ms: Date.now() - started });
    return { answer: 'Nothing in the inbox looks close to that.', sources: [] };
  }

  const picked = ranked.filter(row => row.score >= MIN_SCORE);
  const block = picked.map((row, i) => `[${i + 1}] ${row.title}\n${row.text}`).join('\n\n');
  const res = await complete([
    { role: 'system', content: SYSTEM },
    { role: 'user', content: `Excerpts:\n\n${block}\n\nQuestion: ${question}` },
  ]);

  const answer = textOf(res.choices?.[0]?.message?.content);
  if (!answer) throw new HttpError(502, 'The model returned an empty answer.');

  log('info', 'query', {
    chars: question.length,
    top: round(best),
    used: picked.length,
    ms: Date.now() - started,
  });

  return {
    answer,
    sources: picked.map(row => ({
      chunkId: row.id,
      itemId: row.itemId,
      sourceType: row.sourceType,
      title: row.title,
      url: row.url,
      text: row.text,
      score: round(row.score),
    })),
  };
}

function textOf(content) {
  if (typeof content === 'string') return content.trim();
  if (Array.isArray(content)) {
    return content.map(part => (typeof part === 'string' ? part : part?.text || '')).join('').trim();
  }
  return '';
}

function round(score) {
  return Math.round(score * 1000) / 1000;
}

import { load } from 'cheerio';
import { HttpError } from './errors.js';
import { log } from './log.js';
import { prepareFetchUrl } from './urlcheck.js';

const MAX_BYTES = 1_000_000;
const MAX_HOPS = 5;
const MIN_TEXT = 40;

// A bare script UA gets blocked by a lot of article sites.
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36';

export async function fetchPage(input) {
  let current = input;
  for (let hop = 0; hop < MAX_HOPS; hop++) {
    current = await prepareFetchUrl(current);
    let res;
    try {
      res = await fetch(current, {
        redirect: 'manual',
        headers: {
          'User-Agent': UA,
          Accept: 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.1',
        },
        signal: AbortSignal.timeout(12_000),
      });
    } catch (err) {
      if (err instanceof HttpError) throw err;
      log('error', 'fetch failed', { host: hostOf(current), message: err.message });
      if (err.name === 'TimeoutError' || err.name === 'AbortError') {
        throw new HttpError(502, 'That page took too long.');
      }
      throw new HttpError(502, 'Could not fetch that page.');
    }

    if ([301, 302, 303, 307, 308].includes(res.status)) {
      const loc = res.headers.get('location');
      await res.body?.cancel();
      if (!loc) throw new HttpError(502, 'The page redirected without a location.');
      current = new URL(loc, current).href;
      continue;
    }

    if (!res.ok) {
      await res.body?.cancel();
      throw new HttpError(502, `The page responded ${res.status}.`);
    }

    const announced = Number(res.headers.get('content-length'));
    if (Number.isFinite(announced) && announced > MAX_BYTES) {
      await res.body?.cancel();
      throw new HttpError(413, 'That page is over 1MB. I stopped.');
    }

    const buf = await readLimited(res);
    const contentType = res.headers.get('content-type') || '';
    const decoded = decodeBody(buf, contentType);
    const page = toText(decoded, contentType);
    if (page.text.length < MIN_TEXT) {
      // todo: sites that only paint after JS come back empty. not worth a browser here.
      throw new HttpError(422, "That page didn't have enough text. It may be behind a login, or built only in JavaScript.");
    }
    return { ...page, finalUrl: current };
  }
  throw new HttpError(502, 'Too many redirects.');
}

export function htmlToText(html) {
  const $ = load(html);
  $('script, style, noscript, svg, iframe, form, nav, footer, aside').remove();
  const title = $('title').first().text().replace(/\s+/g, ' ').trim();
  const root = $('article').length ? $('article').first() : $('main').length ? $('main').first() : $('body');

  // Whole-document text() keeps menus and "50 languages" lists. Headings
  // and paragraphs are the part you'd actually ask a question about.
  const blocks = [];
  root.find('h1, h2, h3, p, blockquote').each((_, el) => {
    const text = $(el).text().replace(/\s+/g, ' ').trim();
    if (!text) return;
    const tag = (el.name || '').toLowerCase();
    blocks.push({ heading: tag.startsWith('h'), text });
  });
  // Trailing "See also" / "References" headings have no paragraph under them.
  while (blocks.length && blocks[blocks.length - 1].heading) blocks.pop();
  const parts = blocks.map(block => block.text);
  if (parts.join('\n\n').length >= MIN_TEXT) {
    return { title, text: parts.join('\n\n') };
  }

  root.find('br').replaceWith('\n');
  return { title, text: collapse(root.text()) };
}

function toText(decoded, contentType) {
  const type = contentType.toLowerCase();
  const looksHtml = type.includes('html') || /^\s*(<!doctype html|<html)/i.test(decoded.slice(0, 300));
  if (looksHtml) return htmlToText(decoded);
  if (type.includes('text/') || type.includes('json') || type.includes('xml') || type === '') {
    return { title: '', text: collapse(decoded) };
  }
  throw new HttpError(422, `Can't read that page (${type.split(';')[0] || 'unknown type'}).`);
}

async function readLimited(res) {
  if (!res.body) return Buffer.alloc(0);
  const reader = res.body.getReader();
  const parts = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BYTES) {
      await reader.cancel();
      throw new HttpError(413, 'That page is over 1MB. I stopped.');
    }
    parts.push(Buffer.from(value));
  }
  return Buffer.concat(parts);
}

function decodeBody(buf, contentType) {
  const match = /charset=([^;]+)/i.exec(contentType || '');
  let charset = match ? match[1].trim().replace(/['"]/g, '').toLowerCase() : 'utf-8';
  if (charset === 'utf8') charset = 'utf-8';
  try {
    return new TextDecoder(charset).decode(buf);
  } catch {
    return new TextDecoder('utf-8').decode(buf);
  }
}

function collapse(value) {
  return value
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function hostOf(value) {
  try {
    return new URL(value).hostname;
  } catch {
    return '';
  }
}

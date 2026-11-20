import assert from 'node:assert/strict';
import { test } from 'node:test';
import { htmlToText } from '../src/extract.js';

test('article text is kept and the title is read', () => {
  const html = `
    <html><head><title>Rivers &amp; Roads</title></head>
    <body>
      <nav><a>Home</a></nav>
      <article><p>The river is wide enough for a ferry.</p><p>Bring a coat.</p></article>
      <footer>copyright</footer>
    </body></html>`;
  const page = htmlToText(html);
  assert.equal(page.title, 'Rivers & Roads');
  assert.match(page.text, /river is wide/);
  assert.match(page.text, /Bring a coat/);
  assert.equal(page.text.includes('Home'), false);
  assert.equal(page.text.includes('copyright'), false);
});

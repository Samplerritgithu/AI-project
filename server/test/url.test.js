import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assertPublicHttpUrl } from '../src/urlcheck.js';

test('accepts a normal https url', () => {
  assert.equal(assertPublicHttpUrl('https://Example.com/a'), 'https://example.com/a');
});

test('rejects non-http schemes', () => {
  assert.throws(() => assertPublicHttpUrl('file:///c:/windows'), /http and https/);
});

test('rejects localhost and private addresses', () => {
  assert.throws(() => assertPublicHttpUrl('http://localhost:3000/x'), /local/);
  assert.throws(() => assertPublicHttpUrl('http://127.0.0.1/admin'), /private/);
  assert.throws(() => assertPublicHttpUrl('http://192.168.0.8/'), /private/);
  assert.throws(() => assertPublicHttpUrl('http://[::ffff:127.0.0.1]/'), /private/);
  assert.throws(() => assertPublicHttpUrl('http://2130706433/'), /private/);
});

test('rejects a url that is not a url', () => {
  assert.throws(() => assertPublicHttpUrl('not a url'), /doesn't look like/);
});

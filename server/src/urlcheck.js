import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { HttpError } from './errors.js';

const BLOCKED_NAMES = new Set(['localhost', '0.0.0.0', '::1', '::']);

// Checked before the connection. A DNS rebind can still win the race
// between lookup and connect; that's acceptable on a laptop.
export async function prepareFetchUrl(input) {
  const href = assertPublicHttpUrl(input);
  const host = bareHost(new URL(href).hostname);
  if (isIP(host)) return href;

  let records;
  try {
    records = await lookup(host, { all: true, verbatim: true });
  } catch {
    throw new HttpError(502, `Couldn't resolve ${host}.`);
  }
  if (!records.length) throw new HttpError(502, `Couldn't resolve ${host}.`);
  for (const record of records) {
    if (isPrivateIp(record.address)) {
      throw new HttpError(400, 'That host points at a private address.');
    }
  }
  return href;
}

export function assertPublicHttpUrl(input) {
  let url;
  try {
    url = new URL(input);
  } catch {
    throw new HttpError(400, "That doesn't look like a URL.");
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new HttpError(400, 'Only http and https links work.');
  }
  if (url.username || url.password) {
    throw new HttpError(400, 'Drop the username and password from the link.');
  }

  const host = bareHost(url.hostname);
  if (!host || BLOCKED_NAMES.has(host) || host.endsWith('.local') || host.endsWith('.localhost')) {
    throw new HttpError(400, "I won't fetch local addresses.");
  }
  if (isIP(host) && isPrivateIp(host)) {
    throw new HttpError(400, "I won't fetch private network addresses.");
  }
  return url.href;
}

function bareHost(hostname) {
  const host = hostname.toLowerCase();
  if (host.startsWith('[') && host.endsWith(']')) return host.slice(1, -1);
  return host;
}

function isPrivateIp(ip) {
  let value = bareHost(ip);
  if (value.startsWith('::ffff:')) value = ipv4FromMapped(value.slice('::ffff:'.length));

  if (value.includes(':')) {
    if (value === '::1' || value === '::') return true;
    if (value.startsWith('fe80:') || value.startsWith('fc') || value.startsWith('fd')) return true;
    return false;
  }

  const parts = value.split('.').map(part => Number(part));
  if (parts.length !== 4 || parts.some(n => !Number.isInteger(n) || n < 0 || n > 255)) return false;
  const [a, b] = parts;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}

// Node rewrites [::ffff:127.0.0.1] into hex (::ffff:7f00:1).
function ipv4FromMapped(mapped) {
  if (mapped.includes('.')) return mapped;
  const bits = mapped.split(':');
  if (bits.length !== 2) return mapped;
  const hi = Number.parseInt(bits[0], 16);
  const lo = Number.parseInt(bits[1], 16);
  if (!Number.isFinite(hi) || !Number.isFinite(lo)) return mapped;
  const n = (hi << 16) + lo;
  return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.');
}

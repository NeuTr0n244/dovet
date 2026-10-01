import { createHash } from 'node:crypto';

const BASE58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
export class AppError extends Error {
  constructor(code, message, status = 500) { super(message); this.code = code; this.status = status; }
}
export function decodeBase58(value) {
  if (typeof value !== 'string' || !value.length || value.length > 6000) throw new Error('Invalid base58');
  let n = 0n;
  for (const c of value) { const digit = BASE58.indexOf(c); if (digit < 0) throw new Error('Invalid base58'); n = n * 58n + BigInt(digit); }
  const bytes = [];
  while (n > 0n) { bytes.unshift(Number(n % 256n)); n /= 256n; }
  for (const c of value) { if (c !== '1') break; bytes.unshift(0); }
  return Buffer.from(bytes);
}
export function encodeBase58(bytes) {
  let n = BigInt('0x' + (Buffer.from(bytes).toString('hex') || '0'));
  let value = '';
  while (n > 0n) { value = BASE58[Number(n % 58n)] + value; n /= 58n; }
  for (const byte of bytes) { if (byte !== 0) break; value = '1' + value; }
  return value;
}
export function isAddress(value) {
  try { return typeof value === 'string' && value.length >= 32 && value.length <= 44 && decodeBase58(value).length === 32; } catch { return false; }
}
export function validateMint(value) {
  if (!isAddress(value)) throw new AppError('INVALID_MINT', 'Enter a Solana mint address encoded as 32 bytes of base58.', 400);
  return value;
}
export const iso = () => new Date().toISOString();
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
export function numberOrNull(value) {
  if (value === null || value === undefined || value === '' || typeof value === 'boolean') return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}
export function percentChange(current, previous) {
  return typeof current === 'number' && Number.isFinite(current) && typeof previous === 'number' && previous > 0 ? ((current - previous) / previous) * 100 : null;
}
export function safeText(value, limit = 100) { return typeof value === 'string' ? value.replace(/[\u0000-\u001f]/g, '').slice(0, limit) : null; }
export async function readBounded(stream, maxBytes = 1_000_000) {
  if (!stream) throw new Error('Empty response body');
  const reader = stream.getReader(); const chunks = []; let total = 0;
  try {
    while (true) { const { done, value } = await reader.read(); if (done) break; total += value.byteLength; if (total > maxBytes) throw new Error('Response exceeds source size limit'); chunks.push(Buffer.from(value)); }
    return Buffer.concat(chunks);
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}
export async function fetchReceipt(url, source, { fetchImpl = fetch, timeoutMs = 7000, method = 'GET', body, publicUrl = url, maxBytes = 1_000_000, signal } = {}) {
  const startedAt = iso(); const abortSignal = signal ? AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]) : AbortSignal.timeout(timeoutMs);
  let response; let bytes;
  try {
    response = await fetchImpl(url, { method, body, headers: { Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) }, redirect: 'error', signal: abortSignal });
    bytes = await readBounded(response.body, maxBytes);
    if (!response.ok) throw new Error(`Source returned HTTP ${response.status}`);
    const data = JSON.parse(bytes.toString('utf8'));
    return { data, receipt: { source, url: publicUrl, startedAt, finishedAt: iso(), status: 'ok', httpStatus: response.status, sha256: sha256(bytes), bytes: bytes.length, message: 'SHA-256 of the complete response body received by DOVET.' } };
  } catch (error) {
    const timeout = abortSignal.aborted;
    return { data: null, receipt: { source, url: publicUrl, startedAt, finishedAt: iso(), status: 'unavailable', httpStatus: response?.status ?? null, sha256: bytes ? sha256(bytes) : null, bytes: bytes?.length ?? null, message: timeout ? 'Source timed out.' : response && !response.ok ? `Source returned HTTP ${response.status}.` : 'Source response unavailable, invalid, or larger than the allowed limit.' } };
  }
}
export function taskEvent(agent, task, receipt, message = receipt.message) {
  return { agent, task, source: receipt.source, startedAt: receipt.startedAt, finishedAt: receipt.finishedAt, status: receipt.status, message };
}

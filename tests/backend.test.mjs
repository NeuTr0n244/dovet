import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { decodeBase58, encodeBase58, fetchReceipt, isAddress, numberOrNull, validateMint } from '../lib/core.js';
import { collectReport, comparePool, createInspector, diffReports, selectPair } from '../lib/market.js';
import { createStore, storageConfiguration } from '../lib/storage.js';
import { createService } from '../lib/service.js';
import { authenticateCron, jsonBody } from '../lib/http.js';
import { WATCHLIST } from '../lib/watchlist.js';
import checkHandler from '../api/check.js';

const [SOL, BONK, JUP] = WATCHLIST.map(token => token.mint);
const addr = n => encodeBase58(Buffer.alloc(32, n));
const PAIR = addr(7);
const dexPair = (overrides = {}) => ({ chainId: 'solana', pairAddress: PAIR, dexId: 'raydium', baseToken: { address: SOL, symbol: 'SOL', name: 'Wrapped SOL' }, quoteToken: { address: JUP }, priceUsd: '100', liquidity: { usd: 1000 }, volume: { h24: 200 }, ...overrides });
const normalizedPool = { address: PAIR, baseMint: SOL, quoteMint: JUP, priceUsd: 100, liquidityUsd: 1000, volume24hUsd: 200 };
const gecko = (overrides = {}) => ({ data: { id: `solana_${PAIR}`, attributes: { address: PAIR, base_token_price_usd: '101' }, relationships: { base_token: { data: { id: `solana_${SOL}` } }, quote_token: { data: { id: `solana_${JUP}` } } }, ...overrides } });
const response = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
const report = (mint, status = 'ok') => ({ schemaVersion: 1, id: `report-${mint}`, mint, observedAt: '2026-10-01T10:00:00.000Z', status, pool: status === 'unavailable' ? null : { ...normalizedPool, baseMint: mint }, receipts: [], events: [], changes: null });
const run = (overrides = {}) => ({ schemaVersion: 1, id: '2026-10-01-manual-test', day: '2026-10-01', trigger: 'manual', startedAt: '2026-10-01T09:59:00.000Z', finishedAt: '2026-10-01T10:00:00.000Z', status: 'ok', reports: WATCHLIST.map(token => report(token.mint)), ...overrides });

test('base58 validation checks decoded 32-byte length, not only a regex', () => {
  for (const mint of [SOL, BONK, JUP, '1'.repeat(32), addr(255)]) assert.equal(validateMint(mint), mint);
  for (const value of [null, {}, '', '0'.repeat(44), '1'.repeat(31), '1'.repeat(33), 'z'.repeat(44), ` ${SOL}`, 'https://example.com']) assert.equal(isAddress(value), false);
  assert.equal(decodeBase58(addr(17)).length, 32);
});
test('missing numeric values remain null while explicit zero stays zero', () => {
  for (const value of [null, undefined, '', true, NaN, Infinity, -1, 'no']) assert.equal(numberOrNull(value), null);
  assert.equal(numberOrNull('0'), 0); assert.equal(numberOrNull('3.2'), 3.2);
});
test('selection rejects quote-only pools and other chains, then uses liquidity', () => {
  const pairs = [dexPair({ liquidity: { usd: 20 } }), dexPair({ pairAddress: addr(8), liquidity: { usd: 40 } }), dexPair({ pairAddress: addr(9), baseToken: { address: JUP }, quoteToken: { address: SOL }, liquidity: { usd: 99999 } }), dexPair({ pairAddress: addr(10), chainId: 'ethereum', liquidity: { usd: 999999 } })];
  assert.equal(selectPair(pairs, SOL).pairAddress, addr(8)); assert.equal(selectPair(pairs, BONK), null);
});
test('same-pool comparison requires exact base and quote orientation', () => {
  assert.equal(comparePool(gecko(), normalizedPool).differencePct, 1);
  for (const payload of [gecko({ id: `solana_${addr(8)}` }), gecko({ relationships: { base_token: { data: { id: `solana_${JUP}` } }, quote_token: { data: { id: `solana_${SOL}` } } } })]) {
    const result = comparePool(payload, normalizedPool); assert.equal(result.status, 'mismatch'); assert.equal(result.priceUsd, null); assert.equal(result.differencePct, null);
  }
});
test('historical differences stop when the pool or quote changes', () => {
  const current = { ...report(SOL), pool: { ...normalizedPool, priceUsd: 120 } }; const previous = report(SOL);
  assert.equal(diffReports(current, previous).pricePct, 20);
  assert.equal(diffReports(current, { ...previous, pool: { ...previous.pool, address: addr(8) } }), null);
  assert.equal(diffReports(current, { ...previous, pool: { ...previous.pool, quoteMint: BONK } }), null);
  assert.equal(diffReports(current, { ...previous, pool: { ...previous.pool, priceUsd: 0 } }).pricePct, null);
});
test('a successful report records the actual response digest and task events', async () => {
  const payload = [dexPair()]; const r = await collectReport(SOL, { fetchImpl: async url => response(url.includes('dexscreener') ? payload : gecko()) });
  assert.equal(r.status, 'ok'); assert.equal(r.pool.priceUsd, 100); assert.equal(r.corroboration.status, 'matched');
  assert.equal(r.receipts[0].sha256, createHash('sha256').update(JSON.stringify(payload)).digest('hex'));
  assert.equal(r.receipts.length, 2); assert.equal(r.events.length, 4);
  assert.deepEqual(r.events.map(event => event.agent), ['Pip', 'Pip', 'Dot', 'Ink']);
  assert.ok(r.events.every(event => event.agent && event.task && event.source && Date.parse(event.startedAt) <= Date.parse(event.finishedAt)));
});
test('primary source failure never invents values or queries an arbitrary pool', async () => {
  let calls = 0; const r = await collectReport(SOL, { fetchImpl: async () => { calls++; return response({ error: 'rate limited' }, 429); } });
  assert.equal(calls, 1); assert.equal(r.status, 'unavailable'); assert.equal(r.pool, null); assert.equal(r.receipts[0].httpStatus, 429); assert.ok(r.receipts[0].sha256);
});
test('corroboration failure preserves primary observation as partial', async () => {
  const r = await collectReport(SOL, { fetchImpl: async url => url.includes('dexscreener') ? response([dexPair({ priceUsd: null, volume: {} })]) : response({}, 503) });
  assert.equal(r.status, 'partial'); assert.equal(r.pool.priceUsd, null); assert.equal(r.pool.volume24hUsd, null); assert.equal(r.corroboration.priceUsd, null);
});
test('missing primary metrics remain partial even with a matched source price', async () => {
  const r = await collectReport(SOL, { fetchImpl: async url => response(url.includes('dexscreener') ? [dexPair({ liquidity: {}, volume: {} })] : gecko()) });
  assert.equal(r.corroboration.status, 'matched'); assert.equal(r.status, 'partial'); assert.equal(r.pool.liquidityUsd, null);
});
test('unsupported primary response is distinct from an empty eligible-pool list', async () => {
  const unsupported = await collectReport(SOL, { fetchImpl: async () => response({ unexpected: [] }) });
  assert.equal(unsupported.receipts[0].status, 'unavailable'); assert.match(unsupported.receipts[0].message, /schema/);
  const empty = await collectReport(SOL, { fetchImpl: async () => response([]) });
  assert.equal(empty.receipts[0].status, 'ok'); assert.match(empty.events[1].message, /no eligible/); assert.equal(empty.events[2].status, 'skipped');
});
test('oversized source bodies are discarded and malformed JSON is unavailable', async () => {
  const large = await fetchReceipt('https://source.test', 'test', { maxBytes: 20, fetchImpl: async () => new Response('x'.repeat(100)) });
  assert.equal(large.receipt.status, 'unavailable'); assert.equal(large.receipt.sha256, null);
  const malformed = await fetchReceipt('https://source.test', 'test', { fetchImpl: async () => new Response('{bad') });
  assert.equal(malformed.data, null); assert.ok(malformed.receipt.sha256);
});
test('60-second cache coalesces concurrent calls and expires without mutating reports', async () => {
  let calls = 0; let time = 0; let release;
  const inspect = createInspector({ now: () => time, collect: async mint => { calls++; await new Promise(resolve => { release = resolve; }); return report(mint); } });
  const a = inspect(SOL); const b = inspect(SOL); await Promise.resolve(); release(); const [one, two] = await Promise.all([a, b]);
  assert.equal(calls, 1); assert.equal(one.cached, false); assert.equal(two.cached, true);
  one.report.status = 'changed'; assert.equal((await inspect(SOL)).report.status, 'ok');
  time = 60_001; const c = inspect(SOL); await Promise.resolve(); release(); await c; assert.equal(calls, 2);
});
test('warm instance concurrency is bounded', async () => {
  let release; const inspect = createInspector({ maxPending: 1, collect: async mint => { await new Promise(resolve => { release = resolve; }); return report(mint); } });
  const pending = inspect(SOL); await Promise.resolve(); await assert.rejects(inspect(JUP), error => error.status === 429); release(); await pending;
});
test('local archive is idempotent and corrupt data is never overwritten', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'dovet-test-')); t.after(() => rm(directory, { recursive: true, force: true }));
  const path = join(directory, 'local-runs.json'); const store = createStore({ env: {}, path });
  const first = await store.putRun(run()); const second = await store.putRun(run({ id: 'replacement' }));
  assert.equal(first.reused, false); assert.equal(second.reused, true); assert.equal(second.run.id, first.run.id); assert.equal((await store.readRuns()).length, 1);
  await writeFile(path, '{broken'); await assert.rejects(store.putRun(run()), error => error.code === 'STORAGE_READ_FAILED'); assert.equal(await readFile(path, 'utf8'), '{broken');
});
test('fully unavailable attempts are retained and a later successful attempt can recover', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'dovet-failure-')); t.after(() => rm(directory, { recursive: true, force: true }));
  const store = createStore({ env: {}, path: join(directory, 'history.json') });
  await store.putRun(run({ id: 'failed', status: 'unavailable', reports: WATCHLIST.map(token => report(token.mint, 'unavailable')) }));
  assert.equal(await store.findDay('2026-10-01', 'manual'), null);
  await store.putRun(run()); assert.equal((await store.readRuns()).length, 2);
});
test('hosted storage cannot silently fall back to local or memory history', async () => {
  assert.equal(storageConfiguration({ VERCEL: '1' }).configured, false);
  const store = createStore({ env: { VERCEL: '1' } }); await assert.rejects(store.readRuns(), error => error.code === 'STORAGE_UNCONFIGURED');
});
test('blob writes are public, immutable, deterministic and race-safe', async () => {
  const docs = new Map(); const puts = [];
  const sdk = {
    async get(path) { const text = docs.get(path); return text ? { statusCode: 200, stream: new Response(text).body, blob: { url: `https://example.public.blob.vercel-storage.com/${path}` } } : null; },
    async put(path, text, options) { puts.push(options); if (docs.has(path)) throw new Error('exists'); docs.set(path, text); return { url: `https://example.public.blob.vercel-storage.com/${path}` }; },
    async list() { return { blobs: [...docs.keys()].map(pathname => ({ pathname })) }; },
  };
  const store = createStore({ env: { BLOB_READ_WRITE_TOKEN: 'test-only-placeholder' }, sdkLoader: async () => sdk });
  await store.putRun(run()); const result = await store.putRun(run({ id: 'racing-writer' }));
  assert.equal(result.reused, true); assert.equal(result.run.id, run().id); assert.equal(docs.size, 1);
  assert.equal(puts[0].allowOverwrite, false); assert.equal(puts[0].addRandomSuffix, false); assert.equal(puts[0].access, 'public');
});
test('daily service persists partial reports, coalesces runs, and separates manual from cron', async () => {
  const runs = []; let calls = 0;
  const store = { configuration: { configured: true, durable: true }, readRuns: async () => [...runs], findDay: async (day, trigger) => runs.find(r => r.day === day && r.trigger === trigger) ?? null, putRun: async r => { runs.unshift(r); return { run: r, reused: false }; } };
  const service = createService({ env: { VERCEL: '1', CRON_SECRET: 'test-secret' }, store, now: () => '2026-10-01T10:00:00.000Z', collect: async mint => { calls++; return report(mint, mint === BONK ? 'unavailable' : 'ok'); }, discover: async () => ({ status: 'disabled', candidate: null }) });
  const [a, b] = await Promise.all([service.runDaily(), service.runDaily()]); assert.equal(a.run.id, b.run.id); assert.equal(calls, 3); assert.equal(a.run.status, 'partial');
  let status = await service.status(); assert.equal(status.schedule.lastObservedCron, null); assert.ok(status.schedule.lastManualRun);
  const again = await service.runDaily(); assert.equal(again.reused, true); assert.equal(calls, 3);
  await service.runDaily({ trigger: 'scheduled' }); status = await service.status(); assert.ok(status.schedule.lastObservedCron); assert.equal(runs.length, 2);
});
test('cron requires a secret and classifies authenticated manual requests truthfully', () => {
  const env = { CRON_SECRET: 'test-secret' };
  assert.throws(() => authenticateCron({ headers: {} }, env), error => error.status === 401);
  assert.equal(authenticateCron({ headers: { authorization: 'Bearer test-secret' } }, env), 'manual');
  assert.equal(authenticateCron({ headers: { authorization: 'Bearer test-secret', 'user-agent': 'vercel-cron/1.0' } }, env), 'scheduled');
});
test('check API rejects URLs before any source request and disallows GET', async () => {
  function res() { return { headers: {}, setHeader(key, value) { this.headers[key] = value; }, end(text) { this.json = JSON.parse(text); } }; }
  const invalid = res(); await checkHandler({ method: 'POST', headers: {}, body: { mint: 'https://localhost/private' } }, invalid); assert.equal(invalid.statusCode, 400); assert.equal(invalid.json.error.code, 'INVALID_MINT');
  const wrong = res(); await checkHandler({ method: 'GET', headers: {} }, wrong); assert.equal(wrong.statusCode, 405);
});
test('check body rejects unrecognized fields, oversized bodies and invalid JSON', async () => {
  await assert.rejects(jsonBody({ headers: {}, body: { mint: SOL, url: 'https://example.com' } }), error => error.status === 400);
  await assert.rejects(jsonBody({ headers: {}, body: 'x'.repeat(2049) }), error => error.status === 413);
  await assert.rejects(jsonBody({ headers: {}, body: '{invalid' }), error => error.status === 400);
});

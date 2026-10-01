import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// Run from any directory: node scripts/verify-live.mjs [https://your-deployment]
// Only the authenticated manual cron call can write; an existing daily run is reused.
const project = new URL('../', import.meta.url);
try { process.loadEnvFile(fileURLToPath(new URL('.env.local', project))); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const base = new URL(process.argv[2] || process.env.DOVET_URL || 'https://dovet-ten.vercel.app');
if (base.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(base.hostname)) throw new Error('Use an HTTPS deployment URL.');
const startedAt = new Date().toISOString(); const results = []; const publicData = {};
const mint = 'So11111111111111111111111111111111111111112';
const secret = process.env.CRON_SECRET;
const redact = text => secret ? String(text).split(secret).join('[REDACTED]') : String(text);

async function request(path, options = {}) {
  const response = await fetch(new URL(path, base), { redirect: 'manual', signal: AbortSignal.timeout(30_000), ...options, headers: { 'User-Agent': 'DOVET-verify-live/1.0 (manual verification)', ...options.headers } });
  const bytes = Buffer.from(await response.arrayBuffer());
  let body = null;
  if (response.headers.get('content-type')?.includes('application/json')) { try { body = JSON.parse(bytes.toString('utf8')); } catch { /* Assertion below reports an invalid JSON response. */ } }
  return { status: response.status, type: response.headers.get('content-type'), allow: response.headers.get('allow'), bytes: bytes.length, text: bytes.toString('utf8'), body };
}
async function check(name, action) {
  const began = Date.now();
  try { const detail = await action(); results.push({ name, status: 'passed', durationMs: Date.now() - began, detail }); }
  catch (error) { results.push({ name, status: 'failed', durationMs: Date.now() - began, message: redact(error.message) }); }
}
const post = body => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const pages = new Map();
await Promise.allSettled([
  ...['/', '/field-notes', '/archive'].map(path => check(`Page ${path}`, async () => {
    const result = await request(path); assert.equal(result.status, 200); assert.match(result.type || '', /text\/html/); assert.match(result.text, /DOVET/); pages.set(path, result.text); return { status: result.status, bytes: result.bytes };
  })),
  check('Status: durable storage and honest cron state', async () => {
    const result = await request('/api/status'); assert.equal(result.status, 200); assert.equal(result.body?.ok, true); assert.equal(result.body.storage.mode, 'vercel-blob'); assert.equal(result.body.storage.configured, true); assert.equal(result.body.storage.durable, true); assert.equal(result.body.storage.error, null);
    assert.equal(result.body.schedule.configured, true); assert.equal(result.body.schedule.expression, '17 3 * * *'); assert.equal(result.body.schedule.timezone, 'UTC');
    if (result.body.schedule.lastObservedCron !== null) { assert.ok(Number.isFinite(Date.parse(result.body.schedule.lastObservedCron))); assert.ok(result.body.schedule.lastCronRun?.id); }
    publicData.status = result.body; return { storage: result.body.storage.mode, cronConfigured: true, lastObservedCron: result.body.schedule.lastObservedCron, lastManualRun: result.body.schedule.lastManualRun };
  }),
  check('Feed: real fixed watchlist and immutable public history', async () => {
    const result = await request('/api/feed'); assert.equal(result.status, 200); assert.equal(result.body?.watchlist.length, 3); assert.ok(result.body.runs.length > 0); assert.equal(result.body.latestRun.id, result.body.runs[0].id);
    for (const run of result.body.runs) { assert.equal(run.reports.length, 3); assert.ok(['manual', 'scheduled'].includes(run.trigger)); assert.ok(Number.isFinite(Date.parse(run.finishedAt))); if (run.archiveUrl) assert.match(new URL(run.archiveUrl).hostname, /\.public\.blob\.vercel-storage\.com$/); }
    publicData.feed = result.body; return { latestRunId: result.body.latestRun.id, runCount: result.body.runs.length, storage: result.body.storage.mode };
  }),
  check('Token: CA soon with no borrowed wallet or token', async () => {
    const result = await request('/api/token'); assert.equal(result.status, 200); assert.equal(result.body?.status, 'soon'); assert.equal(result.body.mint, null); assert.equal(result.body.source, null); assert.equal(result.body.verifiedLaunch, false); assert.equal(result.body.discovery.enabled, false); publicData.token = result.body; return result.body;
  }),
  ...['invalid-address', 'https://127.0.0.1/private', '1'.repeat(31)].map(value => check(`Invalid mint rejected: ${value}`, async () => {
    const result = await request('/api/check', post({ mint: value })); assert.equal(result.status, 400); assert.equal(result.body?.error.code, 'INVALID_MINT'); return { status: result.status, code: result.body.error.code };
  })),
  check('Check endpoint rejects GET', async () => { const result = await request('/api/check'); assert.equal(result.status, 405); assert.equal(result.allow, 'POST'); return { status: result.status, allow: result.allow }; }),
  check('Unauthenticated cron rejected', async () => { const result = await request('/api/cron'); assert.equal(result.status, 401); assert.equal(result.body?.error.code, 'UNAUTHORIZED'); return { status: result.status, code: result.body.error.code }; }),
  check('Live known-mint observation with source receipts and current agents', async () => {
    const result = await request('/api/check', post({ mint })); assert.equal(result.status, 200); const report = result.body?.report; assert.equal(report?.mint, mint); assert.ok(['ok', 'partial', 'unavailable'].includes(report.status));
    assert.ok(Number.isFinite(Date.parse(report.observedAt))); assert.ok(Math.abs(Date.now() - Date.parse(report.observedAt)) < 5 * 60_000); assert.ok(report.receipts.length >= 1);
    for (const receipt of report.receipts) { assert.ok(['DexScreener', 'GeckoTerminal'].includes(receipt.source)); assert.match(new URL(receipt.url).hostname, /^(api\.dexscreener\.com|api\.geckoterminal\.com)$/); assert.ok(Date.parse(receipt.finishedAt) >= Date.parse(receipt.startedAt)); if (receipt.sha256 !== null) assert.match(receipt.sha256, /^[a-f0-9]{64}$/); }
    const agents = new Set(report.events.map(event => event.agent)); for (const agent of ['Pip', 'Dot', 'Ink']) assert.ok(agents.has(agent), `Missing ${agent} event; deployment may need refreshing.`);
    assert.ok(report.events.some(event => event.agent === 'Ink' && event.task === 'Assemble observation report'));
    if (report.pool) { assert.equal(report.pool.baseMint, mint); for (const key of ['priceUsd', 'liquidityUsd', 'volume24hUsd']) assert.ok(report.pool[key] === null || (Number.isFinite(report.pool[key]) && report.pool[key] >= 0)); }
    if (report.corroboration.status === 'matched') assert.equal(report.corroboration.poolAddress, report.pool.address);
    if (report.status === 'ok') { assert.ok(report.pool); assert.equal(report.corroboration.status, 'matched'); for (const key of ['priceUsd', 'liquidityUsd', 'volume24hUsd']) assert.notEqual(report.pool[key], null); }
    publicData.observation = result.body; return { reportId: report.id, status: report.status, cached: result.body.cached, pool: report.pool?.address ?? null, sourceCount: report.receipts.length, agents: [...agents] };
  }),
]);

const assetPaths = new Set(['/assets/dovet-bird.png', '/assets/social-preview.png']);
for (const html of pages.values()) for (const match of html.matchAll(/(?:src|href)="(\/assets\/[^"?#]+)(?:[?#][^"]*)?"/g)) assetPaths.add(match[1]);
await Promise.allSettled([...assetPaths].map(path => check(`Asset ${path}`, async () => {
  const result = await request(path); assert.equal(result.status, 200); assert.ok(result.bytes > 0); assert.doesNotMatch(result.type || '', /text\/html/);
  if (path.endsWith('.png')) assert.match(result.type || '', /image\/png/);
  return { status: result.status, contentType: result.type, bytes: result.bytes };
})));

await check('Authenticated MANUAL cron reuses the durable daily report', async () => {
  assert.ok(secret, 'CRON_SECRET is required in this project environment for the manual collector check.');
  const previous = publicData.feed?.runs.find(run => run.trigger === 'manual' && run.day === new Date().toISOString().slice(0, 10) && run.status !== 'unavailable');
  const result = await request('/api/cron', { headers: { Authorization: `Bearer ${secret}` } });
  assert.equal(result.status, 200); assert.equal(result.body?.run.trigger, 'manual'); assert.equal(result.body.reused, true); assert.ok(previous, 'No successful manual report existed for this UTC day.'); assert.equal(result.body.run.id, previous.id);
  publicData.manualCron = result.body; return { id: result.body.run.id, trigger: result.body.run.trigger, reused: result.body.reused, status: result.body.run.status };
});
await check('Manual QA did not fabricate an observed automatic run', async () => {
  const result = await request('/api/status'); assert.equal(result.status, 200);
  const before = publicData.status?.schedule.lastObservedCron; const after = result.body.schedule.lastObservedCron;
  if (before !== after) { assert.ok(result.body.schedule.lastCronRun); assert.ok(publicData.manualCron?.run.id !== result.body.schedule.lastCronRun.id); }
  publicData.finalStatus = result.body; return { before: before ?? null, after, automaticRunObserved: after !== null, manualRunId: publicData.manualCron?.run.id ?? null };
});

const output = { deployment: base.origin, startedAt, finishedAt: new Date().toISOString(), passed: results.every(result => result.status === 'passed'), totals: { passed: results.filter(result => result.status === 'passed').length, failed: results.filter(result => result.status === 'failed').length }, results, publicData };
const directory = new URL('output/', project); await mkdir(directory, { recursive: true });
const destination = new URL('production-api-qa.json', directory); await writeFile(destination, redact(JSON.stringify(output, null, 2)), 'utf8');
console.log(JSON.stringify({ deployment: output.deployment, ...output.totals, automaticRunObserved: publicData.finalStatus?.schedule.lastObservedCron !== null && publicData.finalStatus?.schedule.lastObservedCron !== undefined, report: fileURLToPath(destination), failures: results.filter(result => result.status === 'failed').map(({ name, message }) => ({ name, message })) }, null, 2));
if (!output.passed) process.exitCode = 1;

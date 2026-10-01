import { randomUUID } from 'node:crypto';
import { AppError, iso } from './core.js';
import { collectReport, createInspector } from './market.js';
import { createStore } from './storage.js';
import { discoverToken, tokenStatus } from './token.js';
import { WATCHLIST } from './watchlist.js';

export function createService({ env = process.env, store = createStore({ env }), collect = collectReport, discover = discoverToken, now = iso } = {}) {
  const inspect = createInspector({ collect });
  let feedCache = null; let feedPending = null; const runsPending = new Map();
  async function readRuns() {
    if (feedCache && Date.now() - feedCache.time < 30_000) return feedCache.runs;
    if (!feedPending) feedPending = store.readRuns(14).then(runs => { feedCache = { runs, time: Date.now() }; return runs; }).finally(() => { feedPending = null; });
    return feedPending;
  }
  async function feed() {
    const runs = await readRuns();
    return { schemaVersion: 1, watchlist: WATCHLIST, latestRun: runs[0] ?? null, previousRun: runs[1] ?? null, runs, storage: store.configuration, historyScope: 'Server archive of the fixed daily watchlist. Custom inspections are not stored on this server.' };
  }
  async function token() {
    if (env.TOKEN_MINT || !env.DEV_WALLET) return tokenStatus(env);
    const runs = await readRuns();
    return tokenStatus(env, runs.find(run => run.discovery)?.discovery ?? null);
  }
  return {
    inspect, feed, token,
    async status() {
      let runs = []; let storageError = null;
      try { runs = await readRuns(); } catch (error) { storageError = error.code || 'STORAGE_READ_FAILED'; }
      const scheduled = runs.find(run => run.trigger === 'scheduled');
      const manual = runs.find(run => run.trigger === 'manual');
      const state = tokenStatus(env, runs.find(run => run.discovery)?.discovery);
      return { ok: !storageError, observedAt: now(), storage: { ...store.configuration, error: storageError }, schedule: { expression: '17 3 * * *', timezone: 'UTC', configured: Boolean(env.CRON_SECRET && env.VERCEL), lastObservedCron: scheduled?.finishedAt ?? null, lastManualRun: manual?.finishedAt ?? null, lastCronRun: scheduled ? { id: scheduled.id, status: scheduled.status, startedAt: scheduled.startedAt, finishedAt: scheduled.finishedAt } : null, note: 'A configured schedule is not proof of an automatic run. Vercel daily cron timing can vary within the scheduled hour. Only authenticated requests marked vercel-cron are classified as scheduled.' }, sources: [{ name: 'DexScreener', url: 'https://docs.dexscreener.com/api/reference', role: 'Token pools; highest reported liquidity base-token pool selected.' }, { name: 'GeckoTerminal', url: 'https://www.geckoterminal.com/dex-api', role: 'Independent observation of exactly the same pool, when available.' }], tokenDiscovery: state.discovery, cache: { observationTtlSeconds: 60, scope: 'Warm server instance; concurrent requests for the same mint are coalesced.' } };
    },
    async runDaily({ trigger = 'manual' } = {}) {
      if (!['manual', 'scheduled'].includes(trigger)) throw new AppError('INVALID_TRIGGER', 'Unknown collector trigger.', 400);
      if (!store.configuration.configured) throw new AppError('STORAGE_UNCONFIGURED', 'Configure durable Blob storage before collecting hosted history.', 503);
      const startedAt = now(); const day = startedAt.slice(0, 10); const key = `${trigger}:${day}`;
      if (runsPending.has(key)) return runsPending.get(key);
      const task = (async () => {
        const existing = await store.findDay(day, trigger);
        if (existing) return { run: existing, reused: true, storage: store.configuration };
        const history = await readRuns();
        const reportJobs = WATCHLIST.map(async token => {
          const previous = history.flatMap(run => run.reports).find(report => report.mint === token.mint && report.pool);
          try { return await collect(token.mint, { previous }); }
          catch {
            const finishedAt = now();
            return { schemaVersion: 1, id: randomUUID(), mint: token.mint, startedAt, observedAt: finishedAt, status: 'unavailable', token: { name: token.name, symbol: token.symbol }, pool: null, corroboration: { status: 'not_checked', poolAddress: null, priceUsd: null, differencePct: null, message: 'Collector did not finish this observation.' }, changes: null, receipts: [], events: [{ agent: 'Pip', task: 'Read token pools', source: 'DexScreener', startedAt, finishedAt, status: 'unavailable', message: 'Collector did not finish this observation.' }, { agent: 'Ink', task: 'Assemble unavailable report', source: 'DOVET', startedAt: finishedAt, finishedAt, status: 'ok', message: 'Recorded the failed collection as an unavailable report. No source values were inferred.' }], limitations: ['Source data is unavailable. No values were inferred.'] };
          }
        });
        const discoveryJob = discover({ env, previous: history.find(run => run.discovery)?.discovery });
        const [reports, discovery] = await Promise.all([Promise.all(reportJobs), discoveryJob]);
        const status = reports.every(report => report.status === 'ok') ? 'ok' : reports.every(report => report.status === 'unavailable') ? 'unavailable' : 'partial';
        const run = { schemaVersion: 1, id: `${day}-${trigger}-${randomUUID()}`, day, trigger, startedAt, finishedAt: now(), status, reports, discovery };
        const result = await store.putRun(run); feedCache = null;
        return { ...result, storage: store.configuration };
      })().finally(() => runsPending.delete(key));
      runsPending.set(key, task); return task;
    },
  };
}
let singleton;
export function getService() { return singleton ??= createService(); }

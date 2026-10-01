import { randomUUID } from 'node:crypto';
import { AppError, fetchReceipt, iso, isAddress, numberOrNull, percentChange, safeText, taskEvent, validateMint } from './core.js';
import { WATCHLIST } from './watchlist.js';

export function selectPair(pairs, mint) {
  if (!Array.isArray(pairs)) return null;
  const seen = new Set();
  return pairs.slice(0, 1000).filter(pair => {
    if (pair?.chainId !== 'solana' || pair.baseToken?.address !== mint || !isAddress(pair.pairAddress) || !isAddress(pair.quoteToken?.address) || seen.has(pair.pairAddress)) return false;
    seen.add(pair.pairAddress); return true;
  }).sort((a, b) => (numberOrNull(b.liquidity?.usd) ?? -1) - (numberOrNull(a.liquidity?.usd) ?? -1) || a.pairAddress.localeCompare(b.pairAddress))[0] ?? null;
}
export function comparePool(data, pool) {
  const entry = data?.data; const attrs = entry?.attributes;
  const exact = entry?.id === `solana_${pool.address}` && attrs?.address === pool.address;
  const base = entry?.relationships?.base_token?.data?.id;
  const quote = entry?.relationships?.quote_token?.data?.id;
  if (typeof entry?.id !== 'string' || typeof attrs?.address !== 'string' || typeof base !== 'string' || typeof quote !== 'string') {
    return { status: 'unavailable', poolAddress: null, priceUsd: null, differencePct: null, message: 'GeckoTerminal returned an unsupported pool response schema. No numerical comparison was made.' };
  }
  if (!exact || base !== `solana_${pool.baseMint}` || quote !== `solana_${pool.quoteMint}`) {
    return { status: 'mismatch', poolAddress: attrs?.address ?? null, priceUsd: null, differencePct: null, message: 'The pool or token orientation does not match. No numerical comparison was made.' };
  }
  const priceUsd = numberOrNull(attrs.base_token_price_usd);
  return { status: priceUsd === null ? 'unavailable' : 'matched', poolAddress: pool.address, priceUsd, differencePct: percentChange(priceUsd, pool.priceUsd), message: priceUsd === null ? 'The same pool was returned without a usable USD price.' : 'Both sources identify the same pool and token orientation. This is a source comparison, not a safety assessment.' };
}
export function diffReports(report, previous) {
  if (!report.pool || !previous?.pool || report.mint !== previous.mint || report.pool.address !== previous.pool.address || report.pool.baseMint !== previous.pool.baseMint || report.pool.quoteMint !== previous.pool.quoteMint) return null;
  return { previousObservedAt: previous.observedAt, pricePct: percentChange(report.pool.priceUsd, previous.pool.priceUsd), liquidityPct: percentChange(report.pool.liquidityUsd, previous.pool.liquidityUsd), volume24hPct: percentChange(report.pool.volume24hUsd, previous.pool.volume24hUsd) };
}
export async function collectReport(mint, { fetchImpl = fetch, timeoutMs = 7000, previous = null, signal } = {}) {
  validateMint(mint);
  const startedAt = iso(); const options = { fetchImpl, timeoutMs, signal };
  const dexUrl = `https://api.dexscreener.com/token-pairs/v1/solana/${mint}`;
  const dex = await fetchReceipt(dexUrl, 'DexScreener', options);
  if (dex.data !== null && !Array.isArray(dex.data)) {
    dex.data = null;
    dex.receipt = { ...dex.receipt, status: 'unavailable', message: 'DexScreener returned an unsupported response schema; a token-pool array was expected.' };
  }
  const receipts = [dex.receipt]; const events = [taskEvent('Pip', 'Read token pools', dex.receipt)];
  const pair = selectPair(dex.data, mint);
  const known = WATCHLIST.find(token => token.mint === mint);
  const token = { name: safeText(pair?.baseToken?.name) ?? known?.name ?? null, symbol: safeText(pair?.baseToken?.symbol, 20) ?? known?.symbol ?? null };
  const pool = pair ? {
    address: pair.pairAddress, dex: safeText(pair.dexId, 50), url: `https://dexscreener.com/solana/${pair.pairAddress}`,
    baseMint: mint, quoteMint: pair.quoteToken.address,
    priceUsd: numberOrNull(pair.priceUsd), liquidityUsd: numberOrNull(pair.liquidity?.usd), volume24hUsd: numberOrNull(pair.volume?.h24),
    transactions24h: { buys: numberOrNull(pair.txns?.h24?.buys), sells: numberOrNull(pair.txns?.h24?.sells) },
  } : null;
  let corroboration = { status: 'not_checked', poolAddress: null, priceUsd: null, differencePct: null, message: 'No eligible base-token pool was available for comparison.' };
  const limitations = ['Public sources can lag and disagree. Observation times are retrieval times, not guaranteed market update times.', 'Liquidity and rolling 24-hour volume refer to one selected pool, not all markets.', 'Response hashes identify received bytes; they do not authenticate the source or prove token safety.'];
  const selectionFinished = iso();
  events.push({ agent: 'Pip', task: 'Select highest reported liquidity pool', source: 'DexScreener', startedAt: dex.receipt.finishedAt, finishedAt: selectionFinished, status: pool ? 'ok' : 'unavailable', message: pool ? `Selected ${pool.address} with the requested mint as the base token.` : dex.receipt.status !== 'ok' ? 'Pool selection could not run because the source response was unavailable or unsupported.' : 'The source returned no eligible Solana pool with this mint as its base token.' });
  if (pool) {
    const geckoUrl = `https://api.geckoterminal.com/api/v2/networks/solana/pools/${pool.address}`;
    const gecko = await fetchReceipt(geckoUrl, 'GeckoTerminal', options); receipts.push(gecko.receipt);
    corroboration = gecko.data ? comparePool(gecko.data, pool) : { status: 'unavailable', poolAddress: pool.address, priceUsd: null, differencePct: null, message: 'GeckoTerminal did not return a usable response for this pool.' };
    events.push({ ...taskEvent('Dot', 'Compare the same pool', gecko.receipt, corroboration.message), status: corroboration.status === 'matched' ? 'ok' : corroboration.status });
    if (corroboration.status !== 'matched') limitations.push('An independent same-pool price comparison is unavailable for this observation.');
  } else {
    limitations.push('No price, liquidity, or volume has been inferred from missing source data.');
    events.push({ agent: 'Dot', task: 'Compare the same pool', source: 'GeckoTerminal', startedAt: selectionFinished, finishedAt: iso(), status: 'skipped', message: 'No eligible primary pool was available; the comparison request was not made.' });
  }
  const assemblyStartedAt = iso();
  const completeMetrics = pool && ['priceUsd', 'liquidityUsd', 'volume24hUsd'].every(key => pool[key] !== null);
  if (pool && !completeMetrics) limitations.push('One or more primary price, liquidity or volume fields were missing. The observation is partial.');
  const report = { schemaVersion: 1, id: randomUUID(), mint, startedAt, observedAt: iso(), status: !pool ? 'unavailable' : corroboration.status === 'matched' && completeMetrics ? 'ok' : 'partial', token, pool, corroboration, changes: null, receipts, events, limitations };
  report.changes = diffReports(report, previous);
  if (previous && !report.changes) report.limitations.push('The previous observation is absent or uses a different pool; no historical percentage change was computed.');
  events.push({ agent: 'Ink', task: 'Assemble observation report', source: 'DOVET', startedAt: assemblyStartedAt, finishedAt: iso(), status: 'ok', message: `Assembled report ${report.id} with ${receipts.length} source receipts and explicit data gaps. This event records report creation, not archive persistence.` });
  return report;
}
export function createInspector({ collect = collectReport, ttlMs = 60_000, maxEntries = 100, maxPending = 6, now = Date.now } = {}) {
  const cache = new Map(); const pending = new Map();
  return async mint => {
    validateMint(mint);
    const prior = cache.get(mint);
    if (prior && now() - prior.time < ttlMs) return { report: structuredClone(prior.report), cached: true };
    if (pending.has(mint)) return { report: structuredClone(await pending.get(mint)), cached: true };
    if (pending.size >= maxPending) throw new AppError('BUSY', 'The observation queue is busy. Retry shortly.', 429);
    const work = Promise.resolve().then(() => collect(mint)).then(report => {
      if (cache.size >= maxEntries) cache.delete(cache.keys().next().value);
      cache.set(mint, { report, time: now() }); return report;
    }).finally(() => pending.delete(mint));
    pending.set(mint, work); return { report: structuredClone(await work), cached: false };
  };
}

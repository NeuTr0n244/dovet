# DOVET API contract

Node ESM default `(req, res)` handlers. No wallet signing or transactions. Error responses are `{error:{code,message}}`. API responses are `no-store`; the server shares observations for 60 seconds in a bounded warm-instance cache.

## POST /api/check

JSON body `{ "mint": "<32-byte Solana base58 address>" }`; maximum 2 KB; additional fields are rejected. Response `{report,cached}`. No custom observation is added to the server archive. A report returned from source failure remains a usable report with `status: "unavailable"`, null metrics, and evidence of failure.

Report fields:

```text
schemaVersion: 1
id: UUID
mint: string
startedAt, observedAt: ISO UTC timestamps
status: ok | partial | unavailable
token: {name: string|null, symbol: string|null}
pool: null | {address, dex, url, baseMint, quoteMint,
             priceUsd: number|null, liquidityUsd: number|null,
             volume24hUsd: number|null,
             transactions24h: {buys: number|null, sells: number|null}}
corroboration: {status: matched|unavailable|mismatch|not_checked,
                poolAddress: string|null, priceUsd: number|null,
                differencePct: number|null, message: string}
changes: null | {previousObservedAt, pricePct, liquidityPct, volume24hPct}
receipts: [{source,url,startedAt,finishedAt,status,httpStatus,sha256,bytes,message}]
events: [{agent,task,source,startedAt,finishedAt,status,message}]
limitations: string[]
```

All missing metrics are null. Explicit source zero remains zero. Same-pool price difference is `(GeckoTerminal - DexScreener) / DexScreener * 100`, and is null for a missing/zero denominator. Historical differences use the previous observation of exactly the same pool, base and quote. They compare successive snapshots, not trading performance. `observedAt` is retrieval time; providers do not guarantee a per-quote update timestamp.

Pip retrieves and selects the pool, Dot compares that pool, Ink assembles the report. Ink's completion confirms report construction, not persistence. Earlier immutable archive reports can retain the original internal agent labels. `matched` does not mean a token is safe or verified.

## GET /api/feed

`{schemaVersion:1, watchlist, latestRun, previousRun, runs, storage, historyScope}`. Runs are newest first, currently limited to 14. An empty archive has null latest/previous and an empty array. Configuration/read errors return HTTP 503; no in-memory or placeholder history is substituted on Vercel.

A run is `{schemaVersion:1,id,day,trigger,startedAt,finishedAt,status,reports,discovery,archiveUrl?}`. Trigger is `manual` or `scheduled`. `archiveUrl` is the public immutable Blob URL. Local development reports have no Blob URL.

Storage is `{mode:"vercel-blob"|"local-file"|"unconfigured",configured,durable,publicReports,message}`. Only vercel-blob is durable hosted history. Custom browser history is independent.

## GET /api/status

`{ok,observedAt,storage,schedule,sources,tokenDiscovery,cache}`. Status storage additionally has `error: string|null`. Schedule is `{expression:"17 3 * * *",timezone:"UTC",configured,lastObservedCron,lastManualRun,lastCronRun,note}`. Last-observed fields are ISO timestamps or null within the returned archive window. `lastCronRun` is null or `{id,status,startedAt,finishedAt}`. Configured is distinct from an observed authenticated Vercel cron invocation.

## GET /api/cron

Requires `Authorization: Bearer CRON_SECRET`. Authenticated requests with `User-Agent: vercel-cron/1.0` are classified as scheduled; other authorized requests are manual. The credential holder can invoke the endpoint manually, so classification is operational evidence, not cryptographic attestation by Vercel. Return `{run,reused,storage}`.

Manual and scheduled jobs have separate immutable daily keys. First successful or partial write wins, with `allowOverwrite:false`. An entirely unavailable attempt is stored under a unique failure path so it can be retried without replacing prior evidence. No deletes or overwrites occur. New daily reports are written even when individual sources fail. Historical successful values are preserved in the archive and never silently substituted for a failed fresh observation.

## GET /api/token

`{status:"configured"|"soon",mint:string|null,source:"manual"|"verified_creation"|null,verifiedLaunch,explorer,proof?,discovery}`. Manual TOKEN_MINT always takes precedence, including fail-closed behavior for an invalid configured address. Configured is distinct from a verified creation.

Without DEV_WALLET, discovery is disabled. Discovery requires exact configured name, symbol, metadata URI, start slot and HTTPS mainnet RPC. On daily collection it verifies finalized Pump create/create_v2 instructions, developer signer/user/creator, exact metadata, token mint initialization and finalized initialized mint state. It never selects received tokens. A bounded complete history window is required; busy wallets can supply TOKEN_LAUNCH_SIGNATURE for a specific receipt. Multiple matching mints fail closed and require explicit TOKEN_MINT. Existing proof is pinned only while the configured identity fingerprint matches. RPC URLs are never exposed in receipts.

## Local collection

`node --env-file=.env.local scripts/collect.mjs` uses configured Blob storage. `npm run collect` uses environment variables already present; otherwise the explicitly local development fallback is `data/local-runs.json`. The CLI always marks the run manual. With VERCEL set and no Blob credential, persistence fails rather than silently switching storage.

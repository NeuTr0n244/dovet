# DOVET

A small evidence post for Solana market observations. Paste a token mint to read an indexed market, compare the same pool with a second provider when available, and keep a timestamped JSON receipt.

- Local workspace: http://localhost:3197
- Source repository: https://github.com/NeuTr0n244/dovet
- Public deployment: https://dovet-ten.vercel.app
- Official X: https://x.com/DovetSol
- Contract address: **CA: soon**. No project developer wallet or confirmed mint has been supplied.

## Run locally

Use a current Node.js runtime that supports `process.loadEnvFile`, `AbortSignal.any` and the installed Vite version.

```sh
npm ci
npm run dev
```

The development server binds to `127.0.0.1:3197`, serves Vite and the real `/api/*` handlers from one origin, and optionally loads `.env.local`. Override the port with `PORT`.

```sh
npm test
npm run build
npm run collect
```

`collect` performs one manual server observation of the fixed watchlist and persists it. It is not a scheduler. It uses the process environment; to load a local environment file explicitly, run `node --env-file=.env.local scripts/collect.mjs`. A completed same-day manual collection is reused; completely unavailable attempts can be retried.

## Product behavior

1. Enter a Solana mint; the backend validates that its base58 encoding decodes to 32 bytes.
2. DexScreener returns indexed pools. DOVET selects an eligible Solana pool where the requested mint is the base token, ordered by reported USD liquidity.
3. GeckoTerminal is asked for that exact pool. Pool address and base/quote orientation must match before a numerical comparison is made.
4. The response contains the selected pool's price, liquidity and rolling 24-hour volume where supplied, source endpoints, retrieval times, response-body SHA-256 hashes and recorded task events.
5. Read the report, inspect its source receipts and task log, repeat the lookup, or export the complete report as JSON.

Missing observations stay unavailable; a missing second source produces a partial reading. A different pool is not silently used for comparison. Daily reports compare eligible matching pool/orientation snapshots; the browser can also compare a custom receipt with a prior matching receipt.

The product is read-only. There is no wallet connection, trading, token sale, payment collection, custody or movement of funds. The backend agents are deterministic collection and comparison tasks.

## Schedule and history

The fixed public route covers Wrapped SOL, BONK and JUP, whose mints and source references live in `lib/watchlist.js` and `data/SOURCES.md`.

`vercel.json` schedules `GET /api/cron` **once daily at 03:17 UTC**. It does not provide continuous observation or guaranteed minute-level delivery. `CRON_SECRET` protects the endpoint; an authenticated request with the expected Vercel cron user agent is recorded as scheduled, while an ordinary authenticated request is recorded as manual. This classification is not independent cryptographic proof of scheduler origin.

The status API keeps `lastObservedCron` separate from `lastManualRun`. A configured schedule is not evidence that an automatic invocation has occurred. Production scheduling and the first automatic execution require separate verification.

| History | Storage and bounds |
| --- | --- |
| Custom lookup history | Most recent 30 receipts in this browser under `dovet.receipts.v1`; not saved in the public server archive or added to the daily watchlist. |
| Public feed | Most recent 14 run records returned by the API, with up to three reports each; manual and scheduled runs are labeled separately. |
| Local server archive | `data/local-runs.json`, capped at 180 run records, with locked atomic writes. |
| Hosted archive | Immutable public JSON objects in Vercel Blob. Feed reads are bounded; no automatic deletion policy for old Blob objects is currently implemented. |

Export records that must remain available independently of browser storage or the bounded feed. Custom requests use a 60-second cache in each warm server instance; concurrent requests for the same mint are combined. This cache is not a global distributed rate limit.

## Architecture

| Area | Responsibility |
| --- | --- |
| `src/main.jsx` | React observation desk, archive, field notes, source receipts, JSON export and browser-local history. Routes: `/`, `/archive`, `/field-notes`. |
| `src/report-utils.js` | Stored-receipt validation and compatible local snapshot comparison. |
| `src/styles.css` | Responsive cream/plum postal interface, focus states and reduced-motion styles. |
| `src/intro.js` | Independent 3.28-second native DOM/CSS arrival sequence, Skip/Escape, session memory, replay and reduced-motion bypass. It is decorative, not collection progress. |
| `api/*.js` | Thin method-checked JSON HTTP endpoints. |
| `lib/core.js`, `lib/http.js` | Address validation, bounded fetches, hashes, input limits, error responses and cron authentication. |
| `lib/market.js` | Pool selection, same-pool corroboration, report changes and observation cache. |
| `lib/service.js` | Public feed, status, daily orchestration, idempotency and optional token discovery. |
| `lib/storage.js` | Local archive or immutable public Blob archive; hosted code fails explicitly if durable storage is absent. |
| `lib/token.js` | Optional, strictly configured finalized-creation verifier. No discovery runs without the required project identity. |
| `marketing/` | Original pixel assets, English launch copy, prompts, raw images and three separate eight-second MP4 films. |

## API

All responses are JSON and use `Cache-Control: no-store`. Errors have the shape `{ "error": { "code": "...", "message": "..." } }`.

| Endpoint | Request | Success result |
| --- | --- | --- |
| `POST /api/check` | `{ "mint": "<Solana mint>" }` | `{ report, cached }` |
| `GET /api/feed` | No body | Watchlist, latest/previous runs, bounded `runs`, storage configuration and history scope. |
| `GET /api/status` | No body | Storage state, schedule evidence, source roles, cache scope and discovery state. |
| `GET /api/token` | No body | `soon` or configured mint, address source, verification state and optional creation proof. |
| `GET /api/cron` | `Authorization: Bearer <CRON_SECRET>` | Persisted or reused run and storage configuration. |

Check bodies are limited to 2 KB and may contain only `mint`. Provider URLs are constructed on the server, not accepted from user input. Provider fetches are bounded to 7 seconds and 1 MB by default, disallow redirects and retain explicit failure receipts. Warm-instance collection concurrency is capped at six distinct mints; exceeding it returns HTTP 429.

## Hosted configuration

`vercel.json` builds `dist/`, preserves the archive/field-notes routes, and configures API functions with a 60-second maximum duration.

| Variable | Purpose |
| --- | --- |
| `BLOB_READ_WRITE_TOKEN` | Required for hosted public history. Development uses a local file if absent. |
| `CRON_SECRET` | Required for authenticated daily/manual collector invocations. |
| `TOKEN_MINT` | Optional operator-supplied mint. Takes precedence over discovery; configuration alone does not verify a launch. |
| `DEV_WALLET` | Optional project-specific developer wallet; currently not supplied. |
| `TOKEN_EXPECTED_NAME`, `TOKEN_EXPECTED_SYMBOL`, `TOKEN_EXPECTED_URI` | Exact expected creation identity, required for discovery. |
| `TOKEN_WATCH_START_SLOT` | Starting slot bounding the project creation scan. |
| `SOLANA_RPC_URL` | HTTPS Solana mainnet RPC used by optional finalized-creation checks. |
| `TOKEN_LAUNCH_SIGNATURE` | Optional specific creation transaction for a bounded verification request. |

The verifier checks the configured creation program/layout, finalized transaction, developer signer, creator, exact name/symbol/URI, mint initialization and initialized mint account. Received tokens are never candidates. Multiple matching creations fail closed and require an explicit mint. Without a specific signature, the scan is bounded to 12 recent signatures and refuses an incomplete history window.

Do not place environment credentials in public assets or commit local environment files.

## Limits and release verification

A receipt records what providers returned at retrieval time. It is not a token audit, liquidity guarantee, trade recommendation or execution quote. Two providers may share upstream data. Raw response bodies are hashed but are not retained in the receipt; requesting the same endpoint later may return different bytes. A hash does not authenticate a provider or prove market accuracy.

Automated tests cover validation, pool identity/orientation, missing fields, response hashes, source failures, cache behavior, storage/idempotency, HTTP contracts and token-discovery rejection cases. Run `npm test` and `npm run build` before release. Browser verification must also cover mobile/desktop, unavailable source results, repeated receipts, archive navigation, exports, intro Skip/Escape, reduced motion and configured-versus-observed schedule states.

A future token could sponsor additional public observation capacity. No token payment, entitlement, fee flow or distribution is implemented. The tool already works without a token.

See [DESIGN.md](DESIGN.md), [marketing/README.md](marketing/README.md) and [marketing/POSTS.md](marketing/POSTS.md). Replace launch-copy URL placeholders only after verifying the public deployment.

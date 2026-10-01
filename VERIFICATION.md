# Release verification — 2026-10-01

Public site: https://dovet-ten.vercel.app
Source: https://github.com/NeuTr0n244/dovet
Local preview: http://localhost:3197

## Automated checks actually executed

- `npm test`: 39 passing tests. Address decoding, pool identity/orientation, missing values, source hashes, provider failures, request bounds, cache coalescing, archive races/idempotency, HTTP contracts, launch-verification rejection cases, local receipt comparisons and intro bypasses.
- `npm run build`: production build completed. Final Vercel production build also completed.
- `node --env-file=.env.local scripts/verify-live.mjs`: 18 production checks passed. Pages, API contracts, assets, real source observation, rejected malformed inputs, unauthenticated cron rejection and authenticated **manual** idempotent collection.
- Vercel project API confirmed the active `/api/cron` definition at `17 3 * * *` on the dedicated `dovet` project.
- The dedicated public Blob archive was written, reread and reused for the same manual day. The server does not use an ephemeral fallback when hosted storage is unavailable.

## Browser journeys actually inspected

Used the in-app browser on local and production URLs at 1440 × 1000 and 390 × 844.

- Desktop and mobile desk, real bird asset, mint presets and readable receipt layout.
- Submitted BONK locally and wSOL in production; received real price/liquidity/volume and same-pool source comparison.
- Opened source receipts and actual task logs, inspected endpoints/timestamps/SHA-256 values.
- Exported local and production JSON through the visible button; files were created in Downloads and parsed successfully.
- Rejected a malformed mint in the interface. A valid public address with no indexed token pool returned an explicit unavailable receipt; retry remained usable.
- Archive filters, browser-local history, field notes and source-code link.
- Native arrival and explicit replay; Skip removed the overlay. Reduced-motion and already-seen bypasses were tested with unit mocks, **not claimed as browser-emulated settings**.
- Checked document width against viewport, missing images, error overlays and browser error logs. No horizontal overflow, broken loaded images, framework error overlay or production console error was found in the inspected views.

Screenshots are saved locally in `output/desktop-public.png` and `output/mobile-public.png`. Public API evidence is in `output/production-api-qa.json`; these generated QA files are excluded from deployment/source control.

## Media

- X banner: 1500 × 500. Avatar/logo: 1024 × 1024. Transparent mark has alpha. Three post images: 1600 × 900.
- Three actual H.264 MP4 motion pieces: 8 seconds each, 1280 × 720, 24 fps, silent. Metadata, posters and decoded contact sheets inspected by the motion agent.
- `marketing/dovet-launch-kit.zip`: 29 entries; required logo, transparent logo, avatar, banner, POSTS.md, three stills and three MP4s were verified in the archive. Raw generated artwork and reproduction notes are included. No project environment credentials are included.

## Actual release boundaries

- Daily cron is configured, but **the first automatic execution has not yet been observed**. `lastObservedCron` remains null; a manual seed is not represented as an automatic run.
- No project dev wallet, confirmed CA or X profile was provided. `CA: soon`; launch discovery remains disabled until independent project configuration is supplied.
- This product observes public feeds; it does not trade, custody funds, charge token fees or implement token-funded capacity. No such operation was claimed or tested.
- Only the new DOVET project and dedicated storage were provisioned. Other projects and custom domains were preserved; no plan upgrade was made.

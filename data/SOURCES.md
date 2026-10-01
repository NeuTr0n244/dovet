# DOVET observation sources

Checked 2026-10-01. Reports contain real source retrieval timestamps and SHA-256 hashes of complete response bodies, never generated market data.

- Wrapped SOL mint: `So11111111111111111111111111111111111111112`, [Solana Sync Native documentation](https://solana.com/docs/tokens/basics/sync-native).
- BONK mint: `DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263`, present in exchange links in the [official BONK homepage](https://www.bonkcoin.com/) JavaScript asset `/_next/static/chunks/e0c1fe514e823c72.js` as outputCurrency and the Dexlab mint link.
- JUP mint: `JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN`, [Jupiter's official token-list announcement](https://discuss.jup.ag/t/faq-token-list-v3-verification/23074).
- [DexScreener API](https://docs.dexscreener.com/api/reference): `https://api.dexscreener.com/token-pairs/v1/solana/{mint}`. Require Solana chain and exact base mint; select greatest reported USD liquidity.
- [GeckoTerminal public API](https://www.geckoterminal.com/dex-api): `https://api.geckoterminal.com/api/v2/networks/solana/pools/{pool}`. Compare only exact pool and base/quote orientation. Missing values are null. Differences may reflect source update lag.
- [Pump official IDL](https://github.com/pump-fun/pump-public-docs/blob/main/idl/pump.json): create and create_v2 layouts. Read-only launch discovery additionally requires developer signer/user/creator, exact name/symbol/URI, mint initialization, finalized mainnet transaction and initialized mint account. Multiple matches never auto-pin. No developer wallet is configured by default.

The backend makes no trades and requests no wallet signing. Public reports contain no secrets. Configured RPC URLs are excluded from receipts because provider URLs can contain API keys. The RPC method and hash remain recorded.

Daily manual and scheduled collections have separate immutable keys. Concurrent runs use first-write-wins storage. A partial observation remains immutable; an entirely unavailable attempt is retained under a unique failure key and can be retried. Successful prior reports are never overwritten. Local custom inspection history belongs to the browser, not this archive.

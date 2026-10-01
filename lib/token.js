import { decodeBase58, encodeBase58, fetchReceipt, isAddress, iso, sha256, taskEvent } from './core.js';

export const PUMP_PROGRAM = '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P';
export const MAINNET_GENESIS = '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d';
const TOKEN_PROGRAMS = new Set(['TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb']);
// Official pump-public-docs IDL, checked 2026-10-01. Unknown layouts fail closed.
export const CREATE_SCHEMAS = [
  { name: 'create', discriminator: [24, 30, 200, 40, 5, 28, 7, 119], user: 7, count: 14 },
  { name: 'create_v2', discriminator: [214, 144, 76, 236, 95, 139, 49, 180], user: 5, count: 16 },
];
const signatureValid = value => { try { return typeof value === 'string' && value.length <= 88 && decodeBase58(value).length === 64; } catch { return false; } };
export function discoveryConfig(env = process.env) {
  const identity = { wallet: env.DEV_WALLET || '', name: env.TOKEN_EXPECTED_NAME || '', symbol: env.TOKEN_EXPECTED_SYMBOL || '', uri: env.TOKEN_EXPECTED_URI || '', startSlot: Number(env.TOKEN_WATCH_START_SLOT) };
  const missing = [];
  if (!isAddress(identity.wallet)) missing.push('DEV_WALLET');
  if (!identity.name || identity.name.length > 64) missing.push('TOKEN_EXPECTED_NAME');
  if (!identity.symbol || identity.symbol.length > 32) missing.push('TOKEN_EXPECTED_SYMBOL');
  if (!/^https:\/\/\S+$/.test(identity.uri) || identity.uri.length > 512) missing.push('TOKEN_EXPECTED_URI');
  if (!Number.isSafeInteger(identity.startSlot) || identity.startSlot < 1) missing.push('TOKEN_WATCH_START_SLOT');
  if (!env.SOLANA_RPC_URL || !/^https:\/\//.test(env.SOLANA_RPC_URL)) missing.push('SOLANA_RPC_URL');
  if (env.TOKEN_LAUNCH_SIGNATURE && !signatureValid(env.TOKEN_LAUNCH_SIGNATURE)) missing.push('TOKEN_LAUNCH_SIGNATURE (valid signature)');
  return { identity, fingerprint: sha256(JSON.stringify(identity)), enabled: Boolean(env.DEV_WALLET) && !env.TOKEN_MINT, ready: missing.length === 0 && !env.TOKEN_MINT, missing, reason: env.TOKEN_MINT ? 'Manual TOKEN_MINT takes precedence over automatic discovery.' : !env.DEV_WALLET ? 'No project developer wallet was supplied. Launch discovery is disabled.' : missing.length ? 'Launch discovery requires complete project identity configuration.' : 'Daily finalized Pump creation checks are configured; received tokens are never candidates.' };
}
function decodeCreation(buffer) {
  let offset = 8;
  const text = limit => { if (offset + 4 > buffer.length) throw new Error('Invalid create metadata'); const length = buffer.readUInt32LE(offset); offset += 4; if (length > limit || offset + length > buffer.length) throw new Error('Invalid create metadata'); const value = new TextDecoder('utf-8', { fatal: true }).decode(buffer.subarray(offset, offset + length)); offset += length; return value; };
  const name = text(256); const symbol = text(128); const uri = text(2048);
  if (offset + 32 > buffer.length) throw new Error('Missing creator');
  return { name, symbol, uri, creator: encodeBase58(buffer.subarray(offset, offset + 32)) };
}
export function findVerifiedCreations(transaction, signature, identity) {
  if (!transaction || transaction.meta?.err !== null || !Number.isSafeInteger(transaction.slot) || transaction.slot <= identity.startSlot || !signatureValid(signature) || transaction.transaction?.signatures?.[0] !== signature) return [];
  if (transaction.version !== undefined && !['legacy', 0, 1].includes(transaction.version)) throw new Error('Unsupported transaction version');
  const message = transaction.transaction.message;
  if (!message?.accountKeys?.some(key => key.pubkey === identity.wallet && key.signer === true)) return [];
  const instructions = [...(message.instructions || []), ...(transaction.meta.innerInstructions || []).flatMap(group => group.instructions || [])];
  const candidates = [];
  for (const ix of instructions) {
    if (ix.programId !== PUMP_PROGRAM || typeof ix.data !== 'string') continue;
    const data = decodeBase58(ix.data);
    const schema = CREATE_SCHEMAS.find(s => s.discriminator.every((byte, index) => byte === data[index]));
    if (!schema) continue;
    if (data.length > 4096 || !Array.isArray(ix.accounts) || ix.accounts.length < schema.count) throw new Error('Unknown creation layout');
    if (ix.accounts[schema.user] !== identity.wallet) continue;
    const decoded = decodeCreation(data);
    if (decoded.creator !== identity.wallet || decoded.name !== identity.name || decoded.symbol !== identity.symbol || decoded.uri !== identity.uri) continue;
    const mint = ix.accounts[0];
    if (!isAddress(mint) || !message.accountKeys.some(key => key.pubkey === mint && key.writable === true)) throw new Error('Invalid created mint');
    const initialized = instructions.some(instruction => TOKEN_PROGRAMS.has(instruction.programId) && ['initializeMint', 'initializeMint2'].includes(instruction.parsed?.type) && instruction.parsed.info?.mint === mint);
    if (!initialized) throw new Error('The mint initialization instruction could not be verified');
    candidates.push({ mint, ...decoded, program: PUMP_PROGRAM, instruction: schema.name, signature, slot: transaction.slot, blockTime: transaction.blockTime ?? null, verifiedAt: iso(), explorer: `https://solscan.io/tx/${signature}` });
  }
  return candidates;
}
export function verifyMintAccount(result, minimumSlot) {
  const account = result?.value;
  if (!account || !TOKEN_PROGRAMS.has(account.owner) || account.executable !== false || account.data?.parsed?.type !== 'mint' || account.data.parsed.info?.isInitialized !== true || account.data.parsed.info.decimals !== 6 || !Number.isSafeInteger(result.context?.slot) || result.context.slot < minimumSlot) throw new Error('Created mint account could not be verified at finalized context');
  return true;
}
export function chooseUniqueCandidate(candidates) {
  const unique = [...new Map(candidates.map(candidate => [candidate.mint, candidate])).values()];
  if (unique.length > 1) throw new Error('Multiple matching creations require an explicit TOKEN_MINT.');
  return unique[0] ?? null;
}
export async function discoverToken({ env = process.env, previous = null, fetchImpl = fetch } = {}) {
  const config = discoveryConfig(env);
  const base = { enabled: config.enabled, ready: config.ready, missing: config.missing, reason: config.reason, fingerprint: config.fingerprint, status: 'disabled', candidate: null, checkedAt: null, receipts: [], events: [] };
  if (!config.ready) return base;
  if (previous?.fingerprint === config.fingerprint && previous.candidate && previous.status === 'verified') return { ...previous, reason: 'Previously verified creation remains pinned. Manual TOKEN_MINT always takes precedence.' };
  const signal = AbortSignal.timeout(14_000);
  async function rpc(method, params = []) {
    const result = await fetchReceipt(env.SOLANA_RPC_URL, 'Solana RPC', { fetchImpl, timeoutMs: 5000, signal, method: 'POST', body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }), publicUrl: 'https://solana.com/docs/rpc' });
    // Never include the configured RPC URL; it may contain a provider API key.
    const receipt = { ...result.receipt, method }; base.receipts.push(receipt); base.events.push(taskEvent('Registrar', method, receipt));
    if (!result.data || result.data.error || !Object.hasOwn(result.data, 'result')) throw new Error('Finalized RPC evidence is unavailable.');
    return result.data.result;
  }
  try {
    if (await rpc('getGenesisHash') !== MAINNET_GENESIS) throw new Error('RPC network is not Solana mainnet.');
    let signatures;
    if (env.TOKEN_LAUNCH_SIGNATURE) signatures = [{ signature: env.TOKEN_LAUNCH_SIGNATURE }];
    else {
      const history = await rpc('getSignaturesForAddress', [config.identity.wallet, { commitment: 'finalized', limit: 12 }]);
      if (!Array.isArray(history) || history.some(item => !signatureValid(item.signature) || !Number.isSafeInteger(item.slot) || item.confirmationStatus !== 'finalized')) throw new Error('Finalized signature history is invalid.');
      if (history.length >= 12 && history.at(-1).slot > config.identity.startSlot) throw new Error('History exceeds the bounded scan window. Configure TOKEN_LAUNCH_SIGNATURE to verify a specific creation receipt.');
      signatures = history.filter(item => item.slot > config.identity.startSlot && item.err === null);
    }
    const outcomes = await Promise.allSettled(signatures.map(item => rpc('getTransaction', [item.signature, { encoding: 'jsonParsed', commitment: 'finalized', maxSupportedTransactionVersion: 1 }]).then(tx => {
      if (!tx || (item.slot && tx.slot !== item.slot)) throw new Error('Finalized transaction evidence is incomplete.');
      return findVerifiedCreations(tx, item.signature, config.identity);
    })));
    const rejected = outcomes.find(result => result.status === 'rejected');
    if (rejected) throw rejected.reason;
    const transactions = outcomes.map(result => result.value);
    const candidate = chooseUniqueCandidate(transactions.flat());
    if (candidate) verifyMintAccount(await rpc('getAccountInfo', [candidate.mint, { encoding: 'jsonParsed', commitment: 'finalized', minContextSlot: candidate.slot }]), candidate.slot);
    return { ...base, status: candidate ? 'verified' : 'watching', candidate, checkedAt: iso(), reason: candidate ? 'Finalized creation, developer signer, creator, exact project metadata, mint initialization and current mint account were checked.' : 'No matching finalized creation was found in the complete bounded window.' };
  } catch (error) { return { ...base, status: 'unavailable', checkedAt: iso(), reason: error.message, candidate: null }; }
}
export function tokenStatus(env = process.env, discovery = null) {
  const config = discoveryConfig(env);
  const publicDiscovery = { enabled: config.enabled, ready: config.ready, missing: config.missing, reason: config.reason, status: discovery?.status ?? 'disabled', checkedAt: discovery?.checkedAt ?? null };
  if (env.TOKEN_MINT) {
    const valid = isAddress(env.TOKEN_MINT);
    return { status: valid ? 'configured' : 'soon', mint: valid ? env.TOKEN_MINT : null, source: 'manual', verifiedLaunch: false, explorer: valid ? `https://solscan.io/token/${env.TOKEN_MINT}` : null, discovery: { ...publicDiscovery, reason: valid ? config.reason : 'Configured TOKEN_MINT is invalid. Automatic discovery cannot override it.' } };
  }
  const candidate = config.ready && discovery?.fingerprint === config.fingerprint && discovery.status === 'verified' && isAddress(discovery.candidate?.mint) ? discovery.candidate : null;
  return { status: candidate ? 'configured' : 'soon', mint: candidate?.mint ?? null, source: candidate ? 'verified_creation' : null, verifiedLaunch: Boolean(candidate), explorer: candidate ? `https://solscan.io/token/${candidate.mint}` : null, proof: candidate, discovery: { ...publicDiscovery, reason: discovery?.reason ?? config.reason } };
}

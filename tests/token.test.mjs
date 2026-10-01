import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeBase58, encodeBase58 } from '../lib/core.js';
import { CREATE_SCHEMAS, MAINNET_GENESIS, PUMP_PROGRAM, chooseUniqueCandidate, discoverToken, discoveryConfig, findVerifiedCreations, tokenStatus, verifyMintAccount } from '../lib/token.js';

const addr = n => encodeBase58(Buffer.alloc(32, n));
const wallet = addr(18); const mint = addr(17); const signature = encodeBase58(Buffer.alloc(64, 19));
const identity = { wallet, name: 'DOVET', symbol: 'DOVET', uri: 'https://example.org/dovet.json', startSlot: 100 };
const env = { DEV_WALLET: wallet, TOKEN_EXPECTED_NAME: identity.name, TOKEN_EXPECTED_SYMBOL: identity.symbol, TOKEN_EXPECTED_URI: identity.uri, TOKEN_WATCH_START_SLOT: '100', SOLANA_RPC_URL: 'https://rpc.example.org/private-test-key' };
const string = value => { const body = Buffer.from(value); const length = Buffer.alloc(4); length.writeUInt32LE(body.length); return Buffer.concat([length, body]); };
function creation(overrides = {}) {
  const values = { ...identity, ...overrides }; const schema = CREATE_SCHEMAS[1]; const accounts = Array(schema.count).fill(addr(1)); accounts[0] = overrides.mint || mint; accounts[schema.user] = overrides.user || wallet;
  return { programId: overrides.programId || PUMP_PROGRAM, accounts, data: encodeBase58(Buffer.concat([Buffer.from(schema.discriminator), string(values.name), string(values.symbol), string(values.uri), decodeBase58(values.creator || wallet), Buffer.from([0, 0, 0, 0, 0])])) };
}
const tx = (ix = creation()) => ({ slot: 101, version: 0, meta: { err: null, innerInstructions: [{ instructions: [{ programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', parsed: { type: 'initializeMint2', info: { mint: ix.accounts[0] } } }] }] }, transaction: { signatures: [signature], message: { accountKeys: [{ pubkey: wallet, signer: true, writable: true }, { pubkey: ix.accounts[0], signer: true, writable: true }], instructions: [ix] } } });
const account = { context: { slot: 101 }, value: { owner: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', executable: false, data: { parsed: { type: 'mint', info: { isInitialized: true, decimals: 6 } } } } };

test('no supplied wallet means CA soon and discovery disabled', async () => {
  const state = tokenStatus({}); assert.equal(state.mint, null); assert.equal(state.status, 'soon'); assert.equal(state.discovery.enabled, false);
  const result = await discoverToken({ env: {}, fetchImpl: () => { throw new Error('Must not call RPC'); } }); assert.equal(result.status, 'disabled');
});
test('manual mint takes precedence over verified discovery and never implies launch verification', () => {
  const discovery = { fingerprint: discoveryConfig(env).fingerprint, status: 'verified', candidate: { mint } };
  const manual = tokenStatus({ ...env, TOKEN_MINT: addr(22) }, discovery);
  assert.equal(manual.mint, addr(22)); assert.equal(manual.source, 'manual'); assert.equal(manual.verifiedLaunch, false);
  const invalid = tokenStatus({ ...env, TOKEN_MINT: 'invalid' }, discovery); assert.equal(invalid.mint, null); assert.equal(invalid.source, 'manual');
});
test('verified launch requires exact signed creation metadata and mint initialization', () => {
  const candidates = findVerifiedCreations(tx(), signature, identity); assert.equal(candidates.length, 1); assert.equal(candidates[0].mint, mint); assert.equal(candidates[0].creator, wallet);
  assert.equal(verifyMintAccount(account, 101), true);
});
test('received tokens, unrelated projects and creator impersonation never become candidates', () => {
  for (const overrides of [{ creator: addr(9) }, { user: addr(9) }, { name: 'DOVET rewards' }, { name: 'DOVЕT' }, { symbol: 'OTHER' }, { uri: 'https://example.org/other.json' }, { programId: addr(9) }]) assert.deepEqual(findVerifiedCreations(tx(creation(overrides)), signature, identity), []);
  const nonSigner = tx(); nonSigner.transaction.message.accountKeys[0].signer = false; assert.deepEqual(findVerifiedCreations(nonSigner, signature, identity), []);
  const transfer = tx(); transfer.transaction.message.instructions = []; assert.deepEqual(findVerifiedCreations(transfer, signature, identity), []);
});
test('failed transactions, old slots and wrong signatures cannot verify', () => {
  const failed = tx(); failed.meta.err = { InstructionError: [0, 'Custom'] }; assert.deepEqual(findVerifiedCreations(failed, signature, identity), []);
  const old = tx(); old.slot = 100; assert.deepEqual(findVerifiedCreations(old, signature, identity), []);
  assert.deepEqual(findVerifiedCreations(tx(), encodeBase58(Buffer.alloc(64, 20)), identity), []);
});
test('missing initialization, future layouts and malformed creates fail closed', () => {
  const noInit = tx(); noInit.meta.innerInstructions = []; assert.throws(() => findVerifiedCreations(noInit, signature, identity));
  assert.throws(() => findVerifiedCreations({ ...tx(), version: 2 }, signature, identity));
  const malformed = creation(); malformed.data = encodeBase58(Buffer.from(CREATE_SCHEMAS[1].discriminator)); assert.throws(() => findVerifiedCreations(tx(malformed), signature, identity));
});
test('ambiguous matching mints are never auto-pinned', () => {
  assert.throws(() => chooseUniqueCandidate([{ mint }, { mint: addr(21) }]), /Multiple/);
  assert.equal(chooseUniqueCandidate([{ mint }, { mint }]).mint, mint);
});
test('mint account must be initialized and observed at or after its creation slot', () => {
  assert.throws(() => verifyMintAccount({ ...account, context: { slot: 100 } }, 101));
  assert.throws(() => verifyMintAccount({ ...account, value: { ...account.value, owner: addr(8) } }, 101));
});
test('discovery verifies a specific finalized creation receipt without exposing RPC credentials', async () => {
  const result = await discoverToken({ env: { ...env, TOKEN_LAUNCH_SIGNATURE: signature }, fetchImpl: async (_, options) => {
    const method = JSON.parse(options.body).method;
    const value = method === 'getGenesisHash' ? MAINNET_GENESIS : method === 'getTransaction' ? tx() : account;
    return new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, result: value }));
  } });
  assert.equal(result.status, 'verified'); assert.equal(result.candidate.mint, mint); assert.equal(result.receipts.length, 3);
  assert.equal(JSON.stringify(result).includes('private-test-key'), false);
  assert.equal(tokenStatus(env, result).source, 'verified_creation');
});
test('a full history window cannot silently choose a recent candidate', async () => {
  const result = await discoverToken({ env, fetchImpl: async (_, options) => {
    const method = JSON.parse(options.body).method;
    const value = method === 'getGenesisHash' ? MAINNET_GENESIS : Array.from({ length: 12 }, (_, i) => ({ signature, slot: 120 - i, err: null, confirmationStatus: 'finalized' }));
    return new Response(JSON.stringify({ result: value }));
  } });
  assert.equal(result.status, 'unavailable'); assert.equal(result.candidate, null); assert.match(result.reason, /scan window/);
});
test('proof from another configured identity cannot publish a mint', () => {
  const result = tokenStatus(env, { fingerprint: 'wrong', status: 'verified', candidate: { mint } }); assert.equal(result.mint, null);
});

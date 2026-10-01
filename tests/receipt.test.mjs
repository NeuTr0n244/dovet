import {test} from 'node:test';
import assert from 'node:assert/strict';
import {localComparison,validStoredReceipt} from '../src/report-utils.js';
const previous={id:'old',mint:'m',observedAt:'2026-10-01T00:00:00Z',pool:{address:'p',baseMint:'m',quoteMint:'q',priceUsd:5,liquidityUsd:100,volume24hUsd:200}};
const current={...previous,id:'new',observedAt:'2026-10-01T01:00:00Z',pool:{...previous.pool,priceUsd:6,liquidityUsd:90,volume24hUsd:null}};
test('unavailable current and previous receipts never crash or imply a price change',()=>assert.equal(localComparison({...current,pool:null},{...previous,pool:null}),null));
test('same-pool snapshots compute change while retaining missing fields',()=>{const c=localComparison(current,previous);assert.ok(Math.abs(c.pricePct-20)<1e-8);assert.ok(Math.abs(c.liquidityPct+10)<1e-8);assert.equal(c.volume24hPct,null);});
test('a pool, token orientation or time reversal cannot be compared',()=>{for(const c of [{...current,mint:'other'},{...current,pool:{...current.pool,quoteMint:'other'}},{...current,observedAt:previous.observedAt},{...current,pool:{...current.pool,address:'other'}}])assert.equal(localComparison(c,previous),null);});
test('corrupt local history is ignored without erasing unrelated stored records',()=>{assert.equal(validStoredReceipt({...current,status:'ok',receipts:[],events:[]}),true);assert.equal(validStoredReceipt({...current,status:'ok',receipts:[],events:[null]}),false);assert.equal(validStoredReceipt({id:'old'}),false);});

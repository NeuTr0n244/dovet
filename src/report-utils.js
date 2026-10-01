export function localComparison(report, previous) {
 if (!report?.pool || !previous?.pool || report.id === previous.id || report.mint !== previous.mint || report.observedAt <= previous.observedAt) return null;
 const a=report.pool,b=previous.pool;
 if(a.address!==b.address || a.baseMint!==b.baseMint || a.quoteMint!==b.quoteMint)return null;
 const delta=(next,before)=>typeof next==='number'&&Number.isFinite(next)&&typeof before==='number'&&Number.isFinite(before)&&before>0?(next/before-1)*100:null;
 return {previousObservedAt:previous.observedAt,pricePct:delta(a.priceUsd,b.priceUsd),liquidityPct:delta(a.liquidityUsd,b.liquidityUsd),volume24hPct:delta(a.volume24hUsd,b.volume24hUsd)};
}
export function validStoredReceipt(report){
 return report&&typeof report.id==='string'&&typeof report.mint==='string'&&Number.isFinite(Date.parse(report.observedAt))&&['ok','partial','unavailable'].includes(report.status)&&Array.isArray(report.receipts)&&report.receipts.every(r=>r&&typeof r.source==='string')&&Array.isArray(report.events)&&report.events.every(e=>e&&typeof e.agent==='string')&&(report.pool===null||typeof report.pool?.address==='string');
}

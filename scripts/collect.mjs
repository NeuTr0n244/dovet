import { getService } from '../lib/service.js';
try {
  const result = await getService().runDaily({ trigger: 'manual' });
  console.log(JSON.stringify({ id: result.run.id, day: result.run.day, trigger: result.run.trigger, status: result.run.status, reused: result.reused, storage: result.storage.mode, reports: result.run.reports.map(report => ({ mint: report.mint, status: report.status, pool: report.pool?.address ?? null })) }, null, 2));
  if (result.run.status === 'unavailable') process.exitCode = 1;
} catch (error) { console.error(`${error.code || 'COLLECTION_FAILED'}: ${error.message}`); process.exitCode = 1; }

import { mkdir, readFile, writeFile, rename, open, unlink } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { AppError, readBounded } from './core.js';

const PREFIX = 'dovet/v1/runs/';
const localPath = fileURLToPath(new URL('../data/local-runs.json', import.meta.url));
export function storageConfiguration(env = process.env) {
  const durable = Boolean(env.BLOB_READ_WRITE_TOKEN);
  return { mode: durable ? 'vercel-blob' : env.VERCEL ? 'unconfigured' : 'local-file', configured: durable || !env.VERCEL, durable, publicReports: durable, message: durable ? 'Immutable public observation reports in Vercel Blob.' : env.VERCEL ? 'Durable report storage is not configured.' : 'Development history in data/local-runs.json on this machine.' };
}
function validRun(run) {
  return run?.schemaVersion === 1 && typeof run.id === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(run.day) && ['manual', 'scheduled'].includes(run.trigger) && ['ok', 'partial', 'unavailable'].includes(run.status) && Array.isArray(run.reports) && run.reports.length === 3 && Number.isFinite(Date.parse(run.finishedAt));
}
function keyFor(run) {
  // Reverse day sorts recent days first even after the archive grows.
  const dayKey = String(9_999_999_999_999 - Date.parse(`${run.day}T00:00:00Z`)).padStart(13, '0');
  return `${PREFIX}${dayKey}-${run.day}/${run.trigger}${run.status === 'unavailable' ? `-failed-${run.id}` : ''}.json`;
}
export function createStore({ env = process.env, path = localPath, sdkLoader = () => import('@vercel/blob') } = {}) {
  const configuration = storageConfiguration(env);
  function requireStorage() { if (!configuration.configured) throw new AppError('STORAGE_UNCONFIGURED', 'Durable report storage is not configured. No run was recorded.', 503); }
  async function localRead() {
    try {
      const text = await readFile(path, 'utf8');
      if (Buffer.byteLength(text) > 8_000_000) throw new Error('Local archive exceeds limit');
      const doc = JSON.parse(text);
      if (doc?.schemaVersion !== 1 || !Array.isArray(doc.runs) || !doc.runs.every(validRun)) throw new Error('Invalid local archive');
      return doc.runs;
    } catch (error) { if (error.code === 'ENOENT') return []; throw new AppError('STORAGE_READ_FAILED', 'The local archive is unreadable; it was not replaced.', 503); }
  }
  async function blobRead(pathname) {
    const sdk = await sdkLoader();
    const blob = await sdk.get(pathname, { access: 'public', useCache: false, token: env.BLOB_READ_WRITE_TOKEN, abortSignal: AbortSignal.timeout(7000) });
    if (!blob) return null;
    if (blob.statusCode !== 200 || !blob.stream) throw new Error('Invalid archive response');
    const run = JSON.parse((await readBounded(blob.stream, 750_000)).toString('utf8'));
    if (!validRun(run)) throw new Error('Invalid archive document');
    return { ...run, archiveUrl: blob.blob.url };
  }
  return {
    configuration,
    async readRuns(limit = 14) {
      requireStorage();
      if (!configuration.durable) return (await localRead()).sort((a, b) => b.finishedAt.localeCompare(a.finishedAt)).slice(0, limit);
      try {
        const sdk = await sdkLoader();
        const listed = await sdk.list({ prefix: PREFIX, limit: 1000, token: env.BLOB_READ_WRITE_TOKEN, abortSignal: AbortSignal.timeout(7000) });
        const paths = listed.blobs.filter(b => b.pathname.endsWith('.json')).sort((a, b) => a.pathname.localeCompare(b.pathname)).slice(0, limit);
        const runs = await Promise.all(paths.map(item => blobRead(item.pathname)));
        return runs.filter(Boolean).sort((a, b) => b.finishedAt.localeCompare(a.finishedAt));
      } catch { throw new AppError('STORAGE_READ_FAILED', 'The durable archive could not be read. Retry shortly.', 503); }
    },
    async findDay(day, trigger) {
      requireStorage();
      if (!configuration.durable) return (await localRead()).find(run => run.day === day && run.trigger === trigger && run.status !== 'unavailable') ?? null;
      try { return await blobRead(keyFor({ day, trigger, status: 'ok' })); } catch { throw new AppError('STORAGE_READ_FAILED', 'The daily archive could not be read.', 503); }
    },
    async putRun(run) {
      requireStorage();
      if (!validRun(run)) throw new AppError('INVALID_RUN', 'An invalid report cannot be stored.');
      if (!configuration.durable) {
        await mkdir(dirname(path), { recursive: true });
        let lock;
        try { lock = await open(`${path}.lock`, 'wx'); } catch { throw new AppError('STORAGE_BUSY', 'Another local collector is writing the archive. Retry shortly.', 409); }
        try {
          const runs = await localRead();
          const existing = runs.find(r => r.day === run.day && r.trigger === run.trigger && r.status !== 'unavailable');
          if (existing) return { run: existing, reused: true };
          const next = { schemaVersion: 1, runs: [run, ...runs].slice(0, 180) };
          await writeFile(`${path}.tmp`, JSON.stringify(next, null, 2), 'utf8'); await rename(`${path}.tmp`, path);
          return { run, reused: false };
        } finally { await lock.close(); await unlink(`${path}.lock`).catch(() => {}); }
      }
      const pathname = keyFor(run);
      try {
        const sdk = await sdkLoader();
        const blob = await sdk.put(pathname, JSON.stringify(run), { access: 'public', addRandomSuffix: false, allowOverwrite: false, contentType: 'application/json', cacheControlMaxAge: 31536000, token: env.BLOB_READ_WRITE_TOKEN, abortSignal: AbortSignal.timeout(7000) });
        return { run: { ...run, archiveUrl: blob.url }, reused: false };
      } catch {
        // A concurrent invocation may have won the immutable daily pathname.
        try { const existing = await blobRead(pathname); if (existing) return { run: existing, reused: true }; } catch { /* Preserve the original archive; never fall back to ephemeral hosted storage. */ }
        throw new AppError('STORAGE_WRITE_FAILED', 'The durable archive could not be written. The previous archive remains intact.', 503);
      }
    },
  };
}

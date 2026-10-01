import { timingSafeEqual } from 'node:crypto';
import { AppError } from './core.js';

export function send(res, code, data) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(JSON.stringify(data));
}
export function endpoint(method, action) {
  return async (req, res) => {
    if (req.method !== method) { res.setHeader('Allow', method); return send(res, 405, { error: { code: 'METHOD_NOT_ALLOWED', message: `Use ${method}.` } }); }
    try { return send(res, 200, await action(req)); }
    catch (error) { return send(res, error instanceof AppError ? error.status : 500, { error: { code: error instanceof AppError ? error.code : 'INTERNAL_ERROR', message: error instanceof AppError ? error.message : 'The request could not be completed. Retry shortly.' } }); }
  };
}
export async function jsonBody(req) {
  const declared = Number(req.headers?.['content-length']);
  if (Number.isFinite(declared) && declared > 2048) throw new AppError('BODY_TOO_LARGE', 'Request body exceeds 2 KB.', 413);
  if (req.headers?.['content-type'] && !req.headers['content-type'].toLowerCase().includes('application/json')) throw new AppError('INVALID_CONTENT_TYPE', 'Use application/json.', 415);
  try {
    let body = req.body;
    if (body === undefined) { let size = 0; const chunks = []; for await (const chunk of req) { size += Buffer.byteLength(chunk); if (size > 2048) throw new AppError('BODY_TOO_LARGE', 'Request body exceeds 2 KB.', 413); chunks.push(Buffer.from(chunk)); } body = Buffer.concat(chunks).toString('utf8'); }
    if (Buffer.isBuffer(body)) body = body.toString('utf8');
    if (typeof body === 'string') { if (Buffer.byteLength(body) > 2048) throw new AppError('BODY_TOO_LARGE', 'Request body exceeds 2 KB.', 413); body = JSON.parse(body); }
    if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => key !== 'mint') || Buffer.byteLength(JSON.stringify(body)) > 2048) throw new Error('Invalid input');
    return body;
  } catch (error) { if (error instanceof AppError) throw error; throw new AppError('INVALID_JSON', 'Send a JSON object containing only mint.', 400); }
}
export function authenticateCron(req, env = process.env) {
  if (!env.CRON_SECRET) throw new AppError('CRON_UNCONFIGURED', 'The scheduled collector is not configured.', 503);
  const actual = Buffer.from(String(req.headers?.authorization || '')); const expected = Buffer.from(`Bearer ${env.CRON_SECRET}`);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new AppError('UNAUTHORIZED', 'Collector authorization is required.', 401);
  return /^vercel-cron\/1\.0(?:\s|$)/i.test(String(req.headers?.['user-agent'] || '')) ? 'scheduled' : 'manual';
}

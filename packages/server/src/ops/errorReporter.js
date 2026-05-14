/**
 * Error reporter — captures uncaughtException / unhandledRejection and feeds
 * them into an in-memory ring buffer for after-the-fact diagnostics.
 *
 * Optional Sentry hook: if `SENTRY_DSN` is set AND `@sentry/node` is
 * installed, we forward each captured error there too. The Sentry import is
 * dynamic so this module has zero hard dependencies.
 *
 * Wire `install({ io })` once near the top of `index.js`, before any game
 * code runs. The exported `recentErrors()` returns a snapshot for the
 * `/health` (or future `/debug/errors`) endpoint.
 */

import { RingBuffer } from './ringBuffer.js';

const ERROR_BUFFER_CAPACITY = 50;

const errorBuffer = new RingBuffer(ERROR_BUFFER_CAPACITY);

let _sentry = null;
let _sentryAttempted = false;
let _installed = false;

async function ensureSentry() {
  if (_sentryAttempted) return _sentry;
  _sentryAttempted = true;
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return null;
  try {
    const Sentry = await import('@sentry/node');
    Sentry.init({ dsn, tracesSampleRate: 0 });
    _sentry = Sentry;
    console.log('[ERRORS] Sentry initialised');
    return _sentry;
  } catch {
    console.warn('[ERRORS] SENTRY_DSN set but @sentry/node not installed; falling back to ring buffer only.');
    return null;
  }
}

function serializeError(err) {
  if (!err) return { message: 'unknown error' };
  if (err instanceof Error) {
    return { name: err.name, message: err.message, stack: err.stack };
  }
  if (typeof err === 'object') {
    try {
      return { message: JSON.stringify(err) };
    } catch {
      return { message: String(err) };
    }
  }
  return { message: String(err) };
}

/**
 * Record an error into the ring buffer (and forward to Sentry if configured).
 * Non-blocking; safe to call from anywhere.
 */
export function reportError(kind, err, context = {}) {
  const entry = { kind, error: serializeError(err), context };
  errorBuffer.push(kind, entry);
  // Log to console too — current operators read server logs first.
  console.error(`[${kind}]`, entry.error.message, context && Object.keys(context).length ? context : '');
  if (err && err.stack) console.error(err.stack);
  // Sentry is best-effort; we deliberately don't await.
  ensureSentry().then((sentry) => {
    if (!sentry) return;
    try {
      sentry.captureException(err, { extra: { kind, ...context } });
    } catch {
      /* never let error-reporting throw */
    }
  });
}

/** Snapshot of the most recent N error entries (newest last). */
export function recentErrors() {
  return errorBuffer.snapshot();
}

export function errorStats() {
  return errorBuffer.stats();
}

/**
 * Install process-level handlers. Idempotent — calling more than once is a
 * no-op.
 */
export function install() {
  if (_installed) return;
  _installed = true;

  process.on('uncaughtException', (err, origin) => {
    reportError('uncaughtException', err, { origin });
  });

  process.on('unhandledRejection', (reason) => {
    reportError('unhandledRejection', reason, {});
  });

  // Warnings are common (deprecations etc.) — don't ring-buffer them, just log.
  process.on('warning', (warning) => {
    console.warn(`[NODE_WARNING] ${warning.name}: ${warning.message}`);
  });

  console.log('[ERRORS] Process error handlers installed');
}

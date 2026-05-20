import 'dotenv/config';
import { connect, RetentionPolicy, StorageType } from 'nats';
import { Redis } from 'ioredis';
import Fastify from 'fastify';
import { healthzPlugin } from './healthz.js';

function parsePort(raw: string | undefined, fallback: number, name: string): number {
  if (raw === undefined || raw === '') return fallback;
  const n = Number.parseInt(raw, 10);
  if (!Number.isInteger(n) || n <= 0 || n > 65535) {
    console.error(`[${name}] invalid port "${raw}" — must be integer in 1-65535`);
    process.exit(1);
  }
  return n;
}

/** Redact userinfo (user:pass@) from a URL before logging. */
function redactUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.username) parsed.username = '***';
    if (parsed.password) parsed.password = '***';
    return parsed.toString();
  } catch {
    return '<invalid-url>';
  }
}

const NATS_URL = process.env['NATS_URL'] ?? 'nats://localhost:4222';
const REDIS_URL = process.env['REDIS_URL'] ?? 'redis://localhost:6379';
const NATS_STREAM = process.env['NATS_STREAM'] ?? 'gtarp';
const PORT = parsePort(process.env['EVENT_WORKER_PORT'], 3003, 'EVENT_WORKER_PORT');

// 7 days expressed in nanoseconds (NATS JetStream max_age unit).
const SEVEN_DAYS_NS = 7 * 24 * 60 * 60 * 1_000_000_000;

async function main() {
  // ── NATS ─────────────────────────────────────────────────────────────────
  const nc = await connect({ servers: NATS_URL });
  console.log(`[event-worker] Connected to NATS: ${redactUrl(NATS_URL)}`);

  const jsm = await nc.jetstreamManager();

  // Create the gtarp JetStream stream if it does not yet exist.
  // Only fall through to `streams.add` when the stream is genuinely missing —
  // auth/network failures need to surface, not be swallowed.
  try {
    await jsm.streams.info(NATS_STREAM);
    console.log(`[event-worker] JetStream stream "${NATS_STREAM}" exists`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const isNotFound = /\b404\b|\bnot\s*found\b/i.test(message);
    if (!isNotFound) {
      throw err;
    }
    await jsm.streams.add({
      name: NATS_STREAM,
      subjects: [`${NATS_STREAM}.>`],
      retention: RetentionPolicy.Limits,
      storage: StorageType.File,
      max_age: SEVEN_DAYS_NS,
    });
    console.log(`[event-worker] Created JetStream stream "${NATS_STREAM}"`);
  }

  // ── Redis ─────────────────────────────────────────────────────────────────
  const redis = new Redis(REDIS_URL);
  redis.on('connect', () =>
    console.log(`[event-worker] Connected to Redis: ${redactUrl(REDIS_URL)}`),
  );
  redis.on('error', (err: Error) => console.error('[event-worker] Redis error:', err));

  // ── Heartbeat ─────────────────────────────────────────────────────────────
  const heartbeat = setInterval(() => {
    console.log(`[event-worker] heartbeat ${new Date().toISOString()}`);
  }, 30_000);

  // ── HTTP /healthz ─────────────────────────────────────────────────────────
  const app = Fastify({ logger: false });
  await app.register(healthzPlugin);
  await app.listen({ port: PORT, host: '0.0.0.0' });
  console.log(`[event-worker] /healthz listening on port ${PORT}`);

  // ── Graceful shutdown ─────────────────────────────────────────────────────
  let shuttingDown = false;
  const shutdown = async (signal: 'SIGTERM' | 'SIGINT') => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[event-worker] ${signal} received — shutting down`);
    clearInterval(heartbeat);
    await app.close();
    redis.disconnect();
    await nc.drain();
    process.exit(0);
  };

  const handleSignal = (signal: 'SIGTERM' | 'SIGINT') => {
    void shutdown(signal).catch((err: unknown) => {
      console.error('[event-worker] Shutdown error:', err);
      process.exit(1);
    });
  };

  process.once('SIGTERM', () => handleSignal('SIGTERM'));
  process.once('SIGINT', () => handleSignal('SIGINT'));
}

main().catch((err: unknown) => {
  console.error('[event-worker] Fatal error:', err);
  process.exit(1);
});

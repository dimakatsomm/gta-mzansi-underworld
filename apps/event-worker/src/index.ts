import 'dotenv/config';
import { Redis } from 'ioredis';
import Fastify from 'fastify';
import { healthzPlugin } from './healthz.js';
import { startBridge } from './bridge/index.js';
import { registry } from './metrics.js';
import { registerReputationEngine } from './engines/reputation/index.js';
import { registerDispatchEngine, initDispatchEngine } from './engines/dispatch/index.js';
import { registerWitnessEngine, initWitnessEngine } from './engines/witness/index.js';

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
const PORT = parsePort(process.env['EVENT_WORKER_PORT'], 3003, 'EVENT_WORKER_PORT');

async function main() {
  // ── Engine registration ───────────────────────────────────────────────────
  // Engines must be registered before startBridge() so Workers pick up
  // handlers on their first job.
  registerReputationEngine();
  registerWitnessEngine();

  // ── Redis ─────────────────────────────────────────────────────────────────
  // JetStream stream lifecycle (create + config) is owned by @gtarp/event-bus
  // and runs inside startBridge() below. Keeping stream creation in one place
  // avoids the worker and the bus disagreeing on retention / subject filters.
  const redis = new Redis(REDIS_URL);
  redis.on('connect', () =>
    console.log(`[event-worker] Connected to Redis: ${redactUrl(REDIS_URL)}`),
  );
  redis.on('error', (err: Error) => console.error('[event-worker] Redis error:', err));

  // Dispatch engine registration must happen before startBridge() so the
  // worker picks up its handler immediately. The engine needs the shared
  // EventBus (created inside startBridge) for publishing, so we register the
  // consumer first and finish init with the bus once the bridge is up.
  const AI_ORCHESTRATOR_URL = process.env['AI_ORCHESTRATOR_URL'] ?? 'http://localhost:3002';
  registerDispatchEngine();

  // ── BullMQ bridge ─────────────────────────────────────────────────────────
  const bridge = await startBridge({ natsUrl: NATS_URL, redisUrl: REDIS_URL });
  console.log(`[event-worker] BullMQ bridge started — NATS: ${redactUrl(NATS_URL)}`);

  initDispatchEngine({ redis, orchestratorUrl: AI_ORCHESTRATOR_URL, bus: bridge.bus });
  initWitnessEngine({ redis, bus: bridge.bus });

  // ── Heartbeat ─────────────────────────────────────────────────────────────
  const heartbeat = setInterval(() => {
    console.log(`[event-worker] heartbeat ${new Date().toISOString()}`);
  }, 30_000);

  // ── HTTP /healthz + /metrics ──────────────────────────────────────────────
  const app = Fastify({ logger: false });
  await app.register(healthzPlugin);
  app.get('/metrics', async (_req, reply) => {
    const text = await registry.metrics();
    // prom-client computes the correct content-type (may include charset and
    // can switch to application/openmetrics-text when OpenMetrics is enabled).
    return reply.type(registry.contentType).send(text);
  });
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
    await bridge.close();
    redis.disconnect();
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

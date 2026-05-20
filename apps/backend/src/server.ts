import Fastify from 'fastify';
import { healthzRoute } from './routes/healthz.js';

export async function buildServer() {
  const app = Fastify({ logger: true });
  await app.register(healthzRoute);
  return app;
}

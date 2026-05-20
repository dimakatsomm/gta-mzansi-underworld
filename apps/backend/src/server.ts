import Fastify from 'fastify';
import { healthzRoute } from './routes/healthz.js';

export function buildServer() {
  const app = Fastify({ logger: true });
  void app.register(healthzRoute);
  return app;
}

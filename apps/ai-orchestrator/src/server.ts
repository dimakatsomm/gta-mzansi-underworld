import Fastify from 'fastify';
import { generateRoutes } from './routes/generate.js';

export async function buildServer() {
  const app = Fastify({ logger: true });
  await app.register(generateRoutes);
  return app;
}

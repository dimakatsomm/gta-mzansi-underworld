import 'dotenv/config';
import { getPrisma } from '@gtarp/db';
import { connect as connectEventBus } from '@gtarp/event-bus';
import { Redis } from 'ioredis';
import { buildServer } from './server.js';
import { parsePort } from './parsePort.js';

const port = parsePort(process.env['BACKEND_PORT'], 3001, 'BACKEND_PORT');
const prisma = getPrisma();
const eventBus = await connectEventBus();
const redis = new Redis(process.env['REDIS_URL'] ?? 'redis://localhost:6379');

const app = await buildServer({ prisma, eventBus, redis });

app.listen({ port, host: '0.0.0.0' }, (err) => {
  if (err) {
    app.log.error(err);
    process.exit(1);
  }
});

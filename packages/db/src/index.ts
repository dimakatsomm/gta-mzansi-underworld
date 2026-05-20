import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

let _prisma: PrismaClient | undefined;

export function getPrisma(): PrismaClient {
  if (!_prisma) {
    const connectionString = process.env['DATABASE_URL'];
    if (!connectionString) {
      throw new Error(
        'DATABASE_URL is not set — required by @prisma/adapter-pg to open a Postgres connection.',
      );
    }
    const adapter = new PrismaPg({ connectionString });
    _prisma = new PrismaClient({ adapter, log: ['warn', 'error'] });
  }
  return _prisma;
}

export type { PrismaClient } from '@prisma/client';
export * from '@prisma/client';

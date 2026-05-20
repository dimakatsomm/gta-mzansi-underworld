import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

let _prisma: PrismaClient | undefined;

export function getPrisma(): PrismaClient {
  if (!_prisma) {
    const adapter = new PrismaPg({
      connectionString: process.env['DATABASE_URL'],
    });
    _prisma = new PrismaClient({ adapter, log: ['warn', 'error'] });
  }
  return _prisma;
}

export type { PrismaClient } from '@prisma/client';
export * from '@prisma/client';

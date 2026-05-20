import path from 'node:path';
import { defineConfig } from 'prisma/config';

// DATABASE_URL must be set in the environment. CI provides it; local devs
// should export it from .env.local or similar before running prisma commands.
export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  migrations: {
    path: path.join('prisma', 'migrations'),
  },
  datasource: {
    url: process.env.DATABASE_URL!,
  },
});

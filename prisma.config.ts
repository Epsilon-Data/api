import 'dotenv/config';
import type { PrismaConfig } from 'prisma';

const databaseUrl =
  process.env.DATABASE_URL ??
  'postgresql://epsilon_admin:supersecret@localhost:6543/epsilon';

export default {
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    // seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: databaseUrl,
  },
} satisfies PrismaConfig;

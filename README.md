# api-service

API gateway for frontend applications (currently servicing as API to Data Hub frontend)

## Prerequisites

Install `pnpm` and `typescript` globally

```bash
npm install -g typescript pnpm
```

When cloning the repo first time:

```bash
pnpm i # installs all dependent packages under node_modules
```

## Development

1. Modify DATABASE_URL in .env to the pg_platform database url.

2. Apply prisma migrations:

```bash
npx prisma migrate dev
```

Install all necessary prisma packages when prompted.

3. Run in watch mode:

```bash
pnpm start:dev
```

To apply your own migrations:

```bash
npx prisma migrate dev --name <MIGRATION_NAME_HERE>
```

(Optional) Visual editor for data in pg_platform:

```bash
npx prisma studio
```

⚠️ **Baseline Database Migrations**⚠️

1. If `pnpm/migrations` folder exists, delete, move, rename, or archive this folder.

2. Run to create `migrations` directory with `0_init` as migration name:

```bash
mkdir -p prisma/migrations/0_init
```

3. Generate migration and save it to a file:

```bash
npx prisma migrate diff \
--from-empty \
--to-schema-datamodel prisma/schema.prisma \
--script > prisma/migrations/0_init/migration.sql
```

4. Add `0_init` migration to `_prisma_migrations` table and marks as applied:

```bash
npx prisma migrate resolve --applied 0_init
```

5. Check migration matches with current database:

```bash
npx prisma migrate dev
```

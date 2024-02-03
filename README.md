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


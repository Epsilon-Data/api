# api-service

API gateway for frontend applications (currently servicing as API to Data Hub frontend)

## Prerequisites

### Generate Github personal access token (classic)

You need have access to private packages hosted in GitHub for Epsilon. See [Epsilon-Data packages](https://github.com/orgs/Epsilon-Data/packages)

1. Create a personal access token in developer settings: https://github.com/settings/tokens
2. Enable token scopes: `read:packages` and `write:packages` (write is _REQUIRED_ if you want to publish packages)

### Login to NPM

Needed to get access to Epsilon NPM packages.

```bash
pnpm login --scope=@epsilon-data --registry=https://npm.pkg.github.com
$ Username: <Your personal GitHub username>
$ Password: <Create a GitHub Access Token with your account and paste it here>
$ Email: <Email associated with the same account>
```

### Login to GitHub container registry

You need to be logged in to get the data-broker image used for crawling.

```bash
docker login ghcr.io -u YOUR_USERNAME -p YOUR_GITHUB_TOKEN
```

### Add Keycloak hostname

For local development setup, this is needed in order for `token-handler-api` to be able to connect to Keycloak inside docker network and to trust the issuer, you need to add extra host in your machine:

```bash
# edit  /etc/hosts to add
127.0.0.1 keycloak
```

### Install global dependencies

Install `pnpm` and `typescript` globally

```bash
npm install -g typescript pnpm
```

## Development

When cloning the repo first time:

```bash
pnpm i # installs all dependent packages under node_modules
```

> NOTE: This also runs the postinstall scripts for prisma generate and pulls the `data-broker` image

Apply prisma migrations:

```bash
pnpm prisma migrate dev
```

Install all necessary prisma packages when prompted.

Run in watch mode:

```bash
pnpm start:dev
```

### MinIO

Access [MinIO Console](http://localhost:9002/) to manage the server in browser.

### Prisma

To apply your own migrations:

```bash
pnpm prisma migrate dev --name <MIGRATION_NAME_HERE>
```

(Optional) Visual editor for data in pg_platform:

```bash
pnpm prisma studio
```

⚠️ **Baseline Database Migrations**⚠️

1. If `pnpm/migrations` folder exists, delete, move, rename, or archive this folder.

2. Run to create `migrations` directory with `0_init` as migration name:

```bash
mkdir -p prisma/migrations/0_init
```

3. Generate migration and save it to a file:

```bash
pnpm prisma migrate diff \
--from-empty \
--to-schema-datamodel prisma/schema.prisma \
--script > prisma/migrations/0_init/migration.sql
```

4. Add `0_init` migration to `_prisma_migrations` table and marks as applied:

```bash
pnpm prisma migrate resolve --applied 0_init
```

5. Check migration matches with current database:

```bash
pnpm prisma migrate dev
```

## Before raising PR

```bash
pnpm run clean-install # cleans cache, reinstalls and checks versions of packages
pnpm fix # runs lint and prettier
pnpm test # runs all unit tests for packages and services
```

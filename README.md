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
export DATABASE_URL="postgresql://epsilon_admin:supersecret@localhost:6543/epsilon" && npx prisma migrate dev
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

## Keycloak Configuration (For Coordinator OAuth with GitHub)

### Setting up Keycloak Client for OAuth

1. **Access Keycloak Admin Console**
   - Navigate to `http://localhost:8080`
   - Login with admin credentials

2. **Create OAuth Client**
   - Go to **Clients** → **Create client**
   - Configure as follows:
     ```
     Client ID: coordinator-oauth
     Client Protocol: openid-connect
     Root URL: http://localhost:3005
     ```

3. **Configure Client Settings**
   - **Settings Tab:**
     - Client authentication: `ON`
     - Authorization: `OFF`
     - Authentication flow:
       - Standard flow: `ON`
       - Direct access grants: `ON`
     - Valid redirect URIs: `http://localhost:3005/api/auth/callback`
     - Web origins: `http://localhost:3005` and `http://localhost:3334`

   - **Credentials Tab:**
     - Copy the `Client Secret` and add to your `.env` file as `COORDINATOR_CLIENT_SECRET`

   - **Client Scopes Tab:**
     - Add default scopes: `openid`, `email`, `profile`

### Setting up GitHub Identity Provider

1. **Create GitHub OAuth App**
   - Go to GitHub → Settings → Developer settings → OAuth Apps
   - Click **New OAuth App**
   - Configure:
     ```
     Application name: Epsilon Keycloak
     Homepage URL: http://localhost:8080
     Authorization callback URL: http://localhost:8080/realms/epsilon/broker/github/endpoint
     ```
   - Copy the `Client ID` and `Client Secret`

2. **Configure GitHub in Keycloak**
   - In Keycloak Admin Console, go to **Identity Providers**
   - Click **Add provider** → **GitHub**
   - Configure:
     ```
     Client ID: [Your GitHub OAuth App Client ID]
     Client Secret: [Your GitHub OAuth App Client Secret]
     ```
   - Advanced Settings:
     - Trust Email: `ON`
     - Account linking only: `OFF`
     - Store tokens: `ON`
     - Sync mode: `Import`


### Key Components

- **Coordinator**: Frontend application that initiates OAuth flow and manages user sessions
- **API Service**: Backend service that handles business logic and protected resources
- **Keycloak**: Identity and Access Management server that handles authentication and authorization
- **GitHub**: External identity provider for social login

### Token Flow

1. User authenticates via GitHub through Keycloak
2. Keycloak issues JWT tokens containing user information
3. ResearchWorkspace stores tokens in session
4. API validates tokens for protected endpoints
5. Tokens can be refreshed using refresh tokens

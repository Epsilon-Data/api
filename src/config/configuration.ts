const { env } = process;

const trustedWebOrigins = () =>
  (
    env.EPSILON_AUTH_TRUSTED_WEB_ORIGIN ||
    'http://localhost:3000,http://localhost:3334'
  )
    .split(',')
    .map((origin) => origin.trim());

export default () => ({
  isDev: process.env.NODE_ENV === 'development' ? true : false,
  apiBaseUrl: env.API_BASE_URL || '/api/v1/hub',
  apiPort: parseInt(env.API_SERVICE_PORT) || 3334,
  brokerImage: env.BROKER_IMAGE || 'ghcr.io/epsilon-data/data-broker:latest',
  auth: {
    trustedWebOrigins: trustedWebOrigins(),
    issuerBaseURL:
      env.EPSILON_AUTH_URI || 'http://localhost:8080/realms/epsilon',
    // TODO: check changing for client-id
    audience: env.EPSILON_AUTH_AUDIENCE || 'epsilon.api',
    scopePrefix: env.EPSILON_AUTH_SCOPE_PREFIX || 'api.test',
    cookiePrefix: env.EPSILON_AUTH_COOKIE_PREFIX || 'epsilon',
    encryptionKey:
      env.EPSILON_AUTH_COOKIE_ENCRYPTION_KEY ||
      'e2c8470d07a8dcdcd07267e353e32805d87dd560ce93e2fae5c1869b7118e5a9',
    clientId: env.EPSILON_AUTH_CLIENT_ID || 'epsilon-token-handler',
  },
  admin: {
    issuerBaseURL: env.EPSILON_AUTH_ISSUER_BASE_URL || 'http://localhost:8080',
    realm: env.EPSILON_AUTH_REALM || 'epsilon',
    audience: env.EPSILON_AUTH_AUDIENCE || 'epsilon.api',
    scopePrefix: env.EPSILON_ADMIN_AUTH_SCOPE_PREFIX || 'api.permissions',
    clientId: env.EPSILON_ADMIN_API_CLIENT_ID || 'epsilon-admin-api',
    clientSecret:
      env.EPSILON_ADMIN_API_CLIENT_SECRET || '25WNchjDUsl9LWL6gZLLUaTQ1uIWMYMn',
    cookiePrefix: env.EPSILON_AUTH_COOKIE_PREFIX || 'epsilon',
    encryptionKey:
      env.EPSILON_AUTH_COOKIE_ENCRYPTION_KEY ||
      'e2c8470d07a8dcdcd07267e353e32805d87dd560ce93e2fae5c1869b7118e5a9',
    trustedWebOrigins: [
      env.EPSILON_AUTH_TRUSTED_WEB_ORIGIN || 'http://localhost:3000',
    ],
  },
  sdk: {
    clientId: env.EPSILON_SDK_CLIENT_ID || 'sdk-client',
    clientSecret:
      env.EPSILON_SDK_CLIENT_SECRET || '6nHzYqIlwcQDqDc2TuJtilucZxAH3O6N',
  },
  atlas: {
    // default values for local dev
    uri: env.ATLAS_URI || 'http://localhost:21000',
    adminPassword: env.ATLAS_ADMIN_PASSWORD || 'secret',
    adminUsername: env.ATLAS_ADMIN_USER || 'admin',
  },
  s3: {
    uri: env.S3_URI || 'http://localhost:9001',
    keyId: env.S3_KEY_ID || 'admin',
    secretKey: env.S3_SECRET_KEY || 'supersecret',
  },
  redis: {
    host: env.REDIS_HOST || 'localhost',
    port: env.REDIS_PORT || 6379,
  },
  notificationServiceUrl:
    env.NOTIFICATION_SERVICE_URL || 'http://localhost:4001/notification',
  databaseUrl:
    env.DATABASE_URL ||
    'postgresql://epsilon_admin:supersecret@localhost:6543/epsilon',
  tokenEndpoint:
    env.EPSILON_TOKEN_ENDPOINT ||
    'http://localhost:8080/realms/epsilon/protocol/openid-connect/token',
  coordinator: {
    clientId: env.COORDINATOR_CLIENT_ID || 'coordinator-oauth', // keycloak client id
    clientSecret: env.COORDINATOR_CLIENT_SECRET || 'supersecretcoordinator', // from Keycloak client "coordinator-client" credentials tab
    redirectUri: env.REDIRECT_URI || 'http://localhost:3005/api/auth/callback', // OAuth2 redirect URI for coordinator (Job Scheduler
  },
});

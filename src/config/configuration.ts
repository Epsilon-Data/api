const { env } = process;

const trustedWebOrigins = () =>
  (
    env.EPSILON_AUTH_TRUSTED_WEB_ORIGIN ||
    'http://localhost:3000,http://localhost:3334,http://localhost:4173/'
  )
    .split(',')
    .map((origin) => origin.trim());

const UPLOAD_MAX_FILE_SIZE = 10 * 1024 * 1024;

export default () => ({
  appUrl: env.APP_URL || 'http://localhost:3000',
  isDev: env.NODE_ENV === 'development' ? true : false,
  apiBaseUrl: env.API_BASE_URL || '/api/v1/hub',
  apiPort: parseInt(env.API_SERVICE_PORT || '3334'),
  brokerImage: env.BROKER_IMAGE || 'ghcr.io/epsilon-data/data-broker:latest',
  auth: {
    trustedWebOrigins: trustedWebOrigins(),
    issuerBaseURL:
      env.EPSILON_AUTH_URI || 'http://keycloak:8080/realms/epsilon',
    // TODO: check changing for client-id
    audience: env.EPSILON_AUTH_AUDIENCE || 'epsilon.api',
    cookiePrefix: env.EPSILON_AUTH_COOKIE_PREFIX || 'epsilon',
    encryptionKey:
      env.EPSILON_AUTH_COOKIE_ENCRYPTION_KEY ||
      'e2c8470d07a8dcdcd07267e353e32805d87dd560ce93e2fae5c1869b7118e5a9',
    clientId: env.EPSILON_AUTH_CLIENT_ID || 'epsilon-token-handler',
    allowTokenAuth: false,
  },
  admin: {
    issuerBaseURL: env.EPSILON_AUTH_ISSUER_BASE_URL || 'http://keycloak:8080',
    realm: env.EPSILON_AUTH_REALM || 'epsilon',
    audience: env.EPSILON_AUTH_AUDIENCE || 'epsilon.api',
    clientId: env.EPSILON_ADMIN_API_CLIENT_ID || 'epsilon-admin-api',
    clientSecret:
      env.EPSILON_ADMIN_API_CLIENT_SECRET || '25WNchjDUsl9LWL6gZLLUaTQ1uIWMYMn',
  },
  sdk: {
    clientId: env.EPSILON_SDK_CLIENT_ID || 'sdk-client',
    clientSecret:
      env.EPSILON_SDK_CLIENT_SECRET || '6nHzYqIlwcQDqDc2TuJtilucZxAH3O6N',
  },
  coordinator: {
    clientId: env.EPSILON_COORDINATOR_CLINET_ID || 'coordinator-client',
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
    port: parseInt(env.REDIS_PORT || '6379'),
  },
  notificationServiceUrl:
    env.NOTIFICATION_SERVICE_URL || 'http://localhost:4001/notification',
  databaseUrl:
    env.DATABASE_URL ||
    'postgresql://epsilon_admin:supersecret@localhost:6543/epsilon',
  tokenEndpoint:
    env.EPSILON_TOKEN_ENDPOINT ||
    'http://keycloak:8080/realms/epsilon/protocol/openid-connect/token',
  keystoreUrl: env.VAULT_API_ADDR || 'http://0.0.0.0:8200',
  openai: {
    apiKey: env.OPENAI_API_KEY || 'OPENAI_API_KEY must be set',
  },
  defaultProvider: env.DEFAULT_PROVIDER || 'openai',
  modelWhitelist: {
    openai: ['gpt-5-mini-2025-08-07', 'gpt-5-2025-08-07'],
  },
  upload: {
    maxSize: UPLOAD_MAX_FILE_SIZE,
    tmpDir: '/tmp/archetype-discovery',
  },
});

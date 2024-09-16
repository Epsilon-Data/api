const { env } = process;

export default () => ({
  apiBaseUrl: env.API_BASE_URL || '/api/v1/hub',
  apiPort: parseInt(env.API_SERVICE_PORT) || 3334,
  auth: {
    trustedWebOrigins: [
      env.EPSILON_AUTH_TRUSTED_WEB_ORIGIN || 'http://localhost:3000',
    ],
    issuerBaseURL:
      env.EPSILON_AUTH_ISSUER_BASE_URL ||
      'http://localhost:8080/realms/EPSILON',
    audience: env.EPSILON_AUTH_AUDIENCE || 'epsilon.api',
    scopePrefix: env.EPSILON_AUTH_SCOPE_PREFIX || 'api.test',
    cookiePrefix: env.EPSILON_AUTH_COOKIE_PREFIX || 'epsilon',
    encryptionKey:
      env.EPSILON_AUTH_COOKIE_ENCRYPTION_KEY ||
      'e2c8470d07a8dcdcd07267e353e32805d87dd560ce93e2fae5c1869b7118e5a9',
  },
  admin: {
    issuerBaseURL:
      env.EPSILON_AUTH_ISSUER_BASE_URL ||
      'http://localhost:8080/realms/EPSILON',
    realm: env.EPSILON_AUTH_REALM || 'EPSILON',
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
});

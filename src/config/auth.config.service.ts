import { Injectable } from '@nestjs/common';
const { env } = process;
import {
  AuthModuleConfig,
  AuthModuleConfigFactory,
} from 'src/auth/config.interface';

@Injectable()
export class AuthConfigService implements AuthModuleConfigFactory {
  createKeycloakConnectOptions(): AuthModuleConfig {
    return {
      trustedWebOrigins: [
        env.EPSILON_AUTH_TRUSTED_WEB_ORIGIN || 'http://localhost:3000',
      ],
      issuerBaseURL:
        env.EPSILON_AUTH_URI || 'http://keycloak:8080/realms/epsilon',
      // TODO: check changing for client-id
      audience: env.EPSILON_AUTH_AUDIENCE || 'epsilon.api',
      scopePrefix: env.EPSILON_AUTH_SCOPE_PREFIX || 'api.test',
      cookiePrefix: env.EPSILON_AUTH_COOKIE_PREFIX || 'epsilon',
      encryptionKey:
        env.EPSILON_AUTH_COOKIE_ENCRYPTION_KEY ||
        'e2c8470d07a8dcdcd07267e353e32805d87dd560ce93e2fae5c1869b7118e5a9',
      clientId: env.EPSILON_AUTH_CLIENT_ID || 'epsilon-token-handler',
      allowTokenAuth: true,
    };
  }
}

import { FactoryProvider, ModuleMetadata } from '@nestjs/common';

export const AUTH_CONFIG = 'AUTH_CONFIG';
export const KEYCLOAK_INSTANCE = 'KEYCLOAK_INSTANCE';
export const KEYCLOAK_CONNECT_OPTIONS = 'KEYCLOAK_CONNECT_OPTIONS';

export type AuthModuleConfig = {
  issuerBaseURL: string;
  audience: string;
  scopePrefix: string;
  cookiePrefix: string;
  encryptionKey: string;
  trustedWebOrigins: string[];
  allowTokenAuth: boolean;
};

export type AuthModuleAsyncConfig = Pick<ModuleMetadata, 'imports'> &
  Pick<FactoryProvider<AuthModuleConfig>, 'useFactory' | 'inject'>;

import { ModuleMetadata, Type } from '@nestjs/common';

export const AUTH_CONFIG = 'AUTH_CONFIG';
export const KEYCLOAK_INSTANCE = 'KEYCLOAK_INSTANCE';

export type AuthModuleConfig = {
  issuerBaseURL: string;
  audience: string;
  scopePrefix: string;
  cookiePrefix: string;
  encryptionKey: string;
  trustedWebOrigins: string[];
  allowTokenAuth: boolean;
  clientId: string;
};

export interface AuthModuleConfigFactory {
  createKeycloakConnectOptions(): Promise<AuthModuleConfig> | AuthModuleConfig;
}

// export type AuthModuleAsyncConfig = Pick<ModuleMetadata, 'imports'> &
//   Pick<FactoryProvider<AuthModuleConfig>, 'useFactory' | 'inject'>;

export interface AuthModuleAsyncConfig extends Pick<ModuleMetadata, 'imports'> {
  inject?: any[];
  useExisting?: Type<AuthModuleConfigFactory>;
  useClass?: Type<AuthModuleConfigFactory>;
  useFactory?: (...args: any[]) => Promise<AuthModuleConfig> | AuthModuleConfig;
}

import { FactoryProvider, ModuleMetadata, Type } from '@nestjs/common';

export const AUTH_CONFIG = 'AUTH_CONFIG';
export const AUTH_MODULE_CONFIG_FACTORY = 'ADMIN_MODULE_CONFIG_FACTORY';
export const KEYCLOAK_INSTANCE = 'KEYCLOAK_INSTANCE';

export type AuthModuleConfig = {
  issuerBaseURL: string;
  audience: string;
  cookiePrefix: string;
  encryptionKey: string;
  trustedWebOrigins: string[];
  allowTokenAuth: boolean;
  clientId: string;
};

export interface AuthModuleConfigFactory {
  createKeycloakConnectOptions(): Promise<AuthModuleConfig> | AuthModuleConfig;
}

export interface AuthModuleAsyncConfig extends Pick<ModuleMetadata, 'imports'> {
  inject?: FactoryProvider['inject'];
  useExisting?: Type<AuthModuleConfigFactory>;
  useClass?: Type<AuthModuleConfigFactory>;
  useFactory?: (
    ...args: unknown[]
  ) => Promise<AuthModuleConfig> | AuthModuleConfig;
}

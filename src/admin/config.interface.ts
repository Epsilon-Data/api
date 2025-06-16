import { ModuleMetadata, Type } from '@nestjs/common';

export const ADMIN_CONFIG = 'ADMIN_CONFIG';
export const KEYCLOAK_ADMIN_INSTANCE = 'KEYCLOAK_ADMIN_INSTANCE';

export type AdminModuleConfig = {
  issuerBaseURL: string;
  realm: string;
  audience: string;
  scopePrefix: string;
  clientId: string;
  clientSecret: string;
  cookiePrefix: string;
  encryptionKey: string;
  trustedWebOrigins: string[];
};
export interface AdminModuleConfigFactory {
  createKeycloakConnectOptions():
    | Promise<AdminModuleConfig>
    | AdminModuleConfig;
}

// export type AdminModuleAsyncConfig = Pick<ModuleMetadata, 'imports'> &
//   Pick<FactoryProvider<AdminModuleConfig>, 'useFactory' | 'inject'>;

export interface AdminModuleAsyncConfig
  extends Pick<ModuleMetadata, 'imports'> {
  inject?: any[];
  useExisting?: Type<AdminModuleConfigFactory>;
  useClass?: Type<AdminModuleConfigFactory>;
  useFactory?: (
    ...args: any[]
  ) => Promise<AdminModuleConfig> | AdminModuleConfig;
}

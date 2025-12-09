import { FactoryProvider, ModuleMetadata, Type } from '@nestjs/common';

export const ADMIN_CONFIG = 'ADMIN_CONFIG';
export const KEYCLOAK_ADMIN_INSTANCE = 'KEYCLOAK_ADMIN_INSTANCE';
export const ADMIN_MODULE_CONFIG_FACTORY = 'ADMIN_MODULE_CONFIG_FACTORY';

export type AdminModuleConfig = {
  issuerBaseURL: string;
  realm: string;
  audience: string;
  clientId: string;
  clientSecret: string;
};
export interface AdminModuleConfigFactory {
  createKeycloakAdminConnectOptions(): AdminModuleConfig;
}

export interface AdminModuleAsyncConfig
  extends Pick<ModuleMetadata, 'imports'> {
  inject?: FactoryProvider['inject'];
  useExisting?: Type<AdminModuleConfigFactory>;
  useClass?: Type<AdminModuleConfigFactory>;
  useFactory?: (
    ...args: unknown[]
  ) => Promise<AdminModuleConfig> | AdminModuleConfig;
}

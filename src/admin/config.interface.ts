import { FactoryProvider, ModuleMetadata } from '@nestjs/common';

export const AdminConfigInjectionToken = 'ADMIN_CONFIG';

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

export type AdminModuleAsyncConfig = Pick<ModuleMetadata, 'imports'> &
  Pick<FactoryProvider<AdminModuleConfig>, 'useFactory' | 'inject'>;

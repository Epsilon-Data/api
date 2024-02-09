import { FactoryProvider, ModuleMetadata } from '@nestjs/common';

export const ConfigInjectionToken = 'ConfigInjectionToken';

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

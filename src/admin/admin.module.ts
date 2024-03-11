import { DynamicModule, Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { KeycloakService } from './keycloak/keycloak.service';

import { ConfigModule, ConfigService } from '@nestjs/config';
import {
  AdminConfigInjectionToken,
  AdminModuleAsyncConfig,
  AdminModuleConfig,
} from './config.interface';
import { AdminController } from './admin.controller';

@Module({
  imports: [ConfigModule],
  controllers: [AdminController],
  providers: [AdminService, KeycloakService],
})
export class AdminModule {
  constructor(private configService: ConfigService) {}
  static forRoot({
    issuerBaseURL,
    realm,
    audience,
    scopePrefix,
    clientId,
    clientSecret,
    cookiePrefix,
    encryptionKey,
    trustedWebOrigins,
  }: AdminModuleConfig): DynamicModule {
    return {
      providers: [
        {
          useValue: {
            issuerBaseURL,
            realm,
            audience,
            scopePrefix,
            clientId,
            clientSecret,
            cookiePrefix,
            encryptionKey,
            trustedWebOrigins,
          },
          provide: AdminConfigInjectionToken,
        },
        KeycloakService,
        AdminService,
      ],
      exports: [AdminService],
      imports: [],
      module: AdminModule,
    };
  }
  static forRootAsync(config: AdminModuleAsyncConfig): DynamicModule {
    return {
      module: AdminModule,
      imports: config.imports,
      providers: [
        {
          useFactory: config.useFactory,
          inject: config.inject,
          provide: AdminConfigInjectionToken,
        },
        KeycloakService,
        AdminService,
      ],
      exports: [AdminService],
    };
  }
}

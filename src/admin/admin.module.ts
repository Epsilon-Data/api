import { DynamicModule, Global, Module, Provider } from '@nestjs/common';
import { AdminService } from './admin.service';
import { KeycloakAdminService } from './keycloak/keycloak-admin.service';

import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from 'src/prisma/prisma.module';
import { ArchetypeModule } from 'src/archetype/archetype.module';
import {
  ADMIN_CONFIG,
  ADMIN_MODULE_CONFIG_FACTORY,
  AdminModuleAsyncConfig,
  AdminModuleConfig,
  AdminModuleConfigFactory,
  KEYCLOAK_ADMIN_INSTANCE,
} from './admin-config.interface';
import { AdminController } from './admin.controller';
import { KeycloakAdminClient } from '@epsilon-data/keycloak-admin-client';
import { AdminConfigService } from 'src/config/admin-config.service';

@Global()
@Module({
  imports: [ConfigModule, PrismaModule, ArchetypeModule],
  controllers: [AdminController],
  providers: [AdminConfigService],
})
export class AdminModule {
  static forRoot(config: AdminModuleConfig): DynamicModule {
    const adminConfigProvider: Provider = {
      provide: ADMIN_CONFIG,
      useValue: config,
    };

    const keycloakProvider: Provider = {
      provide: KEYCLOAK_ADMIN_INSTANCE,
      useFactory: (adminConfig: AdminModuleConfig) =>
        new KeycloakAdminClient({
          baseUrl: adminConfig.issuerBaseURL,
          realmName: adminConfig.realm,
        }),
      inject: [ADMIN_CONFIG],
    };
    return {
      providers: [
        adminConfigProvider,
        keycloakProvider,
        KeycloakAdminService,
        AdminService,
      ],
      exports: [
        AdminService,
        KeycloakAdminService,
        ADMIN_CONFIG,
        KEYCLOAK_ADMIN_INSTANCE,
      ],
      imports: [ConfigModule, PrismaModule, ArchetypeModule],
      module: AdminModule,
    };
  }
  static forRootAsync(config: AdminModuleAsyncConfig): DynamicModule {
    const asyncProviders = this.createAsyncProviders(config);
    return {
      module: AdminModule,
      imports: [
        ConfigModule,
        PrismaModule,
        ArchetypeModule,
        ...(config.imports ?? []),
      ],
      providers: [
        ...asyncProviders,
        AdminConfigService,
        AdminService,
        KeycloakAdminService,
      ],
      exports: [
        AdminService,
        KeycloakAdminService,
        ADMIN_CONFIG,
        KEYCLOAK_ADMIN_INSTANCE,
      ],
    };
  }

  private static createAsyncProviders(
    config: AdminModuleAsyncConfig,
  ): Provider[] {
    // ADMIN_CONFIG provider
    const adminConfigProvider: Provider =
      this.createAdminConfigProvider(config);

    // KEYCLOAK_ADMIN_INSTANCE provider
    const keycloakProvider: Provider = {
      provide: KEYCLOAK_ADMIN_INSTANCE,
      useFactory: (adminConfig: AdminModuleConfig) =>
        new KeycloakAdminClient({
          baseUrl: adminConfig.issuerBaseURL,
          realmName: adminConfig.realm,
        }),
      inject: [ADMIN_CONFIG],
    };

    // optional provider for useClass
    const extraProviders: Provider[] = [];
    if (config.useClass) {
      extraProviders.push({
        provide: ADMIN_MODULE_CONFIG_FACTORY,
        useClass: config.useClass,
      });
    }

    return [adminConfigProvider, keycloakProvider, ...extraProviders];
  }

  private static createAdminConfigProvider(
    config: AdminModuleAsyncConfig,
  ): Provider {
    if (config.useFactory) {
      return {
        provide: ADMIN_CONFIG,
        useFactory: config.useFactory,
        inject: config.inject ?? [],
      };
    }
    if (config.useExisting) {
      return {
        provide: ADMIN_CONFIG,
        useFactory: (factory: AdminModuleConfigFactory) =>
          factory.createKeycloakAdminConnectOptions(),
        inject: [config.useExisting],
      };
    }
    if (config.useClass) {
      return {
        provide: ADMIN_CONFIG,
        useFactory: (factory: AdminModuleConfigFactory) =>
          factory.createKeycloakAdminConnectOptions(),
        inject: [ADMIN_MODULE_CONFIG_FACTORY],
      };
    }

    throw new Error(
      'Invalid AdminModuleAsyncConfig: must provide useFactory, useExisting, or useClass',
    );
  }
}

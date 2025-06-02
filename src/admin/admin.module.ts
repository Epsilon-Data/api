import { DynamicModule, Global, Module, Provider } from '@nestjs/common';
import { AdminService } from './admin.service';
import { KeycloakAdminService } from './keycloak/keycloak.admin.service';

import { ConfigModule, ConfigService } from '@nestjs/config';
import {
  ADMIN_CONFIG,
  AdminModuleAsyncConfig,
  AdminModuleConfig,
  KEYCLOAK_ADMIN_INSTANCE,
} from './config.interface';
import { AdminController } from './admin.controller';
import { KeycloakAdminClient } from '@epsilon-data/keycloak-admin-client';

@Global()
@Module({
  imports: [ConfigModule],
  controllers: [AdminController],
  exports: [KeycloakAdminService],
  providers: [AdminService, KeycloakAdminService],
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
          provide: ADMIN_CONFIG,
        },
        KeycloakAdminService,
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
      providers: this.createAsyncProviders(config),
      exports: this.createAsyncProviders(config),
    };
  }

  private static createAsyncProviders(
    config: AdminModuleAsyncConfig,
  ): Provider[] {
    const reqProviders = [
      {
        // TODO: remove this if not needed
        useFactory: async (configService: ConfigService) => {
          return {
            issuerBaseURL: configService.get<string>('admin.issuerBaseURL'),
            realm: configService.get<string>('admin.realm'),
            audience: configService.get<string>('admin.audience'),
            scopePrefix: configService.get<string>('admin.scopePrefix'),
            clientId: configService.get<string>('admin.clientId'),
            clientSecret: configService.get<string>('admin.clientSecret'),
            cookiePrefix: configService.get<string>('admin.cookiePrefix'),
            encryptionKey: configService.get<string>('admin.encryptionKey'),
            trustedWebOrigins: configService.get<string[]>(
              'admin.trustedWebOrigins',
            ),
          };
        },
        inject: config.inject,
        provide: ADMIN_CONFIG,
      },
      {
        useFactory: async (config: AdminModuleConfig) => {
          const credentials = {
            grantType: 'client_credentials',
            clientId: config.clientId,
            clientSecret: config.clientSecret,
          };
          const kcAdminClient: any = new KeycloakAdminClient({
            baseUrl: config.issuerBaseURL,
            realmName: config.realm,
          });
          // init keycloak admin client
          await kcAdminClient.auth(credentials);
          return kcAdminClient;
        },
        inject: [ADMIN_CONFIG],
        provide: KEYCLOAK_ADMIN_INSTANCE,
      },
      KeycloakAdminService,
      AdminService,
    ];

    if (config.useExisting || config.useFactory) {
      return reqProviders;
    }

    return [
      ...reqProviders,
      {
        provide: config.useClass,
        useClass: config.useClass,
      },
    ];
  }
}

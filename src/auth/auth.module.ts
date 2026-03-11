import {
  DynamicModule,
  Global,
  MiddlewareConsumer,
  Module,
  NestModule,
  Provider,
  RequestMethod,
} from '@nestjs/common';

import { AuthMiddleware } from './auth.middleware';
import {
  AuthModuleAsyncConfig,
  AuthModuleConfig,
  AUTH_CONFIG,
  AUTH_MODULE_CONFIG_FACTORY,
  AuthModuleConfigFactory,
} from './config.interface';

import { auth } from 'express-oauth2-jwt-bearer';
import cookieParser from 'cookie-parser';

import { ConfigModule, ConfigService } from '@nestjs/config';
import { KeycloakService } from './keycloak/keycloak.service';
import { AuthConfigService } from 'src/config/auth-config.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [AuthConfigService, KeycloakService],
  exports: [KeycloakService],
})
export class AuthModule implements NestModule {
  constructor(private configService: ConfigService) {}
  configure(consumer: MiddlewareConsumer) {
    const excludes = [
      { path: 'health', method: RequestMethod.GET },
      { path: 'analysis/auth', method: RequestMethod.POST }, // analysis sdk auth path
      { path: 'coordinator/auth', method: RequestMethod.POST }, // coordinator client auth path
      { path: 'proxy/register', method: RequestMethod.POST }, // proxy binary registration
      { path: 'proxy/heartbeat', method: RequestMethod.POST }, // proxy binary heartbeat
      { path: 'proxy/metadata', method: RequestMethod.POST }, // proxy binary metadata upload
      { path: 'proxy/offline', method: RequestMethod.POST }, // proxy binary shutdown
    ];

    // only add docs if dev
    if (this.configService.get<boolean>('isDev')) {
      excludes.push(
        { path: 'docs', method: RequestMethod.GET },
        { path: 'docs/*path', method: RequestMethod.GET },
      );
    }

    consumer
      .apply(
        // TODO: investigate this
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument
        cookieParser(),
        AuthMiddleware,
        auth({
          issuerBaseURL: this.configService.get<string>('auth.issuerBaseURL'),
          audience: this.configService.get<string>('auth.audience'),
        }),
      )
      .exclude(...excludes)
      .forRoutes('*path');
  }

  static forRoot({
    issuerBaseURL,
    audience,
    cookiePrefix,
    encryptionKey,
    trustedWebOrigins,
    allowTokenAuth,
  }: AuthModuleConfig): DynamicModule {
    return {
      providers: [
        {
          useValue: {
            issuerBaseURL,
            audience,
            cookiePrefix,
            encryptionKey,
            trustedWebOrigins,
            allowTokenAuth,
          },
          provide: AUTH_CONFIG,
        },
        KeycloakService,
      ],
      exports: [KeycloakService],
      imports: [],
      module: AuthModule,
    };
  }
  static forRootAsync(config: AuthModuleAsyncConfig): DynamicModule {
    return {
      module: AuthModule,
      imports: config.imports,
      providers: this.createAsyncProviders(config),
      exports: this.createAsyncProviders(config),
    };
  }

  private static createAsyncProviders(
    config: AuthModuleAsyncConfig,
  ): Provider[] {
    // AUTH_CONFIG provider
    const authConfigProvider: Provider = this.createAuthConfigProvider(config);

    const extraProviders: Provider[] = [];
    if (config.useClass) {
      extraProviders.push({
        provide: AUTH_MODULE_CONFIG_FACTORY,
        useClass: config.useClass,
      });
    }

    return [authConfigProvider, KeycloakService, ...extraProviders];
  }
  private static createAuthConfigProvider(
    config: AuthModuleAsyncConfig,
  ): Provider {
    if (config.useFactory) {
      return {
        provide: AUTH_CONFIG,
        useFactory: config.useFactory,
        inject: config.inject ?? [],
      };
    }
    if (config.useExisting) {
      return {
        provide: AUTH_CONFIG,
        useFactory: (factory: AuthModuleConfigFactory) =>
          factory.createKeycloakConnectOptions(),
        inject: [config.useExisting],
      };
    }
    if (config.useClass) {
      return {
        provide: AUTH_CONFIG,
        useFactory: (factory: AuthModuleConfigFactory) =>
          factory.createKeycloakConnectOptions(),
        inject: [AUTH_MODULE_CONFIG_FACTORY],
      };
    }

    throw new Error(
      'Invalid AuthModuleAsyncConfig: must provide useFactory, useExisting, or useClass',
    );
  }
}

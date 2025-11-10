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
} from './config.interface';

import { auth } from 'express-oauth2-jwt-bearer';
import cookieParser from 'cookie-parser';

import { ConfigModule, ConfigService } from '@nestjs/config';
import { KeycloakService } from './keycloak/keycloak.service';

@Global()
@Module({
  imports: [ConfigModule],
  controllers: [],
  exports: [KeycloakService],
  providers: [KeycloakService],
})
export class AuthModule implements NestModule {
  constructor(private configService: ConfigService) {}
  configure(consumer: MiddlewareConsumer) {
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
      .exclude(
        { path: 'health', method: RequestMethod.GET },
        { path: 'docs', method: RequestMethod.GET },
        { path: 'docs/*path', method: RequestMethod.GET },
        { path: 'analysis/*path', method: RequestMethod.ALL },
      )
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
    const reqProviders = [
      {
        useFactory: (configService: ConfigService) => {
          return {
            issuerBaseURL: configService.get<string>('auth.issuerBaseURL'),
            audience: configService.get<string>('auth.audience'),
            scopePrefix: configService.get<string>('auth.scopePrefix'),
            cookiePrefix: configService.get<string>('auth.cookiePrefix'),
            encryptionKey: configService.get<string>('auth.encryptionKey'),
            trustedWebOrigins: configService.get<string[]>(
              'auth.trustedWebOrigins',
            ),
            allowTokenAuth:
              configService.get<boolean>('auth.allowTokenAuth') || true,
            clientId: configService.get<string>('auth.clientId'),
          };
        },
        inject: config.inject,
        provide: AUTH_CONFIG,
      },
      KeycloakService,
    ];
    if (config.useExisting || config.useFactory) {
      return reqProviders;
    }

    return [
      ...reqProviders,
      ...(config.useClass
        ? [
            {
              provide: AUTH_MODULE_CONFIG_FACTORY,
              useClass: config.useClass,
            } satisfies Provider,
          ]
        : []),
    ];
  }
}

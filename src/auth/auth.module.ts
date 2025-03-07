import {
  DynamicModule,
  MiddlewareConsumer,
  Module,
  NestModule,
  Provider,
  RequestMethod,
} from '@nestjs/common';
import { AuthService } from './auth.service';

import { AuthMiddleware } from './auth.middleware';
import {
  AuthModuleAsyncConfig,
  AuthModuleConfig,
  ConfigInjectionToken,
  KEYCLOAK_INSTANCE,
} from './config.interface';

import { auth } from 'express-oauth2-jwt-bearer';
import * as cookieParser from 'cookie-parser';

import { ConfigModule, ConfigService } from '@nestjs/config';
import * as KeycloakConnect from 'keycloak-connect';

@Module({
  imports: [ConfigModule],
  controllers: [],
  providers: [AuthService],
})
export class AuthModule implements NestModule {
  constructor(private configService: ConfigService) {}
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(
        cookieParser(),
        AuthMiddleware,
        auth({
          issuerBaseURL: this.configService.get<string>('auth.issuerBaseURL'),
          audience: this.configService.get<string>('auth.audience'),
        }),
      )
      .exclude({ path: 'health', method: RequestMethod.GET })
      .forRoutes('*');
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
          provide: ConfigInjectionToken,
        },
      ],
      exports: [],
      module: AuthModule,
    };
  }
  static forRootAsync(config: AuthModuleAsyncConfig): DynamicModule {
    return {
      module: AuthModule,
      imports: config.imports,
      providers: this.createProviders(config),
      exports: this.createProviders(config),
    };
  }

  private static createProviders(config: AuthModuleAsyncConfig): Provider[] {
    return [
      {
        useFactory: config.useFactory,
        inject: config.inject,
        provide: ConfigInjectionToken,
      },
      {
        useFactory: (opts: ConfigService) => {
          const configuration = {
            realm: 'EPSILON',
            'auth-server-url': 'http://localhost:8080/',
            'ssl-required': 'external',
            'confidential-port': 0,
            // 'public-client': true,
            // 'client-id': opts.get<string>('auth.clientId'),
            // credentials: { secret: opts.get<string>('auth.clientSecret') },
            // 'verify-token-audience': true,
            'bearer-only': true,
            resource: opts.get<string>('auth.clientId'),
          };
          console.log(configuration);
          const keycloak: any = new KeycloakConnect({}, configuration);

          // Access denied is called, add a flag to request so our resource guard knows
          keycloak.accessDenied = (req: any, res: any, next: any) => {
            req.resourceDenied = true;
            next();
          };

          return keycloak;
        },
        inject: config.inject,
        provide: KEYCLOAK_INSTANCE,
      },
    ];
  }
}

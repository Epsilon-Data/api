import {
  DynamicModule,
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { AuthService } from './auth.service';

import { AuthMiddleware } from './auth.middleware';
import {
  AuthModuleAsyncConfig,
  AuthModuleConfig,
  ConfigInjectionToken,
} from './config.interface';

import { auth } from 'express-oauth2-jwt-bearer';
import * as cookieParser from 'cookie-parser';

import { ConfigModule, ConfigService } from '@nestjs/config';

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
      .exclude({ path: 'docs', method: RequestMethod.GET })
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
      providers: [
        {
          useFactory: config.useFactory,
          inject: config.inject,
          provide: ConfigInjectionToken,
        },
      ],
      exports: [],
    };
  }
}

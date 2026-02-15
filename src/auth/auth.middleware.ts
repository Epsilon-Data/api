import { Inject, Injectable, NestMiddleware } from '@nestjs/common';
import { AUTH_CONFIG } from './config.interface';
import type { AuthModuleConfig } from './config.interface';
import { Request, Response, NextFunction } from 'express';

import { addToken } from '@epsilon-data/epsilon-api-middleware';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  constructor(
    @Inject(AUTH_CONFIG) private readonly config: AuthModuleConfig,
    private configService: ConfigService,
  ) {}

  use(request: Request, response: Response, next: NextFunction) {
    const apiBaseUrl = this.configService.get<string>('apiBaseUrl');
    const allowTokenAuth =
      request.method === 'GET' &&
      (request.originalUrl.startsWith(`${apiBaseUrl}/analysis`) ||
        request.originalUrl.startsWith(`${apiBaseUrl}/coordinator`) ||
        request.originalUrl.startsWith(`${apiBaseUrl}/admin`))
        ? true
        : false;
    return addToken(
      this.config.encryptionKey,
      this.config.cookiePrefix,
      this.config.trustedWebOrigins,
      allowTokenAuth,
    )(request, response, next);
  }
}

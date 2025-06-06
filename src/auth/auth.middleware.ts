import { Inject, Injectable, NestMiddleware } from '@nestjs/common';
import { AuthModuleConfig, AUTH_CONFIG } from './config.interface';
import { Request, Response, NextFunction } from 'express';

import { addToken } from '@epsilon-data/epsilon-api-middleware';
// import { cookieHandler } from 'src/middleware';

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  constructor(@Inject(AUTH_CONFIG) private config: AuthModuleConfig) {
    this.config = config;
  }
  use(request: Request, response: Response, next: NextFunction) {
    return addToken(
      this.config.encryptionKey,
      this.config.cookiePrefix,
      this.config.trustedWebOrigins,
      this.config.allowTokenAuth,
    )(request, response, next);
  }
}

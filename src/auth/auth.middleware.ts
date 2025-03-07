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
    //   // check if authToken already exists
    //   if (this.config.allowTokenAuth && request.headers['authorization']) {
    //     return next();
    //   }
    //   // check for origin
    //   const origin = request.header('origin');
    //   if (
    //     origin &&
    //     this.config.trustedWebOrigins.findIndex((value) => value === origin) == -1
    //   )
    //     next(
    //       UnauthorizedException(
    //         `Request was not from a trusted origin: ${origin}`,
    //       ),
    //     );

    //   // CSRF check
    //   if (['POST', 'PUT', 'PATH', 'DELETE'].includes(request.method)) {
    //     const csrfCookie = request.cookies[`${this.config.cookiePrefix}-csrf`];
    //     const csrfHeader = request.header(`x-${this.config.cookiePrefix}-csrf`);
    //     if (!csrfCookie || !csrfCookie)
    //       next(UnauthorizedException('No CSRF cookie or header found'));
    //     try {
    //       const decryptedCsrfCookie = decryptCookie(
    //         this.config.encryptionKey,
    //         csrfCookie,
    //       );
    //       if (decryptedCsrfCookie !== csrfHeader)
    //         next(
    //           UnauthorizedException(
    //             'The request CSRF header did not match with the CSRF cookie',
    //           ),
    //         );
    //     } catch (error: any) {
    //       next(CookieDecryptionException(`Error decrypting CSRF cookie`, error));
    //     }
    //   }

    //   // check for access token cookie
    //   const atCookie = request.cookies[`${this.config.cookiePrefix}-at`];
    //   if (!atCookie) {
    //     next(UnauthorizedException('No authorisation cookie found'));
    //   }

    //   try {
    //     // decrypt cookie and add as auth header auth token
    //     const decryptedAtCookie = decryptCookie(
    //       this.config.encryptionKey,
    //       atCookie,
    //     );

    //     request.headers[`authorization`] = `Bearer ${decryptedAtCookie}`;
    //   } catch (error: any) {
    //     next(
    //       CookieDecryptionException(
    //         `Error decrypting authorization cookie: ${error}`,
    //         error,
    //       ),
    //     );
    //   }
    //   next();
  }
}

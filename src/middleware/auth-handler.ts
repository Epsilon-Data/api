import cors from 'cors';
import cookieParser from 'cookie-parser';
import { auth } from 'express-oauth2-jwt-bearer';

import { decryptCookie } from './cookieEncrypter';

import { NextFunction, Request, Response } from 'express';
import { CookieDecryptionException, UnauthorizedException } from './exceptions';

export const cookieHandler = (
  issuerBaseURL: string,
  audience: string,
  encryptionKey: string,
  cookiePrefix: string,
  trustedWebOrigins: string[],
  allowTokenAuth = true,
) => [
  // cors middleware
  cors({ origin: trustedWebOrigins, credentials: true }),
  // cookie parser middleware
  cookieParser(),
  // convert cookie to token and add to header
  addToken(encryptionKey, cookiePrefix, trustedWebOrigins, allowTokenAuth),
  // auth
  auth({ issuerBaseURL, audience }),
];

const addToken =
  (
    encryptionKey: string,
    cookiePrefix: string,
    trustedWebOrigins: string[],
    allowTokenAuth: boolean,
  ) =>
  (
    request: Readonly<Request>,
    _response: Readonly<Response>,
    next: NextFunction,
  ) => {
    // check if authToken already exists
    if (allowTokenAuth && request.headers['authorization']) {
      return next();
    }
    // check for origin
    const origin = request.header('origin');
    if (
      origin &&
      trustedWebOrigins.findIndex((value) => value === origin) == -1
    )
      next(
        UnauthorizedException(
          `Request was not from a trusted origin: ${origin}`,
        ),
      );

    // CSRF check
    if (['POST', 'PUT', 'PATH', 'DELETE'].includes(request.method)) {
      const csrfCookie = request.cookies[`${cookiePrefix}-csrf`];
      const csrfHeader = request.header(`x-${cookiePrefix}-csrf`);
      if (!csrfCookie || !csrfCookie)
        next(UnauthorizedException('No CSRF cookie or header found'));
      try {
        const decryptedCsrfCookie = decryptCookie(csrfCookie, encryptionKey);
        if (decryptedCsrfCookie !== csrfHeader)
          next(
            UnauthorizedException(
              'The request CSRF header did not match with the CSRF cookie',
            ),
          );
      } catch (error: any) {
        next(CookieDecryptionException(`Error decrypting CSRF cookie`, error));
      }
    }

    // check for access token cookie
    const atCookie = request.cookies[`${cookiePrefix}-at`];

    if (!atCookie) {
      next(UnauthorizedException('No authorisation cookie found'));
    }

    try {
      // decrypt cookie and add as auth header auth token
      const decryptedAtCookie = decryptCookie(atCookie, encryptionKey);

      request.headers[`authorization`] = `Bearer ${decryptedAtCookie}`;
    } catch (error: any) {
      next(
        CookieDecryptionException(
          `Error decrypting authorization cookie`,
          error,
        ),
      );
    }
    next();
  };

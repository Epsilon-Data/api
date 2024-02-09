/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextFunction, Request, Response } from 'express';
// import { configuration } from '../configuration'
// import { CookieType, cookieHandler } from '../lib'
import { TokenHandlerException } from './exceptions';
import { UnhandledException } from './exceptions';
import { RequestLogOptions, startRequestLog, writeOutput } from './requestLog';

const exceptionMiddleware = (
  caught: Readonly<TokenHandlerException>,
  req: Readonly<Request>,
  res: Readonly<Response>,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void => {
  // const {
  //   cookies: { options, cookieNamePrefix },
  //   apiPrefix,
  // } = configuration

  // const exception =
  //   caught instanceof OAuthAgentException
  //     ? caught
  //     : new UnhandledException(caught)
  const exception =
    caught.handled || caught.statusCode
      ? caught
      : UnhandledException(caught.toString(), undefined, undefined, false);

  if (!res.locals.log) {
    // For malformed JSON errors, middleware does not get created so write the whole log here
    // res.locals.log = new RequestLog()
    // res.locals.log.start(req)
    // res.locals.log.addError(exception)
    // res.locals.log.end(res)
    const startOptions: RequestLogOptions = startRequestLog(req);
    writeOutput(res.statusCode, startOptions, exception);
  } else {
    // Otherwise just write exception to log
    res.locals.log = exception;
  }

  const statusCode = exception.statusCode;
  const data = { code: exception.code, message: exception.message };

  // // Send the error response to the client and remove cookies when the session expires
  // res.status(statusCode)

  // const { getCookiesForUnset } = cookieHandler('')
  // if (data.code === 'session_expired') {
  //   const internalCookieNames = [
  //     'login',
  //     'refresh',
  //     'id',
  //   ] as readonly CookieType[]
  //   const cookieNames = ['at', 'at-expires', 'csrf'] as readonly CookieType[]

  //   res.setHeader(
  //     'Set-Cookie',
  //     getCookiesForUnset(
  //       options,
  //       cookieNamePrefix,
  //       cookieNames,
  //       apiPrefix,
  //     ).concat(
  //       getCookiesForUnset(
  //         // use api prefix path and empty domain for internal
  //         { ...options, path: apiPrefix, domain: '' },
  //         cookieNamePrefix,
  //         internalCookieNames,
  //         apiPrefix,
  //       ),
  //     ),
  //   )
  // }
  // res.send(data)
  res.status(statusCode).send(data);
};

/*
 * Unhandled promise rejections may not be caught properly
 * https://medium.com/@Abazhenov/using-async-await-in-express-with-node-8-b8af872c0016
 */
export const asyncCatch = (fn: any) => {
  return (
    request: Readonly<Request>,
    response: Readonly<Response>,
    next: NextFunction,
  ) => {
    Promise.resolve(fn(request, response, next)).catch((e) => {
      exceptionMiddleware(e, request, response, next);
    });
  };
};

export default exceptionMiddleware;

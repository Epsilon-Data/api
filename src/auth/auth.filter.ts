import { ExceptionFilter, Catch, ArgumentsHost } from '@nestjs/common';
import { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import {
  ApiException,
  exceptionMiddleware,
} from '@epsilon-data/epsilon-api-middleware';

@Catch()
export class AuthExceptionFilter implements ExceptionFilter {
  handler: ErrorRequestHandler;

  constructor() {
    this.handler = exceptionMiddleware;
  }

  catch(exception: Error, host: ArgumentsHost) {
    const ctx = host.switchToHttp();

    const resp = ctx.getResponse<Response>();
    if (resp.headersSent) {
      return;
    }

    this.handler(
      exception as ApiException,
      ctx.getRequest<Request>(),
      resp,
      ctx.getNext<NextFunction>(),
    );
  }
}

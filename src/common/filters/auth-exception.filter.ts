// TODO: clean up the error handling also with epsilon-middleware used by token handler
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import {
  ApiException,
  exceptionMiddleware,
} from '@epsilon-data/epsilon-api-middleware';

interface KeycloakNetworkError extends Error {
  response?: {
    status?: number;
    statusText?: string;
    url?: string;
    code?: string;
  };
  responseData?: unknown;
}

function isKeycloakNetworkError(e: unknown): e is KeycloakNetworkError {
  if (!e || typeof e !== 'object') return false;

  const err = e as Error;

  // Check by name / constructor name and presence of fields
  return (
    (err.name === 'NetworkError' || err.constructor?.name === 'NetworkError') &&
    ('response' in err || 'responseData' in err)
  );
}

@Catch()
export class AuthExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(AuthExceptionFilter.name);
  private handler: ErrorRequestHandler;

  constructor() {
    this.handler = exceptionMiddleware;
  }

  catch(exception: Error, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    if (response.headersSent) {
      return;
    }

    if (isKeycloakNetworkError(exception)) {
      // Map Keycloak error -  HTTP response
      const status =
        exception.response?.status && exception.response.status >= 400
          ? exception.response.status
          : HttpStatus.BAD_GATEWAY;
      // Log all keycloak error details to console
      this.logger.error(
        `Keycloak error (${status}) ${request.method} ${request.url}`,
        {
          keycloakErrorName: exception.name,
          keycloakErrorMessage: (exception as Error).message,
          keycloakStatus: exception.response?.status,
          keycloakStatusText: exception.response?.statusText,
          keycloakUrl: exception.response?.url,
          details: exception.responseData ?? null,
          stack: (exception as Error).stack,
        } as unknown as string,
      );
      return response.status(status).json({
        statusCode: status,
        message: 'Invalid user credentials',
        error: 'AuthorisationServiceError',
      });
    }

    this.handler(
      exception as ApiException,
      ctx.getRequest<Request>(),
      response,
      ctx.getNext<NextFunction>(),
    );
  }
}

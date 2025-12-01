import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

interface NormalizedHttpErrorBody {
  statusCode: number;
  message: string | string[];
  error: string;
}

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: HttpException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse(); // string | object

    let message: string | string[];
    let errorName: string;

    if (typeof exceptionResponse === 'string') {
      // e.g. throw new NotFoundException('My message')
      message = exceptionResponse;
      errorName = exception.name;
    } else {
      const resObj = exceptionResponse as {
        message?: string | string[];
        error?: string;
        [key: string]: unknown;
      };

      message = resObj.message ?? exception.message;
      errorName = resObj.error ?? exception.name;
    }

    // Log full details to API console
    this.logger.error(
      `HttpException (${status}) ${request.method} ${request.url}`,
      JSON.stringify(
        {
          httpExceptionName: exception.name,
          status,
          message,
          originalResponse: exceptionResponse,
          stack: exception.stack,
        },
        null,
        2,
      ),
    );

    const body: NormalizedHttpErrorBody = {
      statusCode: status,
      message,
      error: errorName,
    };

    response.status(status).json(body);
  }
}

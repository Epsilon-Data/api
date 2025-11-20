import {
  ArgumentsHost,
  Catch,
  ConflictException,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';

interface GenericErrorResponseBody {
  statusCode: number;
  message: string;
  error: string;
}

/**
 * Build a generic client-facing message for DB errors based on status code.
 */
function buildGenericDatabaseMessage(status: number): string {
  if ((status as HttpStatus) === HttpStatus.NOT_FOUND) {
    return 'Requested resource could not be found';
  }

  if ((status as HttpStatus) === HttpStatus.BAD_REQUEST) {
    return 'Invalid request data for database operation';
  }

  if ((status as HttpStatus) === HttpStatus.CONFLICT) {
    return 'Conflict while performing database operation';
  }

  if (status >= 500) {
    return 'Database is temporarily unavailable';
  }

  return 'Unexpected database error';
}

@Catch(
  Prisma.PrismaClientKnownRequestError,
  Prisma.PrismaClientValidationError,
  Prisma.PrismaClientUnknownRequestError,
)
export class PrismaClientExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaClientExceptionFilter.name);

  catch(
    exception:
      | Prisma.PrismaClientKnownRequestError
      | Prisma.PrismaClientValidationError
      | Prisma.PrismaClientUnknownRequestError,
    host: ArgumentsHost,
  ) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let mapped: HttpException;

    // Validation errors (schema / query misuse)
    if (exception instanceof Prisma.PrismaClientValidationError) {
      mapped = new BadRequestException(
        'Invalid request data for database operation',
      );
    }
    // Known request errors via code
    else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      switch (exception.code) {
        case 'P2025': {
          // Record not found
          mapped = new NotFoundException('Resource not found');
          break;
        }

        case 'P2002': {
          // Unique constraint violation
          mapped = new ConflictException(
            'Unique constraint violation on resource',
          );
          break;
        }

        case 'P2003': {
          // Foreign key constraint
          mapped = new ConflictException(
            'Referential integrity constraint violation',
          );
          break;
        }

        default: {
          mapped = new InternalServerErrorException(
            'Unexpected database error',
          );
          break;
        }
      }
    }
    // Unknown request error
    else {
      mapped = new InternalServerErrorException('Unexpected database error');
    }

    const status = mapped.getStatus();

    // Log all prisma error details to console
    this.logger.error(
      `Prisma error (${status}) ${request.method} ${request.url}`,
      JSON.stringify(
        {
          prismaErrorName: exception.name,
          prismaErrorMessage: (exception as Error).message,
          prismaErrorCode: (exception as Prisma.PrismaClientKnownRequestError)
            .code,
          prismaErrorMeta: (exception as Prisma.PrismaClientKnownRequestError)
            .meta,
          stack: (exception as Error).stack,
        },
        null,
        2,
      ),
    );

    // Generic body for frontend
    const genericBody: GenericErrorResponseBody = {
      statusCode: status,
      message: buildGenericDatabaseMessage(status),
      error: 'DatabaseError',
    };

    response.status(status).json(genericBody);
  }
}

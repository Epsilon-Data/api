import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ConflictException,
  ExceptionFilter,
  HttpException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response } from 'express';

@Catch(
  Prisma.PrismaClientKnownRequestError,
  Prisma.PrismaClientValidationError,
  Prisma.PrismaClientUnknownRequestError,
)
export class PrismaClientExceptionFilter implements ExceptionFilter {
  catch(
    exception:
      | Prisma.PrismaClientKnownRequestError
      | Prisma.PrismaClientValidationError
      | Prisma.PrismaClientUnknownRequestError,
    host: ArgumentsHost,
  ) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let mapped: HttpException;

    // 1️⃣ Handle validation errors (schema / query misuse)
    if (exception instanceof Prisma.PrismaClientValidationError) {
      // You can parse the message if you want something prettier
      mapped = new BadRequestException(
        'Invalid request data for database operation',
      );
    }
    // 2️⃣ Handle known request errors via code
    else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      switch (exception.code) {
        case 'P2025': {
          // Record not found
          const msg =
            (exception.meta?.cause as string | undefined) ??
            'Resource not found';
          mapped = new NotFoundException(msg);
          break;
        }

        case 'P2002': {
          // Unique constraint violation
          const target =
            (exception.meta?.target as string[])?.join(', ') ?? 'unique field';
          mapped = new ConflictException(
            `Unique constraint failed on: ${target}`,
          );
          break;
        }

        case 'P2003': {
          // Foreign key constraint
          const field = exception.meta?.field_name as string | undefined;
          mapped = new ConflictException(
            `Foreign key constraint failed on: ${field ?? 'relation'}`,
          );
          break;
        }

        default: {
          mapped = new InternalServerErrorException(exception.message);
          break;
        }
      }
    } else {
      // Fallback (shouldn't normally hit with this @Catch)
      mapped = new InternalServerErrorException('Unexpected database error');
    }

    const status = mapped.getStatus();
    const body = mapped.getResponse();
    console.log(mapped);

    response.status(status).json(body);
  }
}

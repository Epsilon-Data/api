import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AxiosError } from 'axios';

interface AtlasErrorData {
  errorCode?: string; // e.g. "ATLAS-404-00-005"
  errorMessage?: string; // e.g. "Given instance guid ... is invalid/not found"
  message?: string | string[];
  status?: number;
  requestId?: string;
  [key: string]: unknown;
}

interface GenericErrorResponseBody {
  statusCode: number;
  message: string | string[];
  error: string;
}

/**
 * Parse HTTP status from Atlas errorCode like "ATLAS-404-00-005".
 */
function parseHttpStatusFromAtlasErrorCode(
  errorCode?: string,
  fallback: number = HttpStatus.INTERNAL_SERVER_ERROR,
): number {
  if (!errorCode) return fallback;

  const match = /ATLAS-(\d{3})-/.exec(errorCode);
  if (!match) return fallback;

  const parsed = Number(match[1]);
  return Number.isNaN(parsed) ? fallback : parsed;
}

/**
 * Build a detailed message from Atlas payload or Axios error
 * (used only for logging, not sent to the client).
 */
function buildAtlasDetailedMessage(
  data: AtlasErrorData | undefined,
  axiosError: AxiosError,
): string {
  if (data?.errorMessage) {
    return data.errorCode
      ? `[${data.errorCode}] ${data.errorMessage}`
      : data.errorMessage;
  }

  if (data?.message) {
    return Array.isArray(data.message) ? data.message.join(', ') : data.message;
  }

  return (
    axiosError.message ||
    'Unexpected error while communicating with Apache Atlas'
  );
}

/**
 * Map status to a generic, client-facing message.
 */
function buildGenericClientMessage(status: number): string {
  if (status >= 500) {
    return 'Metadata service is currently unavailable';
  }

  if ((status as HttpStatus) === HttpStatus.NOT_FOUND) {
    return 'Requested resource could not be found';
  }

  if ((status as HttpStatus) === HttpStatus.BAD_REQUEST) {
    return 'Invalid request to metadata service';
  }

  return 'Error while communicating with metadata service';
}

@Catch(AxiosError)
export class AtlasExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(AtlasExceptionFilter.name);

  catch(exception: AxiosError, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const data = exception.response?.data as AtlasErrorData | undefined;

    const status =
      exception.response?.status ??
      data?.status ??
      parseHttpStatusFromAtlasErrorCode(
        data?.errorCode,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );

    // Detailed message + payload only for logs
    const detailedMessage = buildAtlasDetailedMessage(data, exception);

    this.logger.error(
      `Atlas error (${status}) ${request.method} ${request.url}: ${detailedMessage}`,
      {
        errorCode: data?.errorCode,
        errorMessage: data?.errorMessage,
        requestId: data?.requestId,
        raw: data,
        axiosCode: exception.code,
        stack: exception.stack,
      } as unknown as string,
    );

    // Generic response for the frontend
    const genericBody: GenericErrorResponseBody = {
      statusCode: status,
      message: buildGenericClientMessage(status),
      error: 'MetadataServiceError',
    };

    response.status(status).json(genericBody);
  }
}

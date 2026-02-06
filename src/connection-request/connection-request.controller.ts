import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  InternalServerErrorException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  ServiceUnavailableException,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConnectionRequestService } from './connection-request.service';
import {
  ConnectionDecisionDto,
  ConnectionRequestResponseDto,
  DatabaseTestDto,
} from './dto';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiInternalServerErrorResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnauthorizedResponse,
  getSchemaPath,
} from '@nestjs/swagger';

import { CurrentUser } from 'src/common/decorators/user.decorator';
import type { CurrentUserInfo } from 'src/common/decorators/user.decorator';

import { Resource } from 'src/common/decorators/resource.decorator';
import { Scopes } from 'src/common/decorators/scopes.decorator';
import { ResourceGuard } from 'src/common/guards/resource.guard';
import {
  GenericErrorResponseDto,
  GetRequestCommentsDto,
  RequestCommentDto,
} from 'src/common/dto';

import type { Request } from 'express';

@ApiTags('Connection Request')
@ApiBearerAuth()
@Resource('project')
@Controller('connection-request')
export class ConnectionRequestController {
  constructor(private connectionRequestService: ConnectionRequestService) {}

  @Get()
  @ApiOperation({
    summary: 'Get list of logged in user connection requests',
  })
  @ApiBadRequestResponse({
    description: 'Invalid database / config (e.g. DB does not exist)',
    content: {
      'application/json': {
        schema: { $ref: getSchemaPath(GenericErrorResponseDto) },
        example: {
          statusCode: 400,
          message: 'Invalid request data for database operation',
          error: 'DatabaseError',
        },
      },
    },
  })
  @ApiInternalServerErrorResponse({
    description: 'Unexpected database error',
    content: {
      'application/json': {
        schema: { $ref: getSchemaPath(GenericErrorResponseDto) },
        example: {
          statusCode: 500,
          message: 'Database is temporarily unavailable',
          error: 'DatabaseError',
        },
      },
    },
  })
  @ApiOkResponse({
    description: 'List of user submitted connection requests are returned',
    type: ConnectionRequestResponseDto,
    isArray: true,
  })
  getList(@CurrentUser() user: CurrentUserInfo) {
    return this.connectionRequestService.getList(user.id);
  }

  @Get(':requestId')
  @ApiOperation({
    summary: 'Get connection request details',
  })
  @ApiOkResponse({
    description: 'Connection request details are returned',
    type: ConnectionRequestResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid request data for database operation',
    content: {
      'application/json': {
        schema: { $ref: getSchemaPath(GenericErrorResponseDto) },
        example: {
          statusCode: 400,
          message: 'Invalid request data for database operation',
          error: 'DatabaseError',
        },
      },
    },
  })
  @ApiNotFoundResponse({
    description: 'Request not found',
    content: {
      'application/json': {
        schema: { $ref: getSchemaPath(GenericErrorResponseDto) },
        example: {
          statusCode: 404,
          message: 'Requested resource could not be found',
          error: 'DatabaseError',
        },
      },
    },
  })
  @ApiInternalServerErrorResponse({
    description: 'Unexpected database error',
    content: {
      'application/json': {
        schema: { $ref: getSchemaPath(GenericErrorResponseDto) },
        example: {
          statusCode: 500,
          message: 'Database is temporarily unavailable',
          error: 'DatabaseError',
        },
      },
    },
  })
  async getDetails(
    @CurrentUser() user: CurrentUserInfo,
    @Param('requestId', ParseUUIDPipe) requestId: string,
  ) {
    return await this.connectionRequestService.getDetails(
      user.email,
      requestId,
    );
  }

  @Post('test')
  @ApiOperation({
    summary: 'Test connection credentials',
  })
  @ApiOkResponse({
    description: 'Connection test successful',
  })
  @ApiUnauthorizedResponse({
    description: 'Wrong credentials (e.g. 28P01)',
  })
  @ApiBadRequestResponse({
    description: 'Invalid database / config (e.g. DB does not exist)',
    content: {
      'application/json': {
        schema: { $ref: getSchemaPath(GenericErrorResponseDto) },
        example: {
          statusCode: 400,
          message: 'Invalid request data for database operation',
          error: 'DatabaseError',
        },
      },
    },
  })
  @ApiServiceUnavailableResponse({
    description: 'Database host unreachable / connection refused',
  })
  @ApiInternalServerErrorResponse({
    description: 'Unexpected database error',
    content: {
      'application/json': {
        schema: { $ref: getSchemaPath(GenericErrorResponseDto) },
        example: {
          statusCode: 500,
          message: 'Database is temporarily unavailable',
          error: 'DatabaseError',
        },
      },
    },
  })
  async testConnection(@Body() database: DatabaseTestDto) {
    try {
      return await this.connectionRequestService.testConnection(database);
    } catch (error: unknown) {
      const errObj = (error as { code?: unknown; message?: unknown }) || {};
      if (typeof errObj.code === 'string') {
        const code = errObj.code;
        switch (code) {
          case '28P01':
            throw new UnauthorizedException('Wrong credentials or database');
          case '3D000':
            throw new BadRequestException('Database does not exist');
          case 'ECONNREFUSED':
            throw new ServiceUnavailableException(
              'Could not connect to the database host',
            );
          case 'ENOTFOUND':
            throw new ServiceUnavailableException(
              'Database host name could not be resolved',
            );
        }
      }

      const message =
        typeof errObj.message === 'string'
          ? errObj.message
          : error instanceof Error && error.message
            ? error.message
            : undefined;

      if (message) {
        const lower = message.toLowerCase();

        if (
          lower.includes('password') ||
          lower.includes('authentication failed')
        ) {
          throw new UnauthorizedException('Wrong credentials or database');
        }

        if (
          lower.includes('does not exist') ||
          lower.includes('invalid_catalog_name')
        ) {
          throw new BadRequestException('Database does not exist');
        }

        if (
          lower.includes('ssl') ||
          lower.includes('tls') ||
          lower.includes('certificate')
        ) {
          throw new InternalServerErrorException(
            `Database SSL error: ${message}`,
          );
        }

        if (
          lower.includes('ecconnrefused') ||
          lower.includes('connection refused') ||
          lower.includes('getaddrinfo') ||
          lower.includes('enotfound')
        ) {
          throw new ServiceUnavailableException(
            'Could not connect to the database host',
          );
        }

        throw new InternalServerErrorException(message);
      }

      throw new InternalServerErrorException('Unexpected database error');
    }
  }

  @UseGuards(ResourceGuard)
  @Scopes('view', 'edit', 'connect')
  @Patch(':projectId/:requestId')
  @ApiOperation({
    summary: 'Approve connection request',
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({
    description: 'Connection request approved',
  })
  @ApiBadRequestResponse({
    description: 'Invalid request data for database operation',
    content: {
      'application/json': {
        schema: { $ref: getSchemaPath(GenericErrorResponseDto) },
        example: {
          statusCode: 400,
          message: 'Invalid request data for database operation',
          error: 'DatabaseError',
        },
      },
    },
  })
  @ApiNotFoundResponse({
    description: 'Request not found',
    content: {
      'application/json': {
        schema: { $ref: getSchemaPath(GenericErrorResponseDto) },
        example: {
          statusCode: 404,
          message: 'Requested resource could not be found',
          error: 'DatabaseError',
        },
      },
    },
  })
  @ApiInternalServerErrorResponse({
    description: 'Unexpected database error',
    content: {
      'application/json': {
        schema: { $ref: getSchemaPath(GenericErrorResponseDto) },
        example: {
          statusCode: 500,
          message: 'Database is temporarily unavailable',
          error: 'DatabaseError',
        },
      },
    },
  })
  async approve(
    @Req() request: Request,
    @CurrentUser() user: CurrentUserInfo,
    @Param('requestId', ParseUUIDPipe) requestId: string,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: ConnectionDecisionDto,
  ) {
    return await this.connectionRequestService.approve(
      user,
      requestId,
      projectId,
      dto,
      request.auth?.token || '',
    );
  }

  @Get(':requestId/comment')
  @ApiOperation({
    summary: 'Get comments of analysis request',
  })
  @ApiOkResponse({
    description: 'Comments of analysis request are returned',
    type: RequestCommentDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid comment data for database operation',
    content: {
      'application/json': {
        schema: { $ref: getSchemaPath(GenericErrorResponseDto) },
        example: {
          statusCode: 400,
          message: 'Invalid comment data for database operation',
          error: 'DatabaseError',
        },
      },
    },
  })
  @ApiNotFoundResponse({
    description: 'Request not found',
    content: {
      'application/json': {
        schema: { $ref: getSchemaPath(GenericErrorResponseDto) },
        example: {
          statusCode: 404,
          message: 'Requested resource could not be found',
          error: 'DatabaseError',
        },
      },
    },
  })
  @ApiInternalServerErrorResponse({
    description: 'Unexpected database error',
    content: {
      'application/json': {
        schema: { $ref: getSchemaPath(GenericErrorResponseDto) },
        example: {
          statusCode: 500,
          message: 'Database is temporarily unavailable',
          error: 'DatabaseError',
        },
      },
    },
  })
  async getComments(
    @CurrentUser() user: CurrentUserInfo,
    @Param('requestId', ParseUUIDPipe) requestId: string,
    @Query() query: GetRequestCommentsDto,
  ) {
    return await this.connectionRequestService.getComments(
      user.id,
      requestId,
      query,
    );
  }
}

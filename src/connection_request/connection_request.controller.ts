import {
  BadRequestException,
  Body,
  Controller,
  Get,
  InternalServerErrorException,
  Param,
  Post,
  ServiceUnavailableException,
  UnauthorizedException,
  // UseGuards,
} from '@nestjs/common';
import { ConnectionRequestService } from './connection_request.service';
import { DatabaseTestDto } from './dto';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiInternalServerErrorResponse,
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { CurrentUser } from 'src/common/decorators/user.decorator';
import type { CurrentUserInfo } from 'src/common/decorators/user.decorator';

// import { Scopes } from 'src/auth/scopes.decorator';
// import { Resource } from 'src/auth/resource.decorator';
// import { ResourceGuard } from 'src/auth/resource.guard';
// import { ScopesGuard } from 'src/common/guards/scopes.guard';

@ApiTags('Connection Request')
@ApiBearerAuth()
// @Resource('project')
@Controller('connection-request')
export class ConnectionRequestController {
  constructor(private connectionRequestService: ConnectionRequestService) {}

  @Get()
  @ApiOperation({
    summary: 'Get list of logged in user connection requests',
  })
  getList(@CurrentUser() user: CurrentUserInfo) {
    return this.connectionRequestService.getList(user.id);
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
  })
  @ApiServiceUnavailableResponse({
    description: 'Database host unreachable / connection refused',
  })
  @ApiInternalServerErrorResponse({
    description: 'Unexpected database error',
  })
  async testConnection(@Body() database: DatabaseTestDto) {
    try {
      return await this.connectionRequestService.testConnection(database);
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        typeof error.code === 'string'
      ) {
        const code = error.code;
        switch (code) {
          case '28P01':
            // invalid_password
            throw new UnauthorizedException('Wrong credentials or database');

          case '3D000':
            // invalid_catalog_name – database does not exist
            throw new BadRequestException('Database does not exist');

          case 'ECONNREFUSED':
            // Node.js connection refused (e.g. host:port not reachable)
            throw new ServiceUnavailableException(
              'Could not connect to the database host',
            );

          case 'ENOTFOUND':
            // DNS / host not found
            throw new ServiceUnavailableException(
              'Database host name could not be resolved',
            );
        }
      }

      // handle rest - no code or an unknown code
      throw new InternalServerErrorException('Unexpected database error');
    }
  }

  // TODO: protect with resource guard of projects + connect scope
  @Post(':requestId')
  @ApiOperation({
    summary: 'Approve connection request',
  })
  async approve(
    @CurrentUser() user: CurrentUserInfo,
    @Param('requestId') requestId: string,
  ) {
    return await this.connectionRequestService.approve(user.id, requestId);
  }
}

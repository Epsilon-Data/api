import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Post,
  Req,
  // UseGuards,
} from '@nestjs/common';
import { ConnectionRequestService } from './connection_request.service';
import { Request } from 'express';
import { DatabaseInfoDto } from './dto';
import {
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

// import { Scopes } from 'src/auth/scopes.decorator';
// import { Resource } from 'src/auth/resource.decorator';
// import { ResourceGuard } from 'src/auth/resource.guard';
// import { ScopesGuard } from 'src/common/guards/scopes.guard';

@ApiTags('Connection Request')
// @Resource('project')
@Controller('connection-request')
export class ConnectionRequestController {
  constructor(private connectionRequestService: ConnectionRequestService) {}

  @Get()
  @ApiOperation({
    summary: 'Get list of logged in user connection requests',
  })
  getList(@Req() request: Request) {
    // TODO: use decorator for this
    const userId = request.auth.payload.sub.toString();
    return this.connectionRequestService.getList(userId);
  }

  @Post('test')
  @ApiOperation({
    summary: 'Test connection credentials',
  })
  @ApiOkResponse({
    description: 'Connection test successful',
  })
  @ApiUnauthorizedResponse({
    description: 'Wrong credentials',
  })
  async testConnection(@Body() databaseDto: DatabaseInfoDto) {
    try {
      return await this.connectionRequestService.testConnection(databaseDto);
    } catch (error) {
      throw new HttpException(
        {
          status: HttpStatus.UNAUTHORIZED,
          error: 'Wrong credentials',
        },
        HttpStatus.UNAUTHORIZED,
      );
    }
  }

  // TODO: protect with resource guard of projects + connect scope
  @Post(':requestId')
  @ApiOperation({
    summary: 'Approve connection request',
  })
  async approve(
    @Req() request: Request,
    @Param('requestId') requestId: string,
  ) {
    const userId = request.auth.payload.sub.toString();
    return await this.connectionRequestService.approve(userId, requestId);
  }
}

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ConnectionRequestService } from './connection_request.service';
import { RevisionDto, ConnectionRequestDto, DatabaseInfoDto } from './dto';
import { ScopesGuard } from 'src/auth/scopes.guard';
import { Resource } from 'src/auth/resource.decorator';
import { Request } from 'express';

import { Scopes } from 'src/auth/scopes.decorator';
import { ResourceGuard } from 'src/auth/resource.guard';
// import { KeycloakService } from 'src/auth/keycloak/keycloak.service';
// import { KEYCLOAK_INSTANCE } from 'src/auth/config.interface';

@Resource('Project')
@Controller('connection-request')
export class ConnectionRequestController {
  constructor(private connectionRequestService: ConnectionRequestService) {}

  @Get()
  // @UseGuards(new AuthGuard('api.hub.read'))
  @Resource('Project')
  @UseGuards(ResourceGuard)
  @Scopes('view')
  summary(@Req() request: Request) {
    const userId = request.auth.payload.sub.toString();
    const email = request.auth.payload.email.toString();
    console.log(request.auth.token);
    return this.connectionRequestService.summary(userId, email);
  }

  @Post()
  create(@Body() dto: ConnectionRequestDto) {
    return this.connectionRequestService.create(dto);
  }

  @Get(':requestId')
  details(@Param('requestId', ParseUUIDPipe) requestId: string) {
    return this.connectionRequestService.details(requestId);
  }

  @Put(':requestId')
  edit(@Body() dto: ConnectionRequestDto) {
    return this.connectionRequestService.edit(dto);
  }

  @Delete(':requestId')
  delete(@Param('requestId', ParseUUIDPipe) requestId: string) {
    return this.connectionRequestService.delete(requestId);
  }

  @Patch(':requestId')
  approve(
    @Body() dto: DatabaseInfoDto,
    @Param('requestId', ParseUUIDPipe) requestId: string,
    @Req() request: Request,
  ) {
    const userId = request.auth.payload.sub.toString();
    return this.connectionRequestService.approve(userId, dto, requestId);
  }

  @Put(':requestId/revision')
  revision(@Body() dto: RevisionDto) {
    return this.connectionRequestService.revision(dto);
  }

  @Post('test')
  @UseGuards(new ScopesGuard('api.hub.read'))
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

  @Post(':projectId')
  @UseGuards(new ScopesGuard('api.hub.read'))
  async validProjectId(
    @Req() request: Request,
    @Param('projectId') projectId: string,
  ) {
    const userId = request.auth.payload.sub.toString();
    return this.connectionRequestService.validProjectId(userId, projectId);
  }
}

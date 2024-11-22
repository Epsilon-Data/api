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
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ConnectionRequestService } from './connection_request.service';
import { RevisionDto, ConnectionRequestDto, DatabaseInfoDto } from './dto';
import { AuthGuard } from 'src/auth/auth.guard';
import { Request } from 'express';

@Controller('connection-request')
export class ConnectionRequestController {
  constructor(private connectionRequestService: ConnectionRequestService) {}

  @Get()
  @UseGuards(new AuthGuard('api.hub.read'))
  summary(
    @Req() request: Request,
    @Query('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.connectionRequestService.summary(
      userId,
      request.auth.payload.email.toString(),
    );
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
    @Query('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.connectionRequestService.approve(userId, dto, requestId);
  }

  @Put(':requestId/revision')
  revision(@Body() dto: RevisionDto) {
    return this.connectionRequestService.revision(dto);
  }

  @Post('test')
  @UseGuards(new AuthGuard('api.hub.read'))
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
  async validProjectId(
    @Query('userId', ParseUUIDPipe) userId: string,
    @Param('projectId') projectId: string,
  ) {
    return this.connectionRequestService.validProjectId(userId, projectId);
  }
}

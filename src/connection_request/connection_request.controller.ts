import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  HttpStatus,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ConnectionRequestService } from './connection_request.service';
import { RevisionDto, ConnectionRequestDto, DatabaseInfoDto } from './dto';
import { AuthGuard } from 'src/auth/auth.guard';

@Controller('connection-request')
export class ConnectionRequestController {
  constructor(private connectionRequestService: ConnectionRequestService) {}

  @Get('details')
  details(@Query('requestId', ParseUUIDPipe) requestId: string) {
    return this.connectionRequestService.details(requestId);
  }

  @Get('summary')
  @UseGuards(new AuthGuard('api.hub.read'))
  summary(
    @Query('userId', ParseUUIDPipe) userId: string,
    @Query('email') email: string,
  ) {
    return this.connectionRequestService.summary(userId, email);
  }

  @Post('create')
  create(@Body() dto: ConnectionRequestDto) {
    return this.connectionRequestService.create(dto);
  }

  @Patch('edit')
  edit(@Body() dto: ConnectionRequestDto) {
    return this.connectionRequestService.edit(dto);
  }

  @Delete('delete')
  delete(@Query('requestId', ParseUUIDPipe) requestId: string) {
    return this.connectionRequestService.delete(requestId);
  }

  @Patch('approve')
  approve(
    @Query('requestId', ParseUUIDPipe) userId: string,
    @Body() dto: DatabaseInfoDto,
    @Query('requestId', ParseUUIDPipe) requestId: string,
  ) {
    return this.connectionRequestService.approve(userId, dto, requestId);
  }

  @Patch('revision')
  revision(@Body() dto: RevisionDto) {
    return this.connectionRequestService.revision(dto);
  }

  @Post('test-connection')
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

  @Get('valid-project-id')
  async validProjectId(
    @Query('userId', ParseUUIDPipe) userId: string,
    @Query('projectId') projectId: string,
  ) {
    return this.connectionRequestService.validProjectId(userId, projectId);
  }
}

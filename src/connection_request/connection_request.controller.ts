import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ConnectionRequestService } from './connection_request.service';
import { ConnectionRequestDto, DatabaseInfoDto } from './dto';
import { UUID } from 'crypto';

@Controller('connection-request')
export class ConnectionRequestController {
  constructor(private connectionRequestService: ConnectionRequestService) {}

  @Get('details')
  details(@Query('requestId', ParseUUIDPipe) requestId: UUID) {
    return this.connectionRequestService.details(requestId);
  }

  @Get('summary')
  summary(
    @Query('userId', ParseUUIDPipe) userId: UUID,
    @Query('userType') userType: string,
  ) {
    return this.connectionRequestService.summary(userId, userType);
  }

  @Post('create')
  create(@Body() dto: ConnectionRequestDto) {
    return this.connectionRequestService.create(dto);
  }

  @Patch('update')
  update(@Body() dto: ConnectionRequestDto) {
    return this.connectionRequestService.update(dto);
  }

  @Post('test-connection')
  async testConnection(@Body() databaseDto: DatabaseInfoDto) {
    try {
      await this.connectionRequestService.testConnection(databaseDto);
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
}

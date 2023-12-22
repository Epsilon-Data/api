import { Body, Controller, Get, Post } from '@nestjs/common';
import { ConnectionRequestService } from './connection_request.service';
import { ConnectionRequestDto } from './dto';

@Controller('connection-request')
export class ConnectionRequestController {
  constructor(private connectionRequestService: ConnectionRequestService) {}

  @Get('details')
  details() {
    return this.connectionRequestService.details();
  }

  @Get('summary')
  summary() {
    return this.connectionRequestService.summary();
  }

  @Post('create')
  create(@Body() dto: ConnectionRequestDto) {
    return this.connectionRequestService.create(dto);
  }
}

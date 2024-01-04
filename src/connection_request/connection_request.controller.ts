import {
  Body,
  Controller,
  Get,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ConnectionRequestService } from './connection_request.service';
import { ConnectionRequestDto } from './dto';

@Controller('connection-request')
export class ConnectionRequestController {
  constructor(private connectionRequestService: ConnectionRequestService) {}

  @Get('details')
  details(@Query('requestId', ParseIntPipe) requestId: number) {
    return this.connectionRequestService.details(requestId);
  }

  @Get('summary')
  summary(
    @Query('userId', ParseIntPipe) userId: number,
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
}

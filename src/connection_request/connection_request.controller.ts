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
  UseGuards,
} from '@nestjs/common';
import { ConnectionRequestService } from './connection_request.service';
import { ConnectionRequestDto, DatabaseInfoDto } from './dto';
import { AuthGuard } from 'src/auth/auth.guard';

@Controller('connection-request')
export class ConnectionRequestController {
  constructor(private connectionRequestService: ConnectionRequestService) {}

  @Get('details')
  details(@Query('requestId', ParseUUIDPipe) requestId: string) {
    return this.connectionRequestService.details(requestId);
  }

  @Get('summary')
  summary(@Query('userId', ParseUUIDPipe) userId: string) {
    return this.connectionRequestService.summary(userId);
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
  @UseGuards(new AuthGuard('api.hub.read'))
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

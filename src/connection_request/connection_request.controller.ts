import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ConnectionRequestService } from './connection_request.service';
import { AuthGuard } from 'src/auth/auth.guard';
import { Request } from 'express';
import { DatabaseInfoDto } from './dto';

@Controller('connection-request')
export class ConnectionRequestController {
  constructor(private connectionRequestService: ConnectionRequestService) {}

  @Get()
  @UseGuards(new AuthGuard('api.hub.read'))
  getList(@Req() request: Request) {
    const userId = request.auth.payload.sub.toString();

    return this.connectionRequestService.getList(userId);
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

  @Post(':requestId')
  async approve(@Param('requestId') requestId: string) {
    return await this.connectionRequestService.approve(requestId);
  }
}

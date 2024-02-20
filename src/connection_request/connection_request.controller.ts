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
  Req,
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
  summary(@Req() request) {
    return this.connectionRequestService.summary(request);
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
    @Body() dto: DatabaseInfoDto,
    @Query('requestId', ParseUUIDPipe) requestId: string,
  ) {
    return this.connectionRequestService.approve(dto, requestId);
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
}

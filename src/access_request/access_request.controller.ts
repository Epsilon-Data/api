import {
  Body,
  Controller,
  Delete,
  Get,
  ParseUUIDPipe,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AccessRequestService } from './access_request.service';
import { AuthGuard } from 'src/auth/auth.guard';
import { ProceedDto, RequestDto, RevisionDto } from './dto';
import { Request } from 'express';

@Controller('access-request')
export class AccessRequestController {
  constructor(private userRequestService: AccessRequestService) {}

  @Get('details')
  details(@Query('requestId', ParseUUIDPipe) requestId: string) {
    return this.userRequestService.details(requestId);
  }

  @Get('summary')
  @UseGuards(new AuthGuard('api.hub.read'))
  summary(@Req() request: Request, @Query('mode') mode: string) {
    return this.userRequestService.summary(request, mode);
  }

  @Patch('revision')
  revision(@Body() dto: RevisionDto) {
    return this.userRequestService.revision(dto);
  }

  @Patch('proceed')
  proceed(@Body() dto: ProceedDto) {
    return this.userRequestService.proceed(dto);
  }

  @Delete('delete')
  delete(@Query('requestId', ParseUUIDPipe) requestId: string) {
    return this.userRequestService.delete(requestId);
  }

  @Patch('edit')
  async edit(@Body() dto: RequestDto) {
    return this.userRequestService.edit(dto);
  }
}

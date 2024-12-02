import {
  Body,
  Controller,
  Delete,
  Get,
  Put,
  ParseUUIDPipe,
  Patch,
  UseGuards,
  Param,
  Req,
} from '@nestjs/common';
import { AccessRequestService } from './access_request.service';
import { AuthGuard } from 'src/auth/auth.guard';
import { RequestDto, RevisionDto } from './dto';
import { Request } from 'express';

@Controller('access-request')
export class AccessRequestController {
  constructor(private userRequestService: AccessRequestService) {}

  @Get(':requestId')
  async details(@Param('requestId', ParseUUIDPipe) requestId: string) {
    return await this.userRequestService.details(requestId);
  }

  @Get()
  @UseGuards(new AuthGuard('api.hub.read'))
  async summary(@Req() request: Request) {
    const userId = request.auth.payload.sub.toString();
    return await this.userRequestService.summary(userId);
  }

  @Put(':requestId/revision')
  revision(@Body() dto: RevisionDto) {
    return this.userRequestService.revision(dto);
  }

  @Patch(':requestId')
  approve(
    @Param('requestId', ParseUUIDPipe) requestId: string,
    @Body() data: { isApproved: boolean },
  ) {
    return this.userRequestService.approve(requestId, data.isApproved);
  }

  @Put(':requestId')
  async edit(@Body() dto: RequestDto) {
    return await this.userRequestService.edit(dto);
  }

  @Delete(':requestId')
  async delete(@Param('requestId', ParseUUIDPipe) requestId: string) {
    return await this.userRequestService.delete(requestId);
  }
}

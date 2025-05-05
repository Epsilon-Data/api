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
import { AnalysisRequestService } from './analysis_request.service';
import { AuthGuard } from 'src/auth/auth.guard';
import { AnalysisDto } from './dto';
import { Request } from 'express';

@Controller('analysis-request')
export class AnalysisRequestController {
  constructor(private analysisRequestService: AnalysisRequestService) {}

  @Get(':requestId')
  async getDetails(@Param('requestId', ParseUUIDPipe) requestId: string) {
    return await this.analysisRequestService.getDetails(requestId);
  }

  @Get()
  @UseGuards(new AuthGuard('api.hub.read'))
  async getList(@Req() request: Request) {
    const userId = request.auth.payload.sub.toString();
    return await this.analysisRequestService.getList(userId);
  }

  @Patch(':requestId')
  approve(@Param('requestId', ParseUUIDPipe) requestId: string) {
    return this.analysisRequestService.approve(requestId);
  }

  @Put(':requestId')
  async update(@Body() dto: AnalysisDto) {
    return await this.analysisRequestService.update(dto);
  }

  @Delete(':requestId')
  async delete(@Param('requestId', ParseUUIDPipe) requestId: string) {
    return await this.analysisRequestService.delete(requestId);
  }
}

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
import { ScopesGuard } from 'src/auth/scopes.guard';
import { AnalysisDto } from './dto';
import { Request } from 'express';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('Analysis Request')
@Controller('analysis-request')
export class AnalysisRequestController {
  constructor(private analysisRequestService: AnalysisRequestService) {}

  @Get(':requestId')
  @ApiOperation({
    summary: 'Get analysis request details',
  })
  async getDetails(@Param('requestId', ParseUUIDPipe) requestId: string) {
    return await this.analysisRequestService.getDetails(requestId);
  }

  @Get()
  @ApiOperation({
    summary: 'Get list of analysis requests',
  })
  @UseGuards(new ScopesGuard('api.hub.read'))
  async getList(@Req() request: Request) {
    const userId = request.auth.payload.sub.toString();
    return await this.analysisRequestService.getList(userId);
  }

  @Patch(':requestId')
  @ApiOperation({
    summary: 'Approve analysis request',
  })
  approve(@Param('requestId', ParseUUIDPipe) requestId: string) {
    return this.analysisRequestService.approve(requestId);
  }

  @Put(':requestId')
  @ApiOperation({
    summary: 'Update analysis request',
  })
  async update(
    @Param('requestId', ParseUUIDPipe) requestId: string,
    @Body() dto: AnalysisDto,
  ) {
    return await this.analysisRequestService.update(requestId, dto);
  }

  @Delete(':requestId')
  @ApiOperation({
    summary: 'Delete analysis request',
  })
  async delete(@Param('requestId', ParseUUIDPipe) requestId: string) {
    return await this.analysisRequestService.delete(requestId);
  }
}

import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
} from '@nestjs/common';
import { AnalysisService } from './analysis.service';
import { Request } from 'express';
import { DescriptiveDto } from './dto';

@Controller('analysis')
export class AnalysisController {
  constructor(private readonly analysisService: AnalysisService) {}

  @Post()
  createAnalysis(
    @Req() request: Request,
    @Body() dto: { userRequestId: string; name: string },
  ) {
    return this.analysisService.createAnalysis(
      request,
      dto.userRequestId,
      dto.name,
    );
  }

  @Get(':analysisId')
  async analysisDetails(
    @Param('analysisId', ParseUUIDPipe) analysisId: string,
  ) {
    return await this.analysisService.analysisDetails(analysisId);
  }

  @Post('/descriptive')
  async descriptiveAnalysis(@Body() dto: DescriptiveDto) {
    return await this.analysisService.descriptiveAnalysis(dto);
  }

  @Delete(':analysisId')
  deleteAnalysis(@Param('analysisId', ParseUUIDPipe) analysisId: string) {
    return this.analysisService.deleteAnalysis(analysisId);
  }
}

import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { DatasetService } from './dataset.service';
import { Request, Response } from 'express';
import { DescriptiveDto } from './dto';
import * as fs from 'fs';

@Controller('dataset')
export class DatasetController {
  constructor(private datasetService: DatasetService) {}

  @Get()
  async list(@Query('userId', ParseUUIDPipe) userId: string) {
    return await this.datasetService.list(userId);
  }

  @Get(':userRequestId')
  async analysisList(
    @Param('userRequestId', ParseUUIDPipe) userRequestId: string,
  ) {
    return await this.datasetService.analysisList(userRequestId);
  }

  @Post()
  createAnalysis(
    @Req() request: Request,
    @Body() dto: { userRequestId: string; name: string },
  ) {
    return this.datasetService.createAnalysis(
      request,
      dto.userRequestId,
      dto.name,
    );
  }

  @Get('/analysis/:analysisId')
  async analysisDetails(
    @Param('analysisId', ParseUUIDPipe) analysisId: string,
  ) {
    return await this.datasetService.analysisDetails(analysisId);
  }

  @Get('/columns/:userRequestId')
  async getColumns(
    @Param('userRequestId', ParseUUIDPipe) userRequestId: string,
  ) {
    return await this.datasetService.getColumns(userRequestId);
  }

  @Post('descriptive')
  async descriptiveAnalysis(@Body() dto: DescriptiveDto) {
    return await this.datasetService.descriptiveAnalysis(dto);
  }

  @Delete('/analysis/:analysisId')
  deleteAnalysis(@Param('analysisId', ParseUUIDPipe) analysisId: string) {
    return this.datasetService.deleteAnalysis(analysisId);
  }

  @Get('/download/:userRequestId')
  async downloadDataset(
    @Param('userRequestId', ParseUUIDPipe) userRequestId: string,
    @Res() response: Response,
  ) {
    const zipFilePath =
      await this.datasetService.downloadDataset(userRequestId);

    response.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="dataset.zip"`,
    });
    const fileStream = fs.createReadStream(zipFilePath);
    fileStream.pipe(response);
    fileStream.on('close', () => {
      fs.rmSync(zipFilePath);
      fs.rmSync('csv_files', { recursive: true, force: true });
    });
  }

  @Get('/reports/:scriptId')
  async getReport(@Param('scriptId', ParseUUIDPipe) scriptId: string) {
    return await this.datasetService.getReport(scriptId);
  }
}

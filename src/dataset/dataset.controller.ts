import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  Res,
} from '@nestjs/common';
import { DatasetService } from './dataset.service';
import { Response } from 'express';
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

  @Get('/columns/:userRequestId')
  async getColumns(
    @Param('userRequestId', ParseUUIDPipe) userRequestId: string,
  ) {
    return await this.datasetService.getColumns(userRequestId);
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

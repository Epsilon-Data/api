import {
  Body,
  Controller,
  Delete,
  Get,
  ParseFilePipe,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { DatasetService } from './dataset.service';
import { Request, Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { scriptOptions } from 'src/options';
import { DescriptiveDto } from './dto';
import * as fs from 'fs';

@Controller('dataset')
export class DatasetController {
  constructor(private datasetService: DatasetService) {}

  @Get('list')
  list(@Req() request: Request) {
    return this.datasetService.list(request);
  }

  @Get('analysis-list')
  analysisList(@Query('userRequestId', ParseUUIDPipe) userRequestId: string) {
    return this.datasetService.analysisList(userRequestId);
  }

  @Post('create-analysis')
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

  @Post('upload-script')
  @UseInterceptors(FileInterceptor('file', scriptOptions))
  uploadScript(
    @Req() request: Request,
    @UploadedFile(new ParseFilePipe())
    file: Express.Multer.File,
    @Query('analysisId', ParseUUIDPipe) analysisId: string,
  ) {
    return this.datasetService.uploadScript(request, analysisId, file);
  }

  @Get('analysis-details')
  analysisDetails(@Query('analysisId', ParseUUIDPipe) analysisId: string) {
    return this.datasetService.analysisDetails(analysisId);
  }

  @Delete('delete-script')
  deleteScript(@Query('scriptId') scriptId: string) {
    return this.datasetService.deleteScript(scriptId);
  }

  @Get('columns')
  getColumns(@Query('userRequestId', ParseUUIDPipe) userRequestId: string) {
    return this.datasetService.getColumns(userRequestId);
  }

  @Post('descriptive')
  descriptiveAnalysis(@Body() dto: DescriptiveDto) {
    return this.datasetService.descriptiveAnalysis(dto);
  }

  @Get('get-script-mapping')
  getScriptMapping(
    @Query('scriptId', ParseUUIDPipe) scriptId: string,
    @Req() request: Request,
  ) {
    return this.datasetService.getScriptMapping(scriptId, request);
  }

  @Delete('delete-analysis')
  deleteAnalysis(@Query('analysisId') analysisId: string) {
    return this.datasetService.deleteAnalysis(analysisId);
  }

  @Post('add-script-mapping')
  addScriptMapping(
    @Query('scriptId') scriptId: string,
    @Body() mapping: { data: string },
  ) {
    return this.datasetService.addScriptMapping(scriptId, mapping.data);
  }

  @Get('download-dataset')
  async downloadDataset(
    @Query('userRequestId', ParseUUIDPipe) userRequestId: string,
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

  @Get('view-report')
  async viewReport(@Query('scriptId', ParseUUIDPipe) scriptId: string) {
    return await this.datasetService.viewReport(scriptId);
  }
}

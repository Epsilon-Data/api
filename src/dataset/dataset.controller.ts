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
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { DatasetService } from './dataset.service';
import { Request } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { scriptOptions } from 'src/options';
import { DescriptiveDto } from './dto';

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
  create(
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
  getScriptMapping(@Query('scriptId', ParseUUIDPipe) scriptId: string) {
    return this.datasetService.getScriptMapping(scriptId);
  }

  @Delete('delete-analysis')
  deleteAnalysis(@Query('analysisId') analysisId: string) {
    return this.datasetService.deleteAnalysis(analysisId);
  }
}

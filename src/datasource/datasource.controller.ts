import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseFilePipe,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { DatasourceService } from './datasource.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { coverOptions } from 'src/options';
import { Request } from 'express';

@Controller('datasource')
export class DatasourceController {
  constructor(private databaseSourceService: DatasourceService) {}

  @Get()
  async list(@Req() request: Request) {
    const userId = request.auth.payload.sub.toString();
    return await this.databaseSourceService.list(userId);
  }

  @Get(':projectId')
  async getProjectDetails(
    @Param('projectId', ParseUUIDPipe) projectId: string,
  ) {
    return await this.databaseSourceService.getProjectDetails(projectId);
  }

  @Get(':projectId/summary')
  async summary(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return await this.databaseSourceService.summary(projectId);
  }

  @Get(':projectId/tables')
  async tables(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return await this.databaseSourceService.tables(projectId);
  }

  @Get(':projectId/columns')
  async columns(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return await this.databaseSourceService.columns(projectId);
  }

  @Get(':projectId/permissions')
  async permissions(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return await this.databaseSourceService.permissions(projectId);
  }

  @Post(':projectId/permissions')
  addPermissions(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() permissions: any,
  ) {
    return this.databaseSourceService.addPermissions(projectId, permissions);
  }

  @Post('upload-cover')
  @UseInterceptors(FileInterceptor('file', coverOptions))
  async uploadCover(
    @UploadedFile(new ParseFilePipe())
    file: Express.Multer.File,
    @Query('projectId', ParseUUIDPipe) projectId: string,
  ) {
    const result = this.databaseSourceService.uploadCover(projectId, file);
    return result;
  }

  @Post('upload-vis')
  uploadVis(@Body() visualisations: { projectId: string; vis: string }) {
    return this.databaseSourceService.uploadVis(visualisations);
  }

  @Delete('delete-cover')
  deleteCover(@Query('projectId', ParseUUIDPipe) projectId: string) {
    return this.databaseSourceService.deleteCover(projectId);
  }

  @Post(':projectId/sync')
  syncDatasource(
    @Req() request: Request,
    @Param('projectId', ParseUUIDPipe) projectId: string,
  ) {
    const userId = request.auth.payload.sub.toString();
    return this.databaseSourceService.syncDatasource(userId, projectId);
  }
}

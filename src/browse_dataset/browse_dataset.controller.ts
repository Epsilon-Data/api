import {
  Controller,
  Get,
  Post,
  Body,
  ParseUUIDPipe,
  Param,
  Req,
} from '@nestjs/common';
import { BrowseDatasetService } from './browse_dataset.service';
import { AccessDto } from './dto';
import { Request } from 'express';

@Controller('browse-dataset')
export class BrowseDatasetController {
  constructor(private browseDatasetService: BrowseDatasetService) {}

  @Get()
  async projects() {
    return await this.browseDatasetService.projects();
  }

  @Get(':projectId')
  async projectDetails(
    @Req() request: Request,
    @Param('projectId', ParseUUIDPipe) projectId: string,
  ) {
    const userId = request.auth.payload.sub.toString();
    return await this.browseDatasetService.projectDetails(userId, projectId);
  }

  @Get('/projects/:projectId/summary')
  async projectSummary(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return await this.browseDatasetService.projectSummary(projectId);
  }

  @Post()
  createRequest(@Body() details: AccessDto) {
    return this.browseDatasetService.createRequest(details);
  }
}

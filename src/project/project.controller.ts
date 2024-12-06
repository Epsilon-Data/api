import {
  Controller,
  Get,
  Post,
  Body,
  ParseUUIDPipe,
  Param,
  Req,
} from '@nestjs/common';
import { ProjectService } from './project.service';
import { AccessDto } from './dto';
import { Request } from 'express';

@Controller('project')
export class ProjectController {
  constructor(private browseDatasetService: ProjectService) {}

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

  @Get(':projectId/summary')
  async projectSummary(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return await this.browseDatasetService.projectSummary(projectId);
  }

  @Post()
  createRequest(@Body() details: AccessDto) {
    return this.browseDatasetService.createRequest(details);
  }
}

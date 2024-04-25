import { Controller, Get, Query } from '@nestjs/common';
import { BrowseDatasetService } from './browse_dataset.service';

@Controller('browse-dataset')
export class BrowseDatasetController {
  constructor(private browseDatasetService: BrowseDatasetService) {}

  @Get('projects')
  async projects() {
    return await this.browseDatasetService.projects();
  }

  @Get('project-details')
  async projectDetails(@Query('projectId') projectId: string) {
    return await this.browseDatasetService.projectDetails(projectId);
  }
}

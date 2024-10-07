import { Controller, Get, Query, Post, Body } from '@nestjs/common';
import { BrowseDatasetService } from './browse_dataset.service';
import { AccessDto } from './dto';

@Controller('browse-dataset')
export class BrowseDatasetController {
  constructor(private browseDatasetService: BrowseDatasetService) {}

  @Get('projects')
  async projects(@Query('isSearch') isSearch: boolean) {
    return await this.browseDatasetService.projects(isSearch);
  }

  @Get('project-details')
  async projectDetails(
    @Query('userId') userId: string,
    @Query('projectId') projectId: string,
  ) {
    return await this.browseDatasetService.projectDetails(userId, projectId);
  }

  @Get('project-summary')
  async projectSummary(@Query('projectId') projectId: string) {
    return await this.browseDatasetService.projectSummary(projectId);
  }

  @Post('apply-request')
  applyRequest(@Body() details: AccessDto) {
    return this.browseDatasetService.applyRequest(details);
  }
}

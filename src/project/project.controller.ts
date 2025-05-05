import {
  Controller,
  Get,
  Post,
  Body,
  Req,
  Param,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ProjectService } from './project.service';
import { ProjectDto } from './dto';
import { Request } from 'express';

@Controller('project')
export class ProjectController {
  constructor(private projectService: ProjectService) {}

  @Get()
  async getList(@Req() request: Request) {
    const userId = request.auth.payload.sub.toString();
    return await this.projectService.getList(userId);
  }

  @Get(':projectId/requests')
  async getRequestList(
    @Req() request: Request,
    @Param('projectId', ParseUUIDPipe) projectId: string,
  ) {
    const email = request.auth.payload.email.toString();
    return await this.projectService.getRequestList(projectId, email);
  }

  @Post()
  create(@Body() dto: ProjectDto) {
    return this.projectService.create(dto);
  }

  @Get(':projectId')
  async getDetails(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return await this.projectService.getDetails(projectId);
  }

  // @Get(':projectId/summary')
  // async projectSummary(@Param('projectId', ParseUUIDPipe) projectId: string) {
  //   return await this.projectService.projectSummary(projectId);
  // }

  // @Post()
  // createAnalysisRequest(@Body() details: AccessDto) {
  //   return this.projectService.createAnalysisRequest(details);
  // }

  // @Get(':requestId')
  // details(@Param('requestId', ParseUUIDPipe) requestId: string) {
  //   return this.connectionRequestService.details(requestId);
  // }

  // @Put(':requestId')
  // edit(@Body() dto: ConnectionRequestDto) {
  //   return this.connectionRequestService.edit(dto);
  // }

  // @Delete(':requestId')
  // delete(@Param('requestId', ParseUUIDPipe) requestId: string) {
  //   return this.connectionRequestService.delete(requestId);
  // }

  // @Patch(':requestId')
  // approve(
  //   @Body() dto: DatabaseInfoDto,
  //   @Param('requestId', ParseUUIDPipe) requestId: string,
  //   @Req() request: Request,
  // ) {
  //   const userId = request.auth.payload.sub.toString();
  //   return this.connectionRequestService.approve(userId, dto, requestId);
  // }

  // @Put(':requestId/revision')
  // revision(@Body() dto: RevisionDto) {
  //   return this.connectionRequestService.revision(dto);
  // }
}

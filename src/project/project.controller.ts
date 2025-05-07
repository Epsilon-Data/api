import {
  Controller,
  Get,
  Post,
  Body,
  Req,
  Param,
  ParseUUIDPipe,
  Put,
  Delete,
} from '@nestjs/common';
import { ProjectService } from './project.service';
import { ProjectDto } from './dto';
import { Request } from 'express';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('Project')
@Controller('project')
export class ProjectController {
  constructor(private projectService: ProjectService) {}

  @Get()
  @ApiOperation({ summary: 'Get list of projects' })
  async getList(@Req() request: Request) {
    const userId = request.auth.payload.sub.toString();
    return await this.projectService.getList(userId);
  }

  @Get(':projectId/requests')
  @ApiOperation({ summary: 'Get list of incoming requests' })
  async getRequestList(
    @Req() request: Request,
    @Param('projectId', ParseUUIDPipe) projectId: string,
  ) {
    const email = request.auth.payload.email.toString();
    return await this.projectService.getRequestList(projectId, email);
  }

  @Post()
  @ApiOperation({ summary: 'Create project' })
  create(@Body() dto: ProjectDto) {
    return this.projectService.create(dto);
  }

  @Get(':projectId')
  @ApiOperation({ summary: 'Get project details' })
  async getDetails(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return await this.projectService.getDetails(projectId);
  }

  @Put(':projectId')
  @ApiOperation({ summary: 'Edit project' })
  update(@Body() dto: ProjectDto) {
    return this.projectService.update(dto);
  }

  @Delete(':projectId')
  @ApiOperation({ summary: 'Delete project' })
  delete(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.projectService.delete(projectId);
  }

  // @Get(':projectId/summary')
  // async projectSummary(@Param('projectId', ParseUUIDPipe) projectId: string) {
  //   return await this.projectService.projectSummary(projectId);
  // }

  // @Get(':requestId')
  // details(@Param('requestId', ParseUUIDPipe) requestId: string) {
  //   return this.connectionRequestService.details(requestId);
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

import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
} from '@nestjs/common';
import { TemplateService } from './template.service';
import { TemplateDto } from './dto';
import { Request } from 'express';

@Controller('template')
export class TemplateController {
  constructor(private readonly templateService: TemplateService) {}

  @Get(':projectId/names')
  async templateNames(
    @Req() request: Request,
    @Param('projectId', ParseUUIDPipe) projectId: string,
  ) {
    const token = request.auth.token;
    return await this.templateService.templateNames(projectId, token);
  }

  @Get(':projectId')
  async templates(
    @Req() request: Request,
    @Param('projectId', ParseUUIDPipe) projectId: string,
  ) {
    const token = request.auth.token;
    return await this.templateService.templates(projectId, token);
  }

  @Delete(':projectId/:templateId')
  async deleteTemplate(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('templateId', ParseUUIDPipe) templateId: string,
  ) {
    const template = { projectId, templateId } as TemplateDto;
    return await this.templateService.deleteTemplate(template);
  }

  @Post(':projectId')
  createTemplate(@Body() template: TemplateDto) {
    return this.templateService.createTemplate(template);
  }
}

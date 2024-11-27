import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { TemplateService } from './template.service';
import { TemplateDto } from './dto';

@Controller('template')
export class TemplateController {
  constructor(private readonly templateService: TemplateService) {}

  @Get(':projectId/names')
  async templateNames(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return await this.templateService.templateNames(projectId);
  }

  @Get(':projectId')
  async templates(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return await this.templateService.templates(projectId);
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

import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ArchetypeService } from './archetype.service';
import { ArchetypeDto } from './dto';

@Controller('template')
export class ArchetypeController {
  constructor(private readonly templateService: ArchetypeService) {}

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
    const template = { projectId, templateId } as ArchetypeDto;
    return await this.templateService.deleteTemplate(template);
  }

  @Post(':projectId')
  createTemplate(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() template: ArchetypeDto,
  ) {
    return this.templateService.createTemplate(projectId, template);
  }
}

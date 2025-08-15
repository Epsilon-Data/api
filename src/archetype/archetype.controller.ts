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

@Controller('archetype')
export class ArchetypeController {
  constructor(private readonly templateService: ArchetypeService) {}

  @Get(':projectId')
  async getArchetypes(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return await this.templateService.getArchetypes(projectId);
  }

  @Delete(':projectId/:archetypeId')
  async deleteArchetype(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('archetypeId', ParseUUIDPipe) archetypeId: string,
  ) {
    const template = { projectId, archetypeId } as ArchetypeDto;
    return await this.templateService.deleteArchetype(template);
  }

  @Post(':projectId')
  createArchetype(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() template: ArchetypeDto,
  ) {
    return this.templateService.createArchetype(projectId, template);
  }
}

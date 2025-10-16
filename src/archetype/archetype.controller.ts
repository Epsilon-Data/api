import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ArchetypeService } from './archetype.service';
import { ArchetypeDto } from './dto';
import { Request } from 'express';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { Resource } from 'src/common/decorators/resource.decorator';
import { Scopes } from 'src/common/decorators/scopes.decorator';
import { ResourceGuard } from 'src/common/guards/resource.guard';

@ApiTags('Archetype')
@Controller('archetype')
@Resource('project')
export class ArchetypeController {
  constructor(private readonly archetypeService: ArchetypeService) {}

  @UseGuards(ResourceGuard)
  @Scopes('view')
  @Get(':projectId')
  @ApiOperation({ summary: 'Get list of archetypes for a project' })
  async getArchetypes(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return await this.archetypeService.fetchArchetypes(projectId);
  }

  @UseGuards(ResourceGuard)
  @Scopes('view')
  @Get(':projectId/:archetypeId')
  @ApiOperation({ summary: 'Get project archetype details' })
  async getArchetype(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('archetypeId', ParseUUIDPipe) archetypeId: string,
  ) {
    return await this.archetypeService.getArchetypeDetails(
      projectId,
      archetypeId,
    );
  }

  @UseGuards(ResourceGuard)
  @Scopes('view, edit')
  @Post(':projectId')
  @ApiOperation({ summary: 'Create archetype for a project' })
  createArchetype(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() archetype: ArchetypeDto,
    @Req() request: Request,
  ) {
    const username = request.auth.payload.preferred_username.toString();
    return this.archetypeService.createArchetype(username, archetype);
  }

  @UseGuards(ResourceGuard)
  @Scopes('view, edit')
  @Put(':projectId/:archetypeId')
  @ApiOperation({ summary: 'Update archetype for a project' })
  updateArchetype(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('archetypeId', ParseUUIDPipe) archetypeId: string,
    @Body() archetype: ArchetypeDto,
    @Req() request: Request,
  ) {
    const username = request.auth.payload.preferred_username.toString();
    // TODO: create this update function
    return this.archetypeService.createArchetype(username, archetype);
  }

  @UseGuards(ResourceGuard)
  @Scopes('view, edit')
  @Get(':projectId')
  @Delete(':projectId/:archetypeId')
  @ApiOperation({ summary: 'Delete archetype for a project' })
  async deleteArchetype(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('archetypeId', ParseUUIDPipe) archetypeId: string,
  ) {
    return await this.archetypeService.deleteArchetype(projectId, archetypeId);
  }
}

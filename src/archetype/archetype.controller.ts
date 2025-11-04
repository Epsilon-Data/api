import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ArchetypeService } from './archetype.service';
import {
  ArchetypeDto,
  ArchetypeSummaryDto,
  UpdateArchetypeAttributesDto,
} from './dto';
import { Request } from 'express';
import {
  ApiAcceptedResponse,
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { Resource } from 'src/common/decorators/resource.decorator';
import { Scopes } from 'src/common/decorators/scopes.decorator';
import { ResourceGuard } from 'src/common/guards/resource.guard';

@ApiTags('Archetype')
@ApiBearerAuth()
@Controller('archetype')
@Resource('project')
export class ArchetypeController {
  private readonly logger = new Logger(ArchetypeController.name);
  constructor(private readonly archetypeService: ArchetypeService) {}

  @UseGuards(ResourceGuard)
  @Scopes('view')
  @Get(':projectId')
  @ApiOperation({ summary: 'Get list of archetypes for a project' })
  @ApiOkResponse({
    description: 'List of Archetypes for project returned',
    type: ArchetypeSummaryDto,
    isArray: true,
  })
  async getArchetypes(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return await this.archetypeService.fetchArchetypes(projectId);
  }

  @UseGuards(ResourceGuard)
  @Scopes('view')
  @Get(':projectId/:archetypeId')
  @ApiOperation({ summary: 'Get project archetype details' })
  @ApiOkResponse({
    description: 'Archetypes details returned',
    type: ArchetypeDto,
  })
  async getArchetype(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('archetypeId') archetypeId: string,
  ) {
    return await this.archetypeService.getArchetypeDetails(
      projectId,
      archetypeId,
    );
  }

  @UseGuards(ResourceGuard)
  @Scopes('view', 'edit')
  @Post(':projectId')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Create archetype for a project' })
  @ApiAcceptedResponse({
    description: 'Archetype creation accepted for processing',
  })
  createArchetype(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() archetype: ArchetypeDto,
    @Req() request: Request,
  ) {
    const username = request.auth.payload.preferred_username.toString();
    return this.archetypeService.createArchetype(
      username,
      projectId,
      archetype,
    );
  }

  // TODO: classifications needs to be updated in a separate classification call
  @UseGuards(ResourceGuard)
  @Scopes('view, edit')
  @Put(':projectId/:archetypeId')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Update archetype for a project' })
  @ApiAcceptedResponse({
    description: 'Archetype update accepted for processing',
  })
  updateArchetype(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('archetypeId') archetypeId: string,
    @Body() archetype: ArchetypeDto,
    @Req() request: Request,
  ) {
    const username = request.auth.payload.preferred_username.toString();
    return this.archetypeService.updateArchetype(
      username,
      projectId,
      archetypeId,
      archetype,
    );
  }

  @UseGuards(ResourceGuard)
  @Scopes('view, edit')
  @Patch(':projectId/:archetypeId')
  @ApiOperation({ summary: 'Update archetype details for a project' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({
    description: 'Archetype details updated',
  })
  updateArchetypeDetails(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('archetypeId') archetypeId: string,
    @Body() attributes: UpdateArchetypeAttributesDto,
  ) {
    return this.archetypeService.updateArchetypeDetails(
      projectId,
      archetypeId,
      attributes,
    );
  }

  @UseGuards(ResourceGuard)
  @Scopes('view, edit')
  @Delete(':projectId/:archetypeId')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Delete archetype for a project' })
  @ApiAcceptedResponse({
    description: 'Archetype delete accepted for processing',
  })
  async deleteArchetype(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('archetypeId') archetypeId: string,
  ) {
    return await this.archetypeService.deleteArchetype(projectId, archetypeId);
  }
}

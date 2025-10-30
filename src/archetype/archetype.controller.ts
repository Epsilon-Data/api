import {
  Body,
  Controller,
  Delete,
  Get,
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
import { ArchetypeDto, ArchetypeStatus } from './dto';
import { Request } from 'express';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { Resource } from 'src/common/decorators/resource.decorator';
import { Scopes } from 'src/common/decorators/scopes.decorator';
import { ResourceGuard } from 'src/common/guards/resource.guard';

const testArchetype = {
  projectId: '638c6f81-00c8-47f4-82ec-6b94240e757d',
  name: 'Test Draft Update 4',
  archetypeId: 'Xa7BAIWZCA8u',
  status: ArchetypeStatus.DRAFT,
  nodes: [
    {
      id: 'node_5',
      data: {
        label: 'Heart rate',
        level: 2,
      },
      position: {
        x: 242,
        y: 415.85938,
      },
      type: 'category',
    },
    {
      id: '2697b3ce-937e-47bd-b719-b2bd5a3ee481',
      data: {
        label: 'heart_rate',
        level: 3,
      },
      position: {
        x: 242,
        y: 615.85938,
      },
      type: 'column',
    },
    {
      id: 'node_0',
      data: {
        label: 'Person',
        level: 0,
      },
      position: {
        x: 320,
        y: 200,
      },
      type: 'root',
    },
    {
      id: 'node_2',
      data: {
        label: 'Health',
        level: 1,
      },
      position: {
        x: 346,
        y: 316.85938,
      },
      type: 'category',
    },
    {
      id: 'node_3',
      data: {
        label: 'Diagnosis',
        level: 1,
      },
      position: {
        x: 722,
        y: 326.85938,
      },
      type: 'category',
    },
    {
      id: '320eec06-b6d3-40b6-9567-1a7aed31ec00',
      data: {
        label: 'diagnosis',
        level: 2,
      },
      position: {
        x: 722,
        y: 526.85938,
      },
      type: 'column',
    },
    {
      id: 'node_1',
      data: {
        label: 'Demographics',
        level: 1,
      },
      position: {
        x: -9,
        y: 321.85938,
      },
      type: 'category',
    },
    {
      id: 'node_4',
      data: {
        label: 'Blood pressure',
        level: 2,
      },
      position: {
        x: 497,
        y: 406.85938,
      },
      type: 'category',
    },
    {
      id: '35dbb951-d8fb-4580-b8de-09d763d31a27',
      data: {
        label: 'blood_pressure',
        level: 3,
      },
      position: {
        x: 497,
        y: 606.85938,
      },
      type: 'column',
    },
  ],
  edges: [
    {
      id: 'edge_node_2_node_5',
      source: 'node_2',
      target: 'node_5',
    },
    {
      source: 'node_5',
      target: '2697b3ce-937e-47bd-b719-b2bd5a3ee481',
      id: 'edge_node_5_2697b3ce-937e-47bd-b719-b2bd5a3ee481',
    },
    {
      id: 'edge_node_0_node_2',
      source: 'node_0',
      target: 'node_2',
    },
    {
      id: 'edge_node_0_node_3',
      source: 'node_0',
      target: 'node_3',
    },
    {
      source: 'node_3',
      target: '320eec06-b6d3-40b6-9567-1a7aed31ec00',
      id: 'edge_node_3_320eec06-b6d3-40b6-9567-1a7aed31ec00',
    },
    {
      id: 'edge_node_0_node_1',
      source: 'node_0',
      target: 'node_1',
    },
    {
      id: 'edge_node_2_node_4',
      source: 'node_2',
      target: 'node_4',
    },
    {
      source: 'node_4',
      target: '35dbb951-d8fb-4580-b8de-09d763d31a27',
      id: 'edge_node_4_35dbb951-d8fb-4580-b8de-09d763d31a27',
    },
  ],
  permissions: [
    {
      id: 'node_5',
      permission: 'DETAILED',
    },
    {
      id: 'node_2',
      permission: 'DETAILED',
    },
    {
      id: 'node_3',
      permission: 'HIGH_LEVEL',
    },
    {
      id: 'node_1',
      permission: 'DETAILED',
    },
    {
      id: 'node_4',
      permission: 'DETAILED',
    },
  ],
} as ArchetypeDto;

@ApiTags('Archetype')
@Controller('archetype')
@Resource('project')
export class ArchetypeController {
  private readonly logger = new Logger(ArchetypeController.name);
  constructor(private readonly archetypeService: ArchetypeService) {}

  @UseGuards(ResourceGuard)
  @Scopes('view')
  @Get(':projectId')
  @ApiOperation({ summary: 'Get list of archetypes for a project' })
  async getArchetypes(@Param('projectId', ParseUUIDPipe) projectId: string) {
    await this.archetypeService.updateArchetype(testArchetype);
    // const response =
    //   await this.archetypeService.getAnalysisArchetype(projectId);
    // this.logger.debug(response);
    return await this.archetypeService.fetchArchetypes(projectId);
  }

  @UseGuards(ResourceGuard)
  @Scopes('view')
  @Get(':projectId/:archetypeId')
  @ApiOperation({ summary: 'Get project archetype details' })
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
  @Scopes('view, edit')
  @Post(':projectId')
  @ApiOperation({ summary: 'Create archetype for a project' })
  createArchetype(@Body() archetype: ArchetypeDto, @Req() request: Request) {
    const username = request.auth.payload.preferred_username.toString();
    return this.archetypeService.createArchetype(username, archetype);
  }

  // TODO: classifications needs to be updated in a separate classification call
  @UseGuards(ResourceGuard)
  @Scopes('view, edit')
  @Put(':projectId/:archetypeId')
  @ApiOperation({ summary: 'Update archetype for a project' })
  updateArchetype(@Body() archetype: ArchetypeDto) {
    return this.archetypeService.updateArchetype(archetype);
  }

  @UseGuards(ResourceGuard)
  @Scopes('view, edit')
  @Patch(':projectId/:archetypeId')
  @ApiOperation({ summary: 'Update archetype details for a project' })
  updateArchetypeDetails(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('archetypeId') archetypeId: string,
    @Body() attributes: unknown,
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
  @ApiOperation({ summary: 'Delete archetype for a project' })
  async deleteArchetype(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('archetypeId') archetypeId: string,
  ) {
    return await this.archetypeService.deleteArchetype(projectId, archetypeId);
  }
}

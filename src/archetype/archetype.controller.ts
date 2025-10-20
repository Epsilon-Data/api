import {
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ArchetypeService } from './archetype.service';
import {
  ArchetypeDto,
  // ArchetypeNodeType,
  // ArchetypePermission,
  // ArchetypeStatus,
} from './dto';
import { Request } from 'express';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { Resource } from 'src/common/decorators/resource.decorator';
import { Scopes } from 'src/common/decorators/scopes.decorator';
import { ResourceGuard } from 'src/common/guards/resource.guard';

// const testArchetype: ArchetypeDto = {
//   projectId: '8b422bfc-d830-439a-8982-4a8af193dee4',
//   name: 'Test 222',
//   nodes: [
//     {
//       id: 'node-0',
//       data: {
//         label: 'Person',
//         level: 0,
//       },
//       position: {
//         x: 0,
//         y: 1,
//       },
//       type: 'root' as ArchetypeNodeType,
//     },
//     {
//       id: 'node-1',
//       data: {
//         label: 'Age',
//         level: 1,
//       },
//       position: {
//         x: 100.5,
//         y: 200,
//       },
//       type: 'category' as ArchetypeNodeType,
//     },
//     {
//       id: 'node-2',
//       data: {
//         label: 'Stable',
//         level: 1,
//       },
//       position: {
//         x: 100.5,
//         y: 200,
//       },
//       type: 'category' as ArchetypeNodeType,
//     },
//     {
//       id: 'f8a951d7-9c21-4cb1-8383-959c11e91861',
//       data: {
//         label: 'public.stable',
//         level: 2,
//       },
//       position: {
//         x: 100.5,
//         y: 200,
//       },
//       type: 'column' as ArchetypeNodeType,
//     },
//     {
//       id: '154016d8-a140-40e4-9159-2c3bb4317629',
//       data: {
//         label: 'public.stable',
//         level: 2,
//       },
//       position: {
//         x: 100.5,
//         y: 200,
//       },
//       type: 'column' as ArchetypeNodeType,
//     },
//   ],
//   edges: [
//     {
//       id: 'edge-1',
//       source: 'node-0',
//       target: 'node-1',
//     },
//     {
//       id: 'edge-1',
//       source: 'node-0',
//       target: 'node-2',
//     },
//     {
//       id: 'edge-3',
//       source: 'node-1',
//       target: 'f8a951d7-9c21-4cb1-8383-959c11e91861',
//     },
//     {
//       id: 'edge-4',
//       source: 'node-2',
//       target: '154016d8-a140-40e4-9159-2c3bb4317629',
//     },
//   ],
//   permissions: [
//     {
//       id: 'node-1',
//       permission: 'HIGH' as ArchetypePermission,
//     },
//     {
//       id: 'node-2',
//       permission: 'DETAILED' as ArchetypePermission,
//     },
//   ],
//   status: 'DRAFT' as ArchetypeStatus,
// };

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
    // this.logger.debug(JSON.stringify(testArchetype));
    // await this.archetypeService.createArchetype('owner', testArchetype);
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

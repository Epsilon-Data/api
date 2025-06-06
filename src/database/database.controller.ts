import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
} from '@nestjs/common';
import { DatabaseService } from './database.service';

import { Request } from 'express';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('Database')
@Controller('database')
export class DatabaseController {
  constructor(private databaseSourceService: DatabaseService) {}

  @Get(':projectId/summary')
  @ApiOperation({ summary: 'Get database summary' })
  async summary(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return await this.databaseSourceService.summary(projectId);
  }

  @Get(':projectId/tables')
  @ApiOperation({ summary: 'Get database tables' })
  async tables(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return await this.databaseSourceService.tables(projectId);
  }

  @Get(':projectId/columns')
  @ApiOperation({ summary: 'Get database columns' })
  async columns(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return await this.databaseSourceService.columns(projectId);
  }

  // @Get(':projectId/permissions')
  // async permissions(@Param('projectId', ParseUUIDPipe) projectId: string) {
  //   return await this.databaseSourceService.permissions(projectId);
  // }

  // @Post(':projectId/permissions')
  // addPermissions(
  //   @Param('projectId', ParseUUIDPipe) projectId: string,
  //   @Body() permissions: any,
  // ) {
  //   return this.databaseSourceService.addPermissions(projectId, permissions);
  // }

  @Post(':projectId/sync')
  @ApiOperation({ summary: 'Sync Database' })
  syncDatasource(
    @Req() request: Request,
    @Param('projectId', ParseUUIDPipe) projectId: string,
  ) {
    const userId = request.auth.payload.sub.toString();
    return this.databaseSourceService.syncDatasource(userId, projectId);
  }
}

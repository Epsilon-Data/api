import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { KeycloakAdminService } from './keycloak/keycloak-admin.service';
import { AdminService } from './admin.service';
import { RolesGuard } from 'src/common/guards/roles.guard';
import {
  AdminProjectsQueryDto,
  AdminRequestsQueryDto,
  PaginationQueryDto,
  AdminNotificationsQueryDto,
  AdminArchetypesQueryDto,
} from './dto';

@ApiTags('Admin')
@ApiBearerAuth()
@Controller('admin')
@UseGuards(new RolesGuard(['admin']))
export class AdminController {
  constructor(
    private readonly keycloakService: KeycloakAdminService,
    private readonly adminService: AdminService,
  ) {}

  // User endpoints
  @Get('users')
  @ApiOperation({ summary: 'Get all users' })
  async getUsers() {
    return this.keycloakService.getAllUsersAndLastLogin();
  }

  @Get('users/:id')
  @ApiOperation({ summary: 'Get user by id' })
  async getUserById(@Param('id') id: string) {
    return this.keycloakService.getUserInfoById(id);
  }

  // Stats endpoint
  @Get('stats')
  @ApiOperation({ summary: 'Get dashboard statistics' })
  async getStats() {
    return this.adminService.getStats();
  }

  // Project endpoints
  @Get('projects')
  @ApiOperation({ summary: 'Get all projects with pagination and filters' })
  async getProjects(@Query() query: AdminProjectsQueryDto) {
    return this.adminService.getProjects(query);
  }

  @Get('projects/:id')
  @ApiOperation({ summary: 'Get project by id' })
  async getProjectById(@Param('id') id: string) {
    return this.adminService.getProjectById(id);
  }

  @Get('projects/:id/users')
  @ApiOperation({ summary: 'Get users with access to a project' })
  async getProjectUsers(@Param('id') id: string) {
    return this.adminService.getProjectUsers(id);
  }

  // Request endpoints
  @Get('requests')
  @ApiOperation({ summary: 'Get all requests with pagination and filters' })
  async getRequests(@Query() query: AdminRequestsQueryDto) {
    return this.adminService.getRequests(query);
  }

  @Get('requests/:id')
  @ApiOperation({ summary: 'Get request by id' })
  async getRequestById(@Param('id') id: string) {
    return this.adminService.getRequestById(id);
  }

  // Comment endpoints
  @Get('comments')
  @ApiOperation({ summary: 'Get all comments with pagination' })
  async getComments(@Query() query: PaginationQueryDto) {
    return this.adminService.getComments(query);
  }

  // Notification endpoints
  @Get('notifications')
  @ApiOperation({
    summary: 'Get all notifications with pagination and filters',
  })
  async getNotifications(@Query() query: AdminNotificationsQueryDto) {
    return this.adminService.getNotifications(query);
  }

  // Archetype endpoints
  @Get('archetypes')
  @ApiOperation({
    summary: 'Get all archetypes with pagination and filters',
  })
  async getArchetypes(@Query() query: AdminArchetypesQueryDto) {
    return this.adminService.getArchetypes(query);
  }

  @Get('projects/:id/archetypes')
  @ApiOperation({ summary: 'Get archetypes for a specific project' })
  async getProjectArchetypes(@Param('id') id: string) {
    return this.adminService.getProjectArchetypes(id);
  }

  @Get('archetypes/:projectId/:archetypeId')
  @ApiOperation({
    summary: 'Get archetype details by project and archetype ID',
  })
  async getArchetypeById(
    @Param('projectId') projectId: string,
    @Param('archetypeId') archetypeId: string,
  ) {
    return this.adminService.getArchetypeById(projectId, archetypeId);
  }
}

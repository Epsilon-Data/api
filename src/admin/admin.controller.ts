import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { KeycloakAdminService } from './keycloak/keycloak-admin.service';
import { ScopesGuard } from 'src/common/guards/scopes.guard';
// TODO: currently not in use, might move into project controller
@ApiTags('Keycloak Admin')
@ApiBearerAuth()
@Controller('admin')
export class AdminController {
  constructor(private readonly keycloakService: KeycloakAdminService) {}

  @Get('users')
  @ApiOperation({ summary: 'Get all users' })
  @UseGuards(new ScopesGuard('api.permissions.users.read'))
  async getUsers() {
    return this.keycloakService.getAllUsersAndLastLogin();
  }

  @Get('users/:id')
  @ApiOperation({ summary: 'Get user by id' })
  @UseGuards(new ScopesGuard('api.permissions.users.read'))
  async getUserById(@Param('id') id: string) {
    return this.keycloakService.getUserInfoById(id);
  }
}

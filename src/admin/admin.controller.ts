import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { KeycloakAdminService } from './keycloak/keycloak.admin.service';
import { ScopesGuard } from 'src/common/guards/scopes.guard';

@ApiTags('Keycloak Admin')
@Controller('admin')
export class AdminController {
  constructor(private readonly keycloakService: KeycloakAdminService) {}

  @Get('users')
  @ApiOperation({ summary: 'Get all users' })
  @UseGuards(new ScopesGuard('api.permissions.users.read'))
  async getUsers() {
    // TODO: need some proper error handling here
    return this.keycloakService.getAllUsersAndLastLogin();
  }

  @Get('users/:id')
  @ApiOperation({ summary: 'Get user by id' })
  @UseGuards(new ScopesGuard('api.permissions.users.read'))
  async getUserById(@Param('id') id: string) {
    // TODO: need some proper error handling here
    return this.keycloakService.getUserById(id);
  }
}

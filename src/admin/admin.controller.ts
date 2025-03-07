import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { KeycloakAdminService } from './keycloak/keycloak.admin.service';
import { ScopesGuard } from 'src/auth/scopes.guard';
import { ConfigService } from '@nestjs/config';
import { Credentials } from '@epsilon-data/keycloak-admin-client';

@Controller('admin')
export class AdminController {
  credentials: Credentials;
  constructor(
    private readonly configService: ConfigService,
    private readonly keycloakService: KeycloakAdminService,
  ) {
    this.credentials = {
      grantType: 'client_credentials',
      clientId: this.configService.get<string>('admin.clientId'),
      clientSecret: this.configService.get<string>('admin.clientSecret'),
    };
  }

  @Get('users')
  @UseGuards(new ScopesGuard('api.permissions.users.read'))
  async getUsers() {
    // TODO: need some proper error handling here
    return this.keycloakService.getAllUsers();
  }

  @Get('users/:id')
  @UseGuards(new ScopesGuard('api.permissions.users.read'))
  async getUserById(@Param('id') id: string) {
    // TODO: need some proper error handling here
    return this.keycloakService.getUserById(id);
  }
}

import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { KeycloakService } from './keycloak/keycloak.service';
import { AuthGuard } from 'src/auth/auth.guard';
import { ConfigService } from '@nestjs/config';
import { Credentials } from '@epsilon-data/keycloak-admin-client';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { KeycloakAdminService } from './keycloak/keycloak.admin.service';
import { ScopesGuard } from 'src/auth/scopes.guard';
// import { ConfigService } from '@nestjs/config';
// import { Credentials } from '@epsilon-data/keycloak-admin-client';

@ApiTags('Keycloak Admin')
@Controller('admin')
export class AdminController {
  // credentials: Credentials;
  constructor(
    // private readonly configService: ConfigService,
    private readonly keycloakService: KeycloakAdminService,
  ) {
    // this.credentials = {
    //   grantType: 'client_credentials',
    //   clientId: this.configService.get<string>('admin.clientId'),
    //   clientSecret: this.configService.get<string>('admin.clientSecret'),
    // };
  }

  @Get('users')
  @ApiOperation({ summary: 'Get all users' })
  @UseGuards(new AuthGuard('api.permissions.users.read'))
  @UseGuards(new ScopesGuard('api.permissions.users.read'))
  async getUsers() {
    // TODO: need some proper error handling here
    return this.keycloakService.getAllUsersAndLastLogin();
  }

  @Get('users/:id')
  @ApiOperation({ summary: 'Get user by id' })
  @UseGuards(new AuthGuard('api.permissions.users.read'))
  @UseGuards(new ScopesGuard('api.permissions.users.read'))
  async getUserById(@Param('id') id: string) {
    // TODO: need some proper error handling here
    return this.keycloakService.getUserById(id);
  }
}

import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { KeycloakService } from './keycloak/keycloak.service';
import { AuthGuard } from 'src/auth/auth.guard';
import { ConfigService } from '@nestjs/config';

@Controller('admin')
export class AdminController {
  constructor(
    private readonly configService: ConfigService,
    private readonly keycloakService: KeycloakService,
  ) {}

  @Get('users')
  @UseGuards(new AuthGuard('api.permissions.users.read'))
  async getUsers() {
    // TODO: need some proper error handling here
    return this.keycloakService.getAllUsers();
  }

  @Get('users/:id')
  @UseGuards(new AuthGuard('api.permissions.users.read'))
  async getUserById(@Param('id') id: string) {
    // TODO: need some proper error handling here
    return this.keycloakService.getUserById(id);
  }
}

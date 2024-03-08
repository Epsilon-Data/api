import { Controller, Get, UseGuards } from '@nestjs/common';
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
    return this.keycloakService.getAllUsers();
  }
}

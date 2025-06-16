import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { AnalysisService } from './analysis.service';
import { ApiOperation } from '@nestjs/swagger';
import { KeycloakAdminService } from 'src/admin/keycloak/keycloak.admin.service';
import { KeycloakService } from 'src/auth/keycloak/keycloak.service';
import { ProjectService } from 'src/project/project.service';
import { LoginDto } from './dto/login.dto';

@Controller('analysis')
export class AnalysisController {
  constructor(
    private readonly analysisService: AnalysisService,
    private readonly keycloakService: KeycloakAdminService,
    private readonly projectService: ProjectService,
    private readonly keycloakConnect: KeycloakService,
  ) {}

  @Post('auth')
  @ApiOperation({ summary: 'Get access token' })
  async getAccessToken(@Body() login: LoginDto) {
    return await this.keycloakService.getAccessToken(login);
  }

  @Get('datasets')
  @ApiOperation({ summary: 'Get list of all projects for logged in user' })
  async getUserProjects(@Req() request: Request) {
    // check for user resorce permissions
    // TODO: perhaps call this once and cache
    const authzRequest = {
      response_mode: 'permissions',
    };
    const permissions = await this.keycloakConnect.getPermissions(
      authzRequest,
      request,
    );
    return await this.projectService.getUserProjects(permissions);
  }
}

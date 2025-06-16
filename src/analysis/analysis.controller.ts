import { Controller, Get, Query } from '@nestjs/common';
import { AnalysisService } from './analysis.service';
import { ApiOperation } from '@nestjs/swagger';
import { KeycloakAdminService } from 'src/admin/keycloak/keycloak.admin.service';

@Controller('analysis')
export class AnalysisController {
  constructor(
    private readonly analysisService: AnalysisService,
    private readonly keycloakService: KeycloakAdminService,
  ) {}
  @Get('access-token')
  @ApiOperation({ summary: 'Get access token' })
  async getAccessToken(
    @Query('username') username: string,
    @Query('password') password: string,
  ) {
    return await this.keycloakService.getAccessToken(username, password);
  }
}

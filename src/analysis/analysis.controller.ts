import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { KeycloakAdminService } from 'src/admin/keycloak/keycloak.admin.service';
import { KeycloakService } from 'src/auth/keycloak/keycloak.service';
import { ProjectService } from 'src/project/project.service';
import { LoginDto } from './dto/login.dto';
import { ArchetypeService } from 'src/archetype/archetype.service';
import { DatabaseService } from 'src/database/database.service';
import { Response } from 'express';
import { ConfigService } from '@nestjs/config';

@Controller('analysis')
export class AnalysisController {
  constructor(
    private readonly archetypeService: ArchetypeService,
    private readonly keycloakService: KeycloakAdminService,
    private readonly projectService: ProjectService,
    private readonly keycloakConnect: KeycloakService,
    private readonly databaseService: DatabaseService,
    private readonly configService: ConfigService,
  ) {}

  @Get('auth/github')
  @ApiOperation({ summary: 'Keycloak GitHub OAuth flow' })
  async githubAuth(@Res() res: Response) {
    try {
      const coordinatorDetails = this.configService.get<any>('coordinator');
      const adminConfig = this.configService.get<any>('admin');
      const issuerBaseURL = adminConfig.issuerBaseURL;
      const keycloakBaseUrl = `${issuerBaseURL}/realms/epsilon`;
      const clientId = coordinatorDetails.clientId;
      const redirectUri = coordinatorDetails.redirectUri;
      const state = Math.random().toString(36).substring(2, 15);
      const keycloakGitHubUrl = `${keycloakBaseUrl}/protocol/openid-connect/auth?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&kc_idp_hint=github&state=${state}`;
      res.redirect(keycloakGitHubUrl);
    } catch (error) {
      res
        .status(500)
        .json({ error: 'Failed to initiate GitHub authentication' });
    }
  }

  @Post('auth')
  @ApiOperation({ summary: 'Get access token' })
  async getAccessToken(@Body() login: LoginDto) {
    return await this.keycloakService.getAccessToken(login);
  }

  @Get('datasets')
  // TODO: check if they have analysis scope for this and SDK scope
  @ApiOperation({ summary: 'Get list of all projects for logged in user' })
  async getUserDatasets(@Req() request: Request) {
    // check for user resource permissions
    // TODO: perhaps call this once and cache
    const authzRequest = {
      response_mode: 'permissions',
    };
    const permissions = await this.keycloakConnect.getPermissions(
      authzRequest,
      request,
    );
    console.log(permissions);
    //TODO: may need a different query for the project to get info for SDK
    return await this.projectService.getUserProjects([]);
  }

  @Get('datasets/:projectId')
  // TODO: check if they have analysis scope for this and SDK scope
  @ApiOperation({ summary: 'Get archetype for a dataset' })
  async getDatasetArchetype(
    @Param('projectId', ParseUUIDPipe) projectId: string,
  ) {
    return this.archetypeService.getAnalysisArchetype(projectId);
  }

  @Get('test-token')
  @ApiOperation({ summary: 'Test JWT token - returns token info' })
  async testToken(@Req() request: any) {
    const token = request.auth?.token || request.headers?.authorization;
    const payload = request.auth?.payload || null;

    return {
      success: true,
      message: 'Token is valid!',
      tokenInfo: {
        token: token ? `${token.substring(0, 20)}...` : 'No token found',
        hasAuth: !!request.auth,
        payload: payload
          ? {
              issuer: payload.iss,
              audience: payload.aud,
              client: payload.azp,
              username: payload.preferred_username,
              email: payload.email,
              name: payload.name,
              scopes: payload.scope,
              roles: payload.realm_access?.roles,
              expires: new Date(payload.exp * 1000).toISOString(),
              issued: new Date(payload.iat * 1000).toISOString(),
            }
          : 'No payload found',
      },
      requestInfo: {
        method: request.method,
        url: request.url,
        headers: {
          authorization: request.headers?.authorization
            ? 'Bearer token present'
            : 'No auth header',
          contentType: request.headers?.['content-type'],
        },
      },
    };
  }

  @Get('database/credentials/:projectId')
  @ApiOperation({ summary: 'Get database credentials for coordinator' })
  async getDatabaseCredentials(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Req() request: Request,
  ) {
    const dbId = await this.databaseService.findDbId(projectId);

    return {
      projectId,
      databaseId: dbId,
      connectionInfo: {
        host: process.env.DATABASE_HOST,
        port: process.env.DATABASE_PORT,
        database: process.env.DATABASE_NAME,
      },
    };
  }
}

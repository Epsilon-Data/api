import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ProxyService } from './proxy.service';
import {
  GenerateTokenDto,
  GenerateTokenResponseDto,
  InstallTokenSummaryDto,
  ProxyRegisterDto,
  ProxyRegisterResponseDto,
  ProxyHeartbeatDto,
  ProxyHeartbeatResponseDto,
  ProxyStatusResponseDto,
  ProxyInfoResponseDto,
  ProxyMetadataDto,
} from './dto';
import { Resource } from 'src/common/decorators/resource.decorator';
import { Scopes } from 'src/common/decorators/scopes.decorator';
import { ResourceGuard } from 'src/common/guards/resource.guard';
import { Public } from 'src/common/decorators/public.decorator';

@ApiTags('Proxy')
@Controller('proxy')
@Resource('project')
export class ProxyController {
  constructor(private proxyService: ProxyService) {}

  // --- Authenticated endpoints (data owner via JWT) ---

  @UseGuards(ResourceGuard)
  @Scopes('view', 'edit')
  @ApiBearerAuth()
  @Post(':projectId/token')
  @ApiOperation({ summary: 'Generate a new install token for epsilon-proxy' })
  @ApiOkResponse({ type: GenerateTokenResponseDto })
  async generateToken(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: GenerateTokenDto,
  ): Promise<GenerateTokenResponseDto> {
    return this.proxyService.generateInstallToken(projectId, dto.name);
  }

  @UseGuards(ResourceGuard)
  @Scopes('view')
  @ApiBearerAuth()
  @Get(':projectId/tokens')
  @ApiOperation({ summary: 'List all install tokens for a project' })
  @ApiOkResponse({ type: [InstallTokenSummaryDto] })
  async listTokens(
    @Param('projectId', ParseUUIDPipe) projectId: string,
  ): Promise<InstallTokenSummaryDto[]> {
    return this.proxyService.listInstallTokens(projectId);
  }

  @UseGuards(ResourceGuard)
  @Scopes('view', 'edit')
  @ApiBearerAuth()
  @Delete(':projectId/tokens/:tokenId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke (delete) an install token' })
  async revokeToken(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('tokenId', ParseUUIDPipe) tokenId: string,
  ) {
    return this.proxyService.revokeInstallToken(projectId, tokenId);
  }

  @UseGuards(ResourceGuard)
  @Scopes('view')
  @ApiBearerAuth()
  @Get(':projectId/status')
  @ApiOperation({ summary: 'Get proxy status for a project' })
  @ApiOkResponse({ type: ProxyStatusResponseDto })
  async getStatus(
    @Param('projectId', ParseUUIDPipe) projectId: string,
  ): Promise<ProxyStatusResponseDto> {
    return this.proxyService.getStatus(projectId);
  }

  @UseGuards(ResourceGuard)
  @Scopes('view')
  @ApiBearerAuth()
  @Get(':projectId/info')
  @ApiOperation({
    summary: 'Get proxy connection info (for coordinator/middleware)',
  })
  @ApiOkResponse({ type: ProxyInfoResponseDto })
  async getProxyInfo(
    @Param('projectId', ParseUUIDPipe) projectId: string,
  ): Promise<ProxyInfoResponseDto> {
    return this.proxyService.getProxyInfo(projectId);
  }

  @UseGuards(ResourceGuard)
  @Scopes('view', 'edit', 'delete')
  @ApiBearerAuth()
  @Delete(':projectId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Unregister proxy for a project' })
  async unregister(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.proxyService.unregister(projectId);
  }

  // --- Public endpoints (called by epsilon-proxy binary, no JWT) ---

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Register epsilon-proxy (called by proxy binary)' })
  @ApiOkResponse({ type: ProxyRegisterResponseDto })
  async register(
    @Body() dto: ProxyRegisterDto,
  ): Promise<ProxyRegisterResponseDto> {
    return this.proxyService.register(dto);
  }

  @Public()
  @Post('heartbeat')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Proxy heartbeat (called by proxy binary every 30s)',
  })
  @ApiOkResponse({ type: ProxyHeartbeatResponseDto })
  async heartbeat(
    @Body() dto: ProxyHeartbeatDto,
  ): Promise<ProxyHeartbeatResponseDto> {
    return this.proxyService.heartbeat(dto.proxyToken, {
      version: dto.version,
      databaseReachable: dto.databaseReachable,
      tunnelConnected: dto.tunnelConnected,
    });
  }

  @Public()
  @Post('metadata')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Upload crawled schema metadata from proxy' })
  async uploadMetadata(@Body() dto: ProxyMetadataDto) {
    return this.proxyService.handleMetadataUpload(dto);
  }

  @Public()
  @Post('offline')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Proxy going offline (called on SIGTERM)' })
  async offline(@Body() body: { proxyToken: string }) {
    return this.proxyService.markOffline(body.proxyToken);
  }
}

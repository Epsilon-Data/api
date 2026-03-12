import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { randomBytes, createHash } from 'crypto';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import {
  ProxyRegisterDto,
  ProxyRegisterResponseDto,
  ProxyStatusResponseDto,
  ProxyInfoResponseDto,
  GenerateTokenResponseDto,
  InstallTokenSummaryDto,
  ProxyMetadataDto,
  ProxyHeartbeatResponseDto,
} from './dto';
import { QueueService } from 'src/queue/queue.service';
import { RatholeConfigService } from './rathole-config.service';

const PROXY_PORT_BASE = 10000;
const PROXY_PORT_MAX = 10099;

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class ProxyService {
  private readonly logger = new Logger(ProxyService.name);

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private queueService: QueueService,
    private ratholeConfig: RatholeConfigService,
  ) {}

  async generateInstallToken(
    projectId: string,
    name: string,
  ): Promise<GenerateTokenResponseDto> {
    const project = await this.prisma.project.findUnique({
      where: { projectId },
      select: { connectionType: true },
    });

    if (!project) throw new NotFoundException('Project not found');
    if (project.connectionType !== 'PROXY') {
      throw new BadRequestException(
        'Project connection type must be PROXY to generate install token',
      );
    }

    // Clean up existing tokens with the same name to prevent duplicates
    await this.prisma.proxyInstallToken.deleteMany({
      where: { projectId, name },
    });

    const plainToken = `ept_${randomBytes(24).toString('hex')}`;
    const tokenH = hashToken(plainToken);
    const tokenPrefix = plainToken.substring(0, 12);

    const record = await this.prisma.proxyInstallToken.create({
      data: {
        projectId,
        name,
        tokenHash: tokenH,
        tokenPrefix,
      },
    });

    return {
      id: record.id,
      name: record.name,
      installToken: plainToken,
      tokenPrefix,
      createdAt: record.createdAt,
    };
  }

  async listInstallTokens(
    projectId: string,
  ): Promise<InstallTokenSummaryDto[]> {
    const tokens = await this.prisma.proxyInstallToken.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });

    return tokens.map((t) => ({
      id: t.id,
      name: t.name,
      tokenPrefix: t.tokenPrefix,
      createdAt: t.createdAt,
      lastUsedAt: t.lastUsedAt ?? undefined,
    }));
  }

  async revokeInstallToken(projectId: string, tokenId: string): Promise<void> {
    const token = await this.prisma.proxyInstallToken.findFirst({
      where: { id: tokenId, projectId },
    });

    if (!token) throw new NotFoundException('Token not found');

    await this.prisma.proxyInstallToken.delete({
      where: { id: tokenId },
    });

    this.logger.log(
      `Install token ${token.tokenPrefix}... revoked for project ${projectId}`,
    );
  }

  async register(dto: ProxyRegisterDto): Promise<ProxyRegisterResponseDto> {
    const tokenH = hashToken(dto.installToken);

    const installToken = await this.prisma.proxyInstallToken.findUnique({
      where: { tokenHash: tokenH },
      include: { project: { select: { projectId: true, name: true } } },
    });

    if (!installToken) {
      throw new UnauthorizedException('Invalid install token');
    }

    const projectId = installToken.projectId;

    // Reuse existing port if proxy was previously registered
    const existingProxy = await this.prisma.proxy.findUnique({
      where: { projectId },
      select: { assignedPort: true },
    });

    const proxyToken = `pt_${randomBytes(32).toString('hex')}`;
    const ratholeToken = randomBytes(32).toString('hex');
    const assignedPort =
      existingProxy?.assignedPort ?? (await this.allocatePort());

    // Use the rathole server's noise public key (shared across all proxies)
    const noisePublicKey = this.ratholeConfig.noisePublicKey || '';

    const proxy = await this.prisma.proxy.upsert({
      where: { projectId },
      create: {
        projectId,
        proxyToken,
        ratholeToken,
        noisePublicKey: noisePublicKey || null,
        assignedPort,
        status: 'OFFLINE',
        version: dto.version ?? null,
      },
      update: {
        proxyToken,
        ratholeToken,
        noisePublicKey: noisePublicKey || null,
        assignedPort,
        status: 'OFFLINE',
        version: dto.version ?? null,
      },
    });

    // Mark the token as used
    await this.prisma.proxyInstallToken.update({
      where: { id: installToken.id },
      data: { lastUsedAt: new Date() },
    });

    const serviceName = `proxy-${proxy.id}`;

    this.logger.log(
      `Proxy registered: ${proxy.id} for project ${installToken.project.name} on port ${assignedPort}`,
    );

    // Update rathole server config so the tunnel accepts this proxy
    try {
      await this.ratholeConfig.rebuildConfig();
    } catch (err) {
      this.logger.warn(
        `Failed to update rathole config: ${(err as Error).message}`,
      );
    }

    const serverAddr =
      this.config.get<string>('RATHOLE_SERVER_ADDR') || '127.0.0.1:7100';

    return {
      proxyId: proxy.id,
      proxyToken,
      ratholeToken,
      noisePublicKey,
      serverAddr,
      serviceName,
      assignedPort,
    };
  }

  async heartbeat(
    proxyToken: string,
    meta?: Record<string, unknown>,
  ): Promise<ProxyHeartbeatResponseDto> {
    const proxy = await this.prisma.proxy.findUnique({
      where: { proxyToken },
      include: { project: { select: { status: true, connectionType: true } } },
    });

    if (!proxy) throw new UnauthorizedException('Invalid proxy token');

    await this.prisma.proxy.update({
      where: { id: proxy.id },
      data: {
        status: 'ONLINE',
        lastSeenAt: new Date(),
        ...(typeof meta?.version === 'string' && { version: meta.version }),
      },
    });

    const needsCrawl =
      proxy.project.connectionType === 'PROXY' &&
      ['PENDING', 'ERROR'].includes(proxy.project.status) &&
      Boolean(meta?.databaseReachable);

    return needsCrawl ? { action: 'crawl' } : {};
  }

  async handleMetadataUpload(dto: ProxyMetadataDto) {
    const proxy = await this.prisma.proxy.findUnique({
      where: { proxyToken: dto.proxyToken },
      include: {
        project: {
          select: {
            projectId: true,
            status: true,
            connectionType: true,
            ownerId: true,
          },
        },
      },
    });

    if (!proxy) throw new UnauthorizedException('Invalid proxy token');

    if (proxy.project.connectionType !== 'PROXY') {
      throw new BadRequestException('Project is not configured for proxy mode');
    }

    if (!['PENDING', 'ERROR', 'CRAWLING'].includes(proxy.project.status)) {
      throw new BadRequestException(
        `Project status is ${proxy.project.status}, expected PENDING, ERROR or CRAWLING`,
      );
    }

    const projectId = proxy.project.projectId;
    const metadataDir = join('/tmp', 'proxy-metadata', projectId);

    mkdirSync(metadataDir, { recursive: true });
    writeFileSync(join(metadataDir, 'schema.json'), JSON.stringify(dto.schema));
    writeFileSync(join(metadataDir, 'erd.txt'), dto.erd);

    await this.prisma.project.update({
      where: { projectId },
      data: { status: 'CRAWLING' },
    });

    const { jobId } = await this.queueService.dataBrokerLoadOnlyJob(
      proxy.project.ownerId,
      projectId,
      metadataDir,
    );

    this.logger.log(
      `Metadata received from proxy for project ${projectId}, queued load-only job ${jobId}`,
    );

    return { status: 'accepted', projectId, jobId };
  }

  async markOffline(proxyToken: string) {
    const proxy = await this.prisma.proxy.findUnique({
      where: { proxyToken },
    });

    if (!proxy) throw new UnauthorizedException('Invalid proxy token');

    await this.prisma.proxy.update({
      where: { id: proxy.id },
      data: { status: 'OFFLINE', lastSeenAt: new Date() },
    });
  }

  async getStatus(projectId: string): Promise<ProxyStatusResponseDto> {
    const proxy = await this.prisma.proxy.findUnique({
      where: { projectId },
    });

    if (!proxy) {
      return {
        proxyId: '',
        status: 'PENDING',
      };
    }

    // Auto-mark offline if no heartbeat in 90 seconds
    if (
      proxy.status === 'ONLINE' &&
      proxy.lastSeenAt &&
      Date.now() - proxy.lastSeenAt.getTime() > 90_000
    ) {
      await this.prisma.proxy.update({
        where: { id: proxy.id },
        data: { status: 'OFFLINE' },
      });
      proxy.status = 'OFFLINE';
    }

    return {
      proxyId: proxy.id,
      status: proxy.status,
      version: proxy.version ?? undefined,
      lastSeenAt: proxy.lastSeenAt ?? undefined,
      assignedPort: proxy.assignedPort ?? undefined,
    };
  }

  async getProxyInfo(projectId: string): Promise<ProxyInfoResponseDto> {
    const proxy = await this.prisma.proxy.findUnique({
      where: { projectId },
    });

    if (!proxy) throw new NotFoundException('No proxy configured');
    if (!proxy.proxyToken || !proxy.assignedPort) {
      throw new BadRequestException('Proxy not fully registered');
    }

    return {
      proxyId: proxy.id,
      proxyToken: proxy.proxyToken,
      assignedPort: proxy.assignedPort,
      status: proxy.status,
    };
  }

  async unregister(projectId: string) {
    const proxy = await this.prisma.proxy.findUnique({
      where: { projectId },
    });

    if (!proxy) throw new NotFoundException('No proxy configured');

    await this.prisma.proxy.delete({ where: { id: proxy.id } });

    // Remove this proxy's service from the rathole server config
    try {
      await this.ratholeConfig.rebuildConfig();
    } catch (err) {
      this.logger.warn(
        `Failed to update rathole config: ${(err as Error).message}`,
      );
    }

    this.logger.log(`Proxy unregistered for project ${projectId}`);
  }

  private async allocatePort(): Promise<number> {
    const usedPorts = await this.prisma.proxy.findMany({
      where: { assignedPort: { not: null } },
      select: { assignedPort: true },
    });

    const used = new Set(usedPorts.map((p) => p.assignedPort));

    for (let port = PROXY_PORT_BASE; port <= PROXY_PORT_MAX; port++) {
      if (!used.has(port)) return port;
    }

    throw new BadRequestException('No available proxy ports (max 100 proxies)');
  }
}

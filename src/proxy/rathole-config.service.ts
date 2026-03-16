import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/prisma/prisma.service';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';

// Production: Docker volume at /rathole-config/server.toml
// Local dev: sibling platform repo at ../platform/dev/rathole-config/server.toml
const DEV_CONFIG_PATH = resolve(
  process.cwd(),
  '..',
  'platform',
  'dev',
  'rathole-config',
  'server.toml',
);

// Dev keypair for local testing (production uses env vars)
const DEV_NOISE_PRIVATE_KEY = 'Y7Rv+VdKogaOCx+ug4ktBwztOJcH7MEbnZ7L2+jqV4Y=';
const DEV_NOISE_PUBLIC_KEY = 'oKp5T9B2ClJGcjVNtZI415npcTUti+/SaEuiVQWpbkw=';

/**
 * Manages the rathole server TOML config file.
 *
 * On startup, rebuilds the config from all registered proxies in the database.
 * On register/unregister, rewrites the full config so rathole picks up the change
 * (rathole watches the file for hot-reload).
 */
@Injectable()
export class RatholeConfigService implements OnModuleInit {
  private readonly logger = new Logger(RatholeConfigService.name);
  private readonly configPath: string;
  private readonly noisePrivateKey: string;
  private readonly bindPort: string;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {
    this.configPath =
      this.config.get<string>('RATHOLE_CONFIG_PATH') || DEV_CONFIG_PATH;
    this.noisePrivateKey =
      this.config.get<string>('RATHOLE_NOISE_PRIVATE_KEY') ||
      DEV_NOISE_PRIVATE_KEY;
    // Rathole inside Docker always binds on 7000. Docker maps host 7100 → container 7000 for local dev.
    this.bindPort = this.config.get<string>('RATHOLE_BIND_PORT') || '7000';
  }

  /** Public key to send to proxy clients so they can verify the server. */
  get noisePublicKey(): string {
    return (
      this.config.get<string>('RATHOLE_NOISE_PUBLIC_KEY') ||
      DEV_NOISE_PUBLIC_KEY
    );
  }

  async onModuleInit() {
    try {
      await this.rebuildConfig();
    } catch (err) {
      // Non-fatal: rathole config dir may not exist in dev/local environments
      this.logger.warn(
        `Could not write rathole config: ${(err as Error).message}`,
      );
    }
  }

  /**
   * Rebuild the full rathole server config from all registered proxies.
   */
  async rebuildConfig(): Promise<void> {
    const proxies = await this.prisma.proxy.findMany({
      where: {
        ratholeToken: { not: null },
        assignedPort: { not: null },
      },
      select: {
        id: true,
        ratholeToken: true,
        assignedPort: true,
      },
    });

    const services = proxies.map((p) => {
      const serviceName = `proxy-${p.id}`;
      return [
        `[server.services.${serviceName}]`,
        `token = "${p.ratholeToken}"`,
        `bind_addr = "0.0.0.0:${p.assignedPort}"`,
      ].join('\n');
    });

    // Rathole requires at least one service — add a placeholder if none exist
    if (services.length === 0) {
      services.push(
        '[server.services.placeholder]\ntoken = "placeholder-token-do-not-use"\nbind_addr = "0.0.0.0:19999"',
      );
    }

    const header = [
      '[server]',
      `bind_addr = "0.0.0.0:${this.bindPort}"`,
      'heartbeat_interval = 15',
    ];

    if (this.noisePrivateKey) {
      header.push(
        '',
        '[server.transport]',
        'type = "noise"',
        '',
        '[server.transport.tcp]',
        'nodelay = true',
        'keepalive_secs = 15',
        'keepalive_interval = 5',
        '',
        '[server.transport.noise]',
        `local_private_key = "${this.noisePrivateKey}"`,
      );
    }

    const toml = [...header, '', ...services, ''].join('\n');

    this.writeConfig(toml);
    this.logger.log(
      `Rathole config written with ${proxies.length} service(s) → ${this.configPath}`,
    );
  }

  private writeConfig(content: string): void {
    const dir = dirname(this.configPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(this.configPath, content, { mode: 0o644 });
  }
}

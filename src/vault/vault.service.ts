import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/prisma/prisma.service';
import { QueueService } from 'src/queue/queue.service';
import { CurrentUserInfo } from 'src/common/decorators/user.decorator';

type VaultLoginResponse = {
  auth?: { client_token?: string };
  errors?: string[];
};

type VaultKvWriteResponse = {
  data?: unknown;
  errors?: string[];
};

type VaultKvReadResponse<T> = {
  data?: {
    data?: T; // KV v2 payload lives here
    metadata?: unknown;
  };
  errors?: string[];
};

type VaultTransitEncryptResponse = {
  data?: { ciphertext?: string };
  errors?: string[];
};

type VaultTransitDecryptResponse = {
  data?: { plaintext?: string }; // base64 plaintext
  errors?: string[];
};

type VaultError = { errors?: string[] };

type DatabaseInfo = {
  name: string;
  type: string;
  host?: string;
  port?: string;
  url?: string;
  username?: string;
  password?: string;
  ssl?: boolean;
};

@Injectable()
export class VaultService {
  private readonly logger = new Logger(VaultService.name);

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
    private queue: QueueService,
  ) {}

  private async vaultRequest<T>(path: string, init: RequestInit): Promise<T> {
    const res: Response = await fetch(
      `${this.config.get<string>('keystoreUrl')}${path}`,
      {
        ...init,
        headers: {
          Accept: 'application/json',
          ...(init.headers ?? {}),
        },
      },
    );

    const json = (await res.json()) as T & VaultError;

    if (!res.ok) {
      const msg = json.errors?.join('; ') ?? `HTTP ${res.status}`;
      this.logger.warn(`Vault ${init.method ?? 'GET'} ${path} failed: ${msg}`);
      if (res.status >= 500) {
        throw new InternalServerErrorException(`Unexpected keystore error`);
      }

      if (res.status >= 400) {
        throw new UnauthorizedException('Authorisation token not found');
      }
    }

    return json as T;
  }

  /**
   * Auth with vault - exchange keycloak token for vault token
   */
  async auth(kcToken: string): Promise<string> {
    const json = await this.vaultRequest<VaultLoginResponse>(
      '/v1/auth/jwt/login',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'default', jwt: kcToken }),
      },
    );

    const token = json.auth?.client_token;
    if (!token) {
      throw new UnauthorizedException('Authorisation token not found');
    }
    return token;
  }

  /**
   * Write into project-scoped store for Coordinator (EC2): connector/data/projects/<projectId>/db
   */
  async writeProjectCiphertext(
    vaultToken: string,
    projectId: string,
    ciphertext: string,
  ): Promise<VaultKvWriteResponse> {
    return this.vaultRequest<VaultKvWriteResponse>(
      `/v1/connector/data/projects/${encodeURIComponent(projectId)}/db`,
      {
        method: 'POST',
        headers: {
          'X-Vault-Token': vaultToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ data: { ciphertext } }),
      },
    );
  }

  /**
   * Encrypts JSON payload using Transit
   * Returns Vault ciphertext (e.g. vault:v1:...)
   * Storing ciphertext in KV so NO plaintext values
   */
  async transitEncrypt(
    vaultToken: string,
    keyName: string,
    payload: Record<string, unknown>,
  ): Promise<string> {
    const plaintext = Buffer.from(JSON.stringify(payload), 'utf8').toString(
      'base64',
    );

    const json = await this.vaultRequest<VaultTransitEncryptResponse>(
      `/v1/transit/encrypt/${encodeURIComponent(keyName)}`,
      {
        method: 'POST',
        headers: {
          'X-Vault-Token': vaultToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ plaintext }),
      },
    );

    const ciphertext = json.data?.ciphertext;
    if (!ciphertext)
      throw new NotFoundException('Transit encrypt returned no ciphertext');
    return ciphertext;
  }

  /**
   * Decrypts Vault ciphertext - parsed object
   * Requires transit/decrypt permission
   */
  async transitDecrypt<T>(
    vaultToken: string,
    keyName: string,
    ciphertext: string,
  ): Promise<T> {
    const json = await this.vaultRequest<VaultTransitDecryptResponse>(
      `/v1/transit/decrypt/${encodeURIComponent(keyName)}`,
      {
        method: 'POST',
        headers: {
          'X-Vault-Token': vaultToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ciphertext }),
      },
    );

    const b64 = json.data?.plaintext;
    if (!b64)
      throw new NotFoundException('Transit decrypt returned no plaintext');

    const raw = Buffer.from(b64, 'base64').toString('utf8');
    return JSON.parse(raw) as T;
  }

  /**
   *  Read ciphertext from project path.
   */
  async readProjectCiphertext(
    vaultToken: string,
    projectId: string,
  ): Promise<string> {
    const json = await this.vaultRequest<
      VaultKvReadResponse<{ ciphertext?: string }>
    >(`/v1/connector/data/projects/${encodeURIComponent(projectId)}/db`, {
      method: 'GET',
      headers: { 'X-Vault-Token': vaultToken },
    });

    const ciphertext = json.data?.data?.ciphertext;
    if (!ciphertext)
      throw new NotFoundException('No ciphertext found for project');
    return ciphertext;
  }

  async runConnectionFlow(
    user: CurrentUserInfo,
    projectId: string,
    requestId: string,
    dbDetails: DatabaseInfo,
    accessToken: string,
  ) {
    await this.prisma.project.update({
      where: { projectId },
      data: { status: 'CRAWLING' },
    });

    const token = await this.auth(accessToken);

    const ciphertext = await this.transitEncrypt(token, 'connector-db', {
      ...dbDetails,
    });

    await this.writeProjectCiphertext(token, projectId, ciphertext);

    await this.queue.dataBrokerJob(
      user.username,
      projectId,
      requestId,
      dbDetails,
    );

    return;
  }
}

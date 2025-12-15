import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import fetch, { type RequestInit, type Response } from 'node-fetch';

type VaultLoginResponse = {
  auth?: { client_token?: string };
  errors?: string[];
};

type VaultLookupSelfResponse = {
  data?: { entity_id?: string };
  errors?: string[];
};

type VaultKvWriteResponse = {
  data?: unknown;
  errors?: string[];
};

type VaultError = { errors?: string[] };

@Injectable()
export class VaultService {
  private readonly logger = new Logger(VaultService.name);

  constructor(private config: ConfigService) {}

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
      throw new UnauthorizedException(`Vault request failed: ${msg}`);
    }

    return json as T;
  }

  async auth(kcToken: string): Promise<string> {
    const json = await this.vaultRequest<VaultLoginResponse>(
      '/v1/auth/jwt/login',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ role: 'default', jwt: kcToken }),
      },
    );

    const token = json.auth?.client_token;
    if (!token)
      throw new UnauthorizedException(
        'Vault login succeeded but no client_token returned',
      );
    return token;
  }

  async getEntityId(vaultToken: string): Promise<string> {
    const json = await this.vaultRequest<VaultLookupSelfResponse>(
      '/v1/auth/token/lookup-self',
      {
        method: 'GET',
        headers: {
          'X-Vault-Token': vaultToken,
          Accept: 'application/json',
        },
      },
    );

    const entityId = json.data?.entity_id;
    if (!entityId)
      throw new UnauthorizedException('Vault token has no entity_id');
    return entityId;
  }

  async writeSecret(
    vaultToken: string,
    entityId: string,
    projectId: string,
    payload: Record<string, unknown>,
  ): Promise<VaultKvWriteResponse> {
    return this.vaultRequest<VaultKvWriteResponse>(
      `/v1/connector/data/users/${encodeURIComponent(entityId)}/${encodeURIComponent(projectId)}`,
      {
        method: 'POST',
        headers: {
          'X-Vault-Token': vaultToken,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ data: payload }), // KV v2 expects { data: {...} }
      },
    );
  }
}

/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Test, TestingModule } from '@nestjs/testing';
import {
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { VaultService } from './vault.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { QueueService } from 'src/queue/queue.service';

type MockFetchResponse = {
  ok: boolean;
  status: number;
  json: jest.Mock<Promise<unknown>, []>;
};

type PrismaMock = {
  project: {
    update: jest.Mock;
  };
};

type QueueMock = {
  dataBrokerJob: jest.Mock;
};

const fetchMock = jest.fn();
globalThis.fetch = fetchMock;

const makeResponse = (
  opts: Partial<MockFetchResponse> & { jsonBody?: unknown },
): MockFetchResponse => {
  return {
    ok: opts.ok ?? true,
    status: opts.status ?? 200,
    json: jest.fn().mockResolvedValue(opts.jsonBody ?? {}),
  };
};

describe('VaultService', () => {
  let service: VaultService;
  let config: { get: jest.Mock };

  const prismaMock: PrismaMock = {
    project: {
      update: jest.fn(),
    },
  };

  const queueMock: QueueMock = {
    dataBrokerJob: jest.fn(),
  };

  const keystoreUrl = 'http://vault:8200';

  beforeEach(async () => {
    fetchMock.mockReset();
    prismaMock.project.update.mockReset();
    queueMock.dataBrokerJob.mockReset();

    config = {
      get: jest.fn((key: string) => {
        if (key === 'keystoreUrl') return keystoreUrl;
        return undefined;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VaultService,
        { provide: ConfigService, useValue: config },
        {
          provide: PrismaService,
          useValue: prismaMock as unknown as PrismaService,
        },
        {
          provide: QueueService,
          useValue: queueMock as unknown as QueueService,
        },
      ],
    }).compile();

    service = module.get(VaultService);
  });

  describe('auth', () => {
    it('exchanges keycloak token for vault token', async () => {
      fetchMock.mockResolvedValueOnce(
        makeResponse({
          ok: true,
          status: 200,
          jsonBody: { auth: { client_token: 'vault-token-123' } },
        }),
      );

      const result = await service.auth('kc-token');

      expect(result).toBe('vault-token-123');

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0];

      expect(url).toBe(`${keystoreUrl}/v1/auth/jwt/login`);
      expect(init.method).toBe('POST');
      expect(init.headers).toEqual({
        'Content-Type': 'application/json',
        Accept: 'application/json',
      });
      expect(init.body).toBe(
        JSON.stringify({ role: 'default', jwt: 'kc-token' }),
      );
    });

    it('throws UnauthorizedException when client_token missing', async () => {
      fetchMock.mockResolvedValueOnce(
        makeResponse({
          ok: true,
          status: 200,
          jsonBody: { auth: {} },
        }),
      );

      await expect(service.auth('kc-token')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException when vault returns 4xx', async () => {
      fetchMock.mockResolvedValueOnce(
        makeResponse({
          ok: false,
          status: 403,
          jsonBody: { errors: ['permission denied'] },
        }),
      );

      await expect(service.auth('kc-token')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('throws InternalServerErrorException when vault returns 5xx', async () => {
      fetchMock.mockResolvedValueOnce(
        makeResponse({
          ok: false,
          status: 500,
          jsonBody: { errors: ['something broke'] },
        }),
      );

      await expect(service.auth('kc-token')).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );
    });
  });

  describe('writeProjectSecretCiphertext', () => {
    it('writes ciphertext to connector/data/projects/<projectId>/db', async () => {
      fetchMock.mockResolvedValueOnce(
        makeResponse({
          ok: true,
          status: 200,
          jsonBody: { data: { written: true } },
        }),
      );

      const projectId = 'cc0716f5-86a0-44c7-8c70-af6be4de2780';

      const result = await service.writeProjectCiphertext(
        'vault-token',
        projectId,
        'vault:v1:abc',
      );

      expect(result).toEqual({ data: { written: true } });

      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe(
        `${keystoreUrl}/v1/connector/data/projects/${encodeURIComponent(projectId)}/db`,
      );
      expect(init.method).toBe('POST');
      expect(init.headers).toEqual({
        'X-Vault-Token': 'vault-token',
        'Content-Type': 'application/json',
        Accept: 'application/json',
      });
      expect(init.body).toBe(
        JSON.stringify({ data: { ciphertext: 'vault:v1:abc' } }),
      );
    });

    it('throws UnauthorizedException on 4xx', async () => {
      fetchMock.mockResolvedValueOnce(
        makeResponse({
          ok: false,
          status: 401,
          jsonBody: { errors: ['bad token'] },
        }),
      );

      await expect(
        service.writeProjectCiphertext('vault-token', 'proj', 'vault:v1:abc'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('throws InternalServerErrorException on 5xx', async () => {
      fetchMock.mockResolvedValueOnce(
        makeResponse({
          ok: false,
          status: 503,
          jsonBody: { errors: ['unavailable'] },
        }),
      );

      await expect(
        service.writeProjectCiphertext('vault-token', 'proj', 'vault:v1:abc'),
      ).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  describe('transitEncrypt', () => {
    it('encrypts payload via transit and returns ciphertext', async () => {
      fetchMock.mockResolvedValueOnce(
        makeResponse({
          ok: true,
          status: 200,
          jsonBody: { data: { ciphertext: 'vault:v1:encrypted' } },
        }),
      );

      const ciphertext = await service.transitEncrypt(
        'vault-token',
        'connector-db',
        { user: 'u', pass: 'p' },
      );

      expect(ciphertext).toBe('vault:v1:encrypted');

      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe(`${keystoreUrl}/v1/transit/encrypt/connector-db`);
      expect(init.method).toBe('POST');
      expect(init.headers).toEqual({
        'X-Vault-Token': 'vault-token',
        'Content-Type': 'application/json',
        Accept: 'application/json',
      });

      const body = JSON.parse(init.body as string) as { plaintext: string };
      const decoded = Buffer.from(body.plaintext, 'base64').toString('utf8');
      expect(decoded).toBe(JSON.stringify({ user: 'u', pass: 'p' }));
    });

    it('throws NotFoundException when ciphertext missing', async () => {
      fetchMock.mockResolvedValueOnce(
        makeResponse({
          ok: true,
          status: 200,
          jsonBody: { data: {} },
        }),
      );

      await expect(
        service.transitEncrypt('vault-token', 'connector-db', { a: 1 }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('transitDecrypt', () => {
    it('decrypts ciphertext via transit and returns parsed object', async () => {
      const payload = { host: 'db', port: 5432 };
      const plaintextB64 = Buffer.from(
        JSON.stringify(payload),
        'utf8',
      ).toString('base64');

      fetchMock.mockResolvedValueOnce(
        makeResponse({
          ok: true,
          status: 200,
          jsonBody: { data: { plaintext: plaintextB64 } },
        }),
      );

      const result = await service.transitDecrypt<typeof payload>(
        'vault-token',
        'connector-db',
        'vault:v1:encrypted',
      );

      expect(result).toEqual(payload);

      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe(`${keystoreUrl}/v1/transit/decrypt/connector-db`);
      expect(init.method).toBe('POST');
      expect(init.headers).toEqual({
        'X-Vault-Token': 'vault-token',
        'Content-Type': 'application/json',
        Accept: 'application/json',
      });

      expect(JSON.parse(init.body as string)).toEqual({
        ciphertext: 'vault:v1:encrypted',
      });
    });

    it('throws NotFoundException when plaintext missing', async () => {
      fetchMock.mockResolvedValueOnce(
        makeResponse({
          ok: true,
          status: 200,
          jsonBody: { data: {} },
        }),
      );

      await expect(
        service.transitDecrypt('vault-token', 'connector-db', 'vault:v1:x'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws UnauthorizedException on 4xx', async () => {
      fetchMock.mockResolvedValueOnce(
        makeResponse({
          ok: false,
          status: 403,
          jsonBody: { errors: ['permission denied'] },
        }),
      );

      await expect(
        service.transitDecrypt('vault-token', 'connector-db', 'vault:v1:x'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('readProjectCiphertext', () => {
    it('reads ciphertext from project path', async () => {
      fetchMock.mockResolvedValueOnce(
        makeResponse({
          ok: true,
          status: 200,
          jsonBody: { data: { data: { ciphertext: 'vault:v1:abc' } } },
        }),
      );

      const projectId = 'proj-123';
      const ciphertext = await service.readProjectCiphertext(
        'vault-token',
        projectId,
      );

      expect(ciphertext).toBe('vault:v1:abc');

      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe(
        `${keystoreUrl}/v1/connector/data/projects/${encodeURIComponent(projectId)}/db`,
      );
      expect(init.method).toBe('GET');
      expect(init.headers).toEqual({
        'X-Vault-Token': 'vault-token',
        Accept: 'application/json',
      });
    });

    it('throws NotFoundException when ciphertext missing', async () => {
      fetchMock.mockResolvedValueOnce(
        makeResponse({
          ok: true,
          status: 200,
          jsonBody: { data: { data: {} } },
        }),
      );

      await expect(
        service.readProjectCiphertext('vault-token', 'proj-123'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws InternalServerErrorException on 5xx', async () => {
      fetchMock.mockResolvedValueOnce(
        makeResponse({
          ok: false,
          status: 502,
          jsonBody: { errors: ['bad gateway'] },
        }),
      );

      await expect(
        service.readProjectCiphertext('vault-token', 'proj-123'),
      ).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  describe('runConnectionFlow', () => {
    it('updates project status, stores credentials, and enqueues job', async () => {
      prismaMock.project.update.mockResolvedValue({});

      fetchMock.mockResolvedValueOnce(
        makeResponse({
          ok: true,
          status: 200,
          jsonBody: { auth: { client_token: 'vault-token-123' } },
        }),
      );

      fetchMock.mockResolvedValueOnce(
        makeResponse({
          ok: true,
          status: 200,
          jsonBody: { data: { ciphertext: 'vault:v1:encrypted' } },
        }),
      );

      fetchMock.mockResolvedValueOnce(
        makeResponse({
          ok: true,
          status: 200,
          jsonBody: { data: { written: true } },
        }),
      );

      const user = {
        id: 'u1',
        username: 'normal-user',
        family_name: 'User',
        given_name: 'Normal',
        email: 'user@test.com',
      };

      const projectId = 'proj-1';
      const requestId = 'req-1';
      const accessToken = 'kc-token';
      const dbDetails = {
        url: 'postgres://...',
        type: 'postgres',
        name: 'db',
      };

      await service.runConnectionFlow(
        user,
        projectId,
        requestId,
        dbDetails,
        accessToken,
      );

      expect(prismaMock.project.update).toHaveBeenCalledWith({
        where: { projectId },
        data: { status: 'CRAWLING' },
      });

      expect(queueMock.dataBrokerJob).toHaveBeenCalledWith(
        user.username,
        projectId,
        requestId,
        dbDetails,
      );

      expect(fetchMock).toHaveBeenCalledTimes(3);
      expect(fetchMock.mock.calls[0][0]).toBe(
        `${keystoreUrl}/v1/auth/jwt/login`,
      );
      expect(fetchMock.mock.calls[1][0]).toBe(
        `${keystoreUrl}/v1/transit/encrypt/connector-db`,
      );
      expect(fetchMock.mock.calls[2][0]).toBe(
        `${keystoreUrl}/v1/connector/data/projects/${encodeURIComponent(projectId)}/db`,
      );
    });
  });
});

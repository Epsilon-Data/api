import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import axios from 'axios';
import { AtlasService } from './atlas.service';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('AtlasService', () => {
  let service: AtlasService;
  let configService: jest.Mocked<ConfigService>;

  const ATLAS_URI = 'http://atlas.local:21000';
  const ATLAS_PASSWORD = 'supersecret';

  beforeAll(() => {
    jest.spyOn(Logger.prototype as any, 'error').mockImplementation(() => {});
  });

  beforeEach(async () => {
    configService = {
      get: jest.fn((key: string) => {
        if (key === 'atlas.uri') return ATLAS_URI;
        if (key === 'atlas.adminPassword') return ATLAS_PASSWORD;
        return undefined;
      }),
    } as unknown as jest.Mocked<ConfigService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AtlasService,
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get<AtlasService>(AtlasService);
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should be defined and configure baseUrl', () => {
      expect(service).toBeDefined();
      const header = service.createBasicAuthHeader();
      const expected = Buffer.from(`admin:${ATLAS_PASSWORD}`).toString(
        'base64',
      );
      expect(header).toBe(`Basic ${expected}`);
    });
  });

  describe('Auth header helpers', () => {
    it('createBasicAuthHeader encodes admin:password', () => {
      const token = Buffer.from(`admin:${ATLAS_PASSWORD}`).toString('base64');
      expect(service.createBasicAuthHeader()).toBe(`Basic ${token}`);
    });

    it('createBearerAuthHeader encodes token in base64', () => {
      const token = 'my.jwt.token';
      const encoded = Buffer.from(token).toString('base64');
      expect(service.createBearerAuthHeader(token)).toBe(`Bearer ${encoded}`);
    });
  });

  describe('HTTP methods', () => {
    const endpoint = '/entity/guid/123';
    const params = { verbose: true };
    const body = { foo: 'bar' };
    const token = 'jwt-token';

    it('GET uses Basic auth by default', async () => {
      mockedAxios.get.mockResolvedValueOnce({ data: { ok: true } });
      const result = await service.get(endpoint, params);
      expect(result).toEqual({ ok: true });
      expect(mockedAxios.get).toHaveBeenCalledWith(
        `${ATLAS_URI}/api/atlas/v2${endpoint}`,
        {
          params,
          headers: { Authorization: service.createBasicAuthHeader() },
        },
      );
    });

    it('GET uses Bearer when basicAuth is false', async () => {
      (service as any).basicAuth = false;
      mockedAxios.get.mockResolvedValueOnce({ data: { ok: true } });
      await service.get(endpoint, params, token);
      expect(mockedAxios.get).toHaveBeenCalledWith(
        `${ATLAS_URI}/api/atlas/v2${endpoint}`,
        {
          params,
          headers: { Authorization: service.createBearerAuthHeader(token) },
        },
      );
    });

    it('POST returns response data', async () => {
      mockedAxios.post.mockResolvedValueOnce({ data: { id: 1 } });
      const result = await service.post(endpoint, body);
      expect(result).toEqual({ id: 1 });
      expect(mockedAxios.post).toHaveBeenCalledWith(
        `${ATLAS_URI}/api/atlas/v2${endpoint}`,
        body,
        {
          params: undefined,
          headers: { Authorization: service.createBasicAuthHeader() },
        },
      );
    });

    it('PUT returns response data', async () => {
      mockedAxios.put.mockResolvedValueOnce({ data: { updated: true } });
      const result = await service.put(endpoint, body, params);
      expect(result).toEqual({ updated: true });
      expect(mockedAxios.put).toHaveBeenCalledWith(
        `${ATLAS_URI}/api/atlas/v2${endpoint}`,
        body,
        {
          params,
          headers: {
            Authorization: service.createBasicAuthHeader(),
            'Content-Type': 'application/json',
          },
        },
      );
    });

    it('DELETE returns response data', async () => {
      mockedAxios.delete.mockResolvedValueOnce({ data: { deleted: true } });
      const result = await service.delete(endpoint);
      expect(result).toEqual({ deleted: true });
      expect(mockedAxios.delete).toHaveBeenCalledWith(
        `${ATLAS_URI}/api/atlas/v2${endpoint}`,
        {
          params: undefined,
          headers: { Authorization: service.createBasicAuthHeader() },
        },
      );
    });
  });

  describe('Error handling', () => {
    const endpoint = '/fail';

    it('logs and rethrows GET errors', async () => {
      const err = new Error('boom');
      mockedAxios.get.mockRejectedValueOnce(err);
      const logSpy = jest.spyOn(Logger.prototype as any, 'error');
      await expect(service.get(endpoint)).rejects.toThrow('boom');
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          `GET request to ${ATLAS_URI}/api/atlas/v2${endpoint} failed: Error: boom`,
        ),
      );
    });

    it('logs and rethrows POST errors', async () => {
      const err = new Error('bad post');
      mockedAxios.post.mockRejectedValueOnce(err);
      const logSpy = jest.spyOn(Logger.prototype as any, 'error');
      await expect(service.post(endpoint, {})).rejects.toThrow('bad post');
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          `POST request to ${ATLAS_URI}/api/atlas/v2${endpoint} failed: Error: bad post`,
        ),
      );
    });

    it('logs and rethrows PUT errors', async () => {
      const err = new Error('bad put');
      mockedAxios.put.mockRejectedValueOnce(err);
      const logSpy = jest.spyOn(Logger.prototype as any, 'error');
      await expect(service.put(endpoint, {})).rejects.toThrow('bad put');
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          `PUT request to ${ATLAS_URI}/api/atlas/v2${endpoint} failed: Error: bad put`,
        ),
      );
    });

    it('logs and rethrows DELETE errors', async () => {
      const err = new Error('bad delete');
      mockedAxios.delete.mockRejectedValueOnce(err);
      const logSpy = jest.spyOn(Logger.prototype as any, 'error');
      await expect(service.delete(endpoint)).rejects.toThrow('bad delete');
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          `DELETE request to ${ATLAS_URI}/api/atlas/v2${endpoint} failed: Error: bad delete`,
        ),
      );
    });
  });
});

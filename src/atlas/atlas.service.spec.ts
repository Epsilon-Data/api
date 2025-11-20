/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
// src/atlas/atlas.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosResponse } from 'axios';

import { AtlasService } from './atlas.service';

jest.mock('axios');

const createAxiosResponse = <T>(data: T): AxiosResponse<T> => ({
  data,
  status: 200,
  statusText: 'OK',
  headers: {},
  config: {} as any,
});

describe('AtlasService', () => {
  let service: AtlasService;
  let configService: ConfigService;
  let axiosMock: jest.Mocked<typeof axios>;

  const atlasUri = 'http://atlas:21000';
  const adminUsername = 'admin';
  const adminPassword = 'supersecret';

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AtlasService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              switch (key) {
                case 'atlas.uri':
                  return atlasUri;
                case 'atlas.adminPassword':
                  return adminPassword;
                case 'atlas.adminUsername':
                  return adminUsername;
                default:
                  return undefined;
              }
            }),
          },
        },
      ],
    }).compile();

    service = module.get<AtlasService>(AtlasService);
    configService = module.get<ConfigService>(ConfigService);
    axiosMock = axios as jest.Mocked<typeof axios>;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
    expect(configService).toBeDefined();
  });

  describe('get', () => {
    it('should perform GET with correct URL, params and Basic auth header', async () => {
      const endpoint = '/entity/guid/123';
      const params = { verbose: true };
      const expectedUrl = `${atlasUri}/api/atlas/v2${endpoint}`;

      const data = { id: '123', name: 'entity' };
      const response = createAxiosResponse(data);

      axiosMock.get.mockResolvedValueOnce(response);

      const result = await service.get<typeof data>(endpoint, params);

      // auth header is Basic base64("admin:password")
      const expectedAuthHeader =
        'Basic ' +
        Buffer.from(`${adminUsername}:${adminPassword}`).toString('base64');

      expect(axiosMock.get).toHaveBeenCalledWith(expectedUrl, {
        params,
        headers: { Authorization: expectedAuthHeader },
      });
      expect(result).toEqual(data);
    });

    it('should propagate errors from axios.get', async () => {
      const endpoint = '/entity/guid/404';
      const error = new Error('Request failed');
      axiosMock.get.mockRejectedValueOnce(error);

      await expect(service.get(endpoint)).rejects.toBe(error);
    });
  });

  describe('post', () => {
    it('should perform POST with correct URL, body, params and Basic auth header', async () => {
      const endpoint = '/entity';
      const body = { name: 'new entity' };
      const params = { update: false };
      const expectedUrl = `${atlasUri}/api/atlas/v2${endpoint}`;

      const data = { guid: 'abc', ...body };
      const response = createAxiosResponse(data);

      axiosMock.post.mockResolvedValueOnce(response);

      const result = await service.post<typeof data>(
        endpoint,
        body,
        undefined,
        params,
      );

      const expectedAuthHeader =
        'Basic ' +
        Buffer.from(`${adminUsername}:${adminPassword}`).toString('base64');

      expect(axiosMock.post).toHaveBeenCalledWith(expectedUrl, body, {
        params,
        headers: { Authorization: expectedAuthHeader },
      });
      expect(result).toEqual(data);
    });

    it('should propagate errors from axios.post', async () => {
      const endpoint = '/entity';
      const body = { name: 'broken' };
      const error = new Error('POST failed');

      axiosMock.post.mockRejectedValueOnce(error);

      await expect(service.post(endpoint, body)).rejects.toBe(error);
    });
  });

  describe('put', () => {
    it('should perform PUT with correct URL, body, params, Basic auth and Content-Type', async () => {
      const endpoint = '/entity/guid/123';
      const body = { name: 'updated entity' };
      const params = { partialUpdate: true };
      const expectedUrl = `${atlasUri}/api/atlas/v2${endpoint}`;

      const data = { guid: '123', ...body };
      const response = createAxiosResponse(data);

      axiosMock.put.mockResolvedValueOnce(response);

      const result = await service.put<typeof data>(endpoint, body, params);

      const expectedAuthHeader =
        'Basic ' +
        Buffer.from(`${adminUsername}:${adminPassword}`).toString('base64');

      expect(axiosMock.put).toHaveBeenCalledWith(expectedUrl, body, {
        params,
        headers: {
          Authorization: expectedAuthHeader,
          'Content-Type': 'application/json',
        },
      });
      expect(result).toEqual(data);
    });

    it('should propagate errors from axios.put', async () => {
      const endpoint = '/entity/guid/123';
      const body = { name: 'fail' };
      const error = new Error('PUT failed');

      axiosMock.put.mockRejectedValueOnce(error);

      await expect(service.put(endpoint, body)).rejects.toBe(error);
    });
  });

  describe('delete', () => {
    it('should perform DELETE with correct URL, params and Basic auth header', async () => {
      const endpoint = '/entity/guid/123';
      const params = { purge: true };
      const expectedUrl = `${atlasUri}/api/atlas/v2${endpoint}`;

      const data = { deleted: true };
      const response = createAxiosResponse(data);

      axiosMock.delete.mockResolvedValueOnce(response);

      const result = await service.delete<typeof data>(endpoint, params);

      const expectedAuthHeader =
        'Basic ' +
        Buffer.from(`${adminUsername}:${adminPassword}`).toString('base64');

      expect(axiosMock.delete).toHaveBeenCalledWith(expectedUrl, {
        params,
        headers: { Authorization: expectedAuthHeader },
      });
      expect(result).toEqual(data);
    });

    it('should propagate errors from axios.delete', async () => {
      const endpoint = '/entity/guid/123';
      const error = new Error('DELETE failed');

      axiosMock.delete.mockRejectedValueOnce(error);

      await expect(service.delete(endpoint)).rejects.toBe(error);
    });
  });

  describe('Bearer auth behaviour (when basicAuth is false)', () => {
    it('should use Bearer auth header when token is provided and basicAuth is false', async () => {
      const endpoint = '/entity/guid/123';
      const token = 'my-access-token';
      const expectedUrl = `${atlasUri}/api/atlas/v2${endpoint}`;

      // flip the private flag for this test
      (service as any).basicAuth = false;

      const data = { id: '123' };
      const response = createAxiosResponse(data);

      axiosMock.get.mockResolvedValueOnce(response);

      const result = await service.get<typeof data>(endpoint, undefined, token);

      const expectedBearerHeader =
        'Bearer ' + Buffer.from(token).toString('base64');

      expect(axiosMock.get).toHaveBeenCalledWith(expectedUrl, {
        params: undefined,
        headers: { Authorization: expectedBearerHeader },
      });
      expect(result).toEqual(data);

      // reset for other tests
      (service as any).basicAuth = true;
    });
  });
});

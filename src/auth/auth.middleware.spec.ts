import { AuthMiddleware } from './auth.middleware';
import type { AuthModuleConfig } from './config.interface';
import { ConfigService } from '@nestjs/config';
import { addToken } from '@epsilon-data/epsilon-api-middleware';
import type { Request, Response } from 'express';

jest.mock('@epsilon-data/epsilon-api-middleware', () => ({
  addToken: jest.fn(),
}));

describe('AuthMiddleware', () => {
  const addTokenMock = addToken as jest.Mock;
  const innerHandler = jest.fn();

  const config: AuthModuleConfig = {
    encryptionKey: 'test-key',
    cookiePrefix: 'epsilon',
    trustedWebOrigins: ['http://localhost'],
  } as AuthModuleConfig;

  const configService = {
    get: jest.fn().mockReturnValue('/api/v1'),
  } as unknown as ConfigService;

  const buildRequest = (method: string, originalUrl: string) =>
    ({ method, originalUrl }) as Request;

  const response = {} as Response;
  const next = jest.fn();

  let middleware: AuthMiddleware;

  beforeEach(() => {
    jest.clearAllMocks();
    addTokenMock.mockReturnValue(innerHandler);
    middleware = new AuthMiddleware(config, configService);
  });

  it('passes the auth config through to addToken and invokes the handler', () => {
    const request = buildRequest('POST', '/api/v1/project');

    middleware.use(request, response, next);

    expect(addTokenMock).toHaveBeenCalledWith(
      'test-key',
      'epsilon',
      ['http://localhost'],
      false,
    );
    expect(innerHandler).toHaveBeenCalledWith(request, response, next);
  });

  it.each([
    ['/api/v1/analysis/datasets'],
    ['/api/v1/coordinator/auth'],
    ['/api/v1/admin/users'],
  ])('allows bearer-token auth for GET %s', (originalUrl) => {
    middleware.use(buildRequest('GET', originalUrl), response, next);

    expect(addTokenMock).toHaveBeenCalledWith(
      'test-key',
      'epsilon',
      ['http://localhost'],
      true,
    );
  });

  it('does not allow bearer-token auth for non-GET requests to those prefixes', () => {
    middleware.use(
      buildRequest('POST', '/api/v1/analysis/auth'),
      response,
      next,
    );

    expect(addTokenMock).toHaveBeenCalledWith(
      'test-key',
      'epsilon',
      ['http://localhost'],
      false,
    );
  });

  it('does not allow bearer-token auth for GET requests outside those prefixes', () => {
    middleware.use(buildRequest('GET', '/api/v1/project'), response, next);

    expect(addTokenMock).toHaveBeenCalledWith(
      'test-key',
      'epsilon',
      ['http://localhost'],
      false,
    );
  });
});

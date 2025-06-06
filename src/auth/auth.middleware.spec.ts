import { AuthMiddleware } from './auth.middleware';

const mockAuthConfig = {
  issuerBaseURL: 'http://localhost:3567',
  audience: 'string',
  scopePrefix: 'string',
  cookiePrefix: 'string',
  encryptionKey: 'string',
  trustedWebOrigins: ['string'],
  allowTokenAuth: true,
  clientId: 'string',
};

describe('AuthMiddleware', () => {
  it('should be defined', () => {
    expect(new AuthMiddleware(mockAuthConfig)).toBeDefined();
  });
});

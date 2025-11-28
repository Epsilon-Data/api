import { Test, TestingModule } from '@nestjs/testing';
import { KeycloakAdminService } from './keycloak-admin.service';
import { ConfigService } from '@nestjs/config';
import {
  ADMIN_CONFIG,
  AdminModuleConfig,
  KEYCLOAK_ADMIN_INSTANCE,
} from '../config.interface';

// TODO: write proper tests
// TODO: write better mock
const kcAdminClientMock = {
  auth: jest.fn(),
  users: {
    find: jest.fn(),
    create: jest.fn(),
    del: jest.fn(),
    count: jest.fn(),
  },
  roles: {
    find: jest.fn(),
  },
  clients: {
    find: jest.fn(),
    findOne: jest.fn(),
  },
  clientScopes: {
    find: jest.fn(),
  },
};

describe('KeycloakAdminService', () => {
  let service: KeycloakAdminService;
  let configService: jest.Mocked<ConfigService>;
  let injectedCfg: AdminModuleConfig;
  let injectedKc: typeof kcAdminClientMock;

  const adminConfig: AdminModuleConfig = {
    issuerBaseURL: 'http://localhost:8080',
    realm: 'epsilon',
    audience: 'epsilon.api',
    scopePrefix: 'api.permissions',
    clientId: 'epsilon-admin-api',
    clientSecret: 'secret',
    cookiePrefix: 'epsilon',
    encryptionKey: 'dummy',
    trustedWebOrigins: ['http://localhost:3000'],
  };

  beforeEach(async () => {
    configService = {
      get: jest.fn(),
    } as unknown as jest.Mocked<ConfigService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KeycloakAdminService,
        { provide: ADMIN_CONFIG, useValue: adminConfig },
        { provide: KEYCLOAK_ADMIN_INSTANCE, useValue: kcAdminClientMock },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get(KeycloakAdminService);
    injectedCfg = module.get(ADMIN_CONFIG);
    injectedKc = module.get(KEYCLOAK_ADMIN_INSTANCE);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('injects ADMIN_CONFIG and KEYCLOAK_ADMIN_INSTANCE', () => {
    expect(injectedCfg).toEqual(adminConfig);
    expect(injectedKc).toBe(kcAdminClientMock);
  });

  it('has ConfigService injected (for future use)', () => {
    expect(configService).toBeDefined();
  });
});

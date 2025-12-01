/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { KeycloakAdminService } from './keycloak-admin.service';
import {
  ADMIN_CONFIG,
  KEYCLOAK_ADMIN_INSTANCE,
  AdminModuleConfig,
} from '../admin-config.interface';
import {
  ClientRepresentation,
  Credentials,
  EventRepresentation,
  PolicyRepresentation,
  UserRepresentation,
} from '@epsilon-data/keycloak-admin-client';
import { LoginDto } from 'src/analysis/dto';

describe('KeycloakAdminService', () => {
  let service: KeycloakAdminService;

  const mockAdminConfig: AdminModuleConfig = {
    issuerBaseURL: 'https://keycloak.example.com',
    realm: 'test-realm',
    audience: 'test-audience',
    clientId: 'admin-client-id',
    clientSecret: 'admin-client-secret',
  };

  const mockKcAdminClient = {
    auth: jest.fn(),
    getAccessToken: jest.fn(),
    users: {
      create: jest.fn(),
      listAvailableRealmRoleMappings: jest.fn(),
      addRealmRoleMappings: jest.fn(),
      executeActionsEmail: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      del: jest.fn(),
      addToGroup: jest.fn(),
    },
    realms: {
      findEvents: jest.fn(),
    },
    clients: {
      find: jest.fn(),
      createResource: jest.fn(),
      createPolicy: jest.fn(),
      createOrUpdatePolicy: jest.fn(),
      createPermission: jest.fn(),
      delResource: jest.fn(),
      findPolicyByName: jest.fn(),
    },
    roles: {
      create: jest.fn(),
      findOneByName: jest.fn(),
      findOneById: jest.fn(),
      updateById: jest.fn(),
      delById: jest.fn(),
    },
    groups: {
      create: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
    },
    clientScopes: {
      create: jest.fn(),
    },
  };

  const mockConfigService = {
    get: jest.fn(),
  } as unknown as ConfigService;

  beforeEach(async () => {
    jest.clearAllMocks();

    (mockConfigService.get as jest.Mock).mockImplementation((key: string) => {
      switch (key) {
        case 'auth.clientId':
          return 'client-from-config';
        case 'sdk.clientId':
          return 'sdk-client-id';
        default:
          return undefined;
      }
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KeycloakAdminService,
        {
          provide: KEYCLOAK_ADMIN_INSTANCE,
          useValue: mockKcAdminClient,
        },
        {
          provide: ADMIN_CONFIG,
          useValue: mockAdminConfig,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<KeycloakAdminService>(KeycloakAdminService);
  });

  describe('onModuleInit', () => {
    it('authenticates and sets defaultClient successfully', async () => {
      const credentials: Credentials = {
        grantType: 'client_credentials',
        clientId: mockAdminConfig.clientId,
        clientSecret: mockAdminConfig.clientSecret,
      };

      const client: ClientRepresentation = {
        id: 'client-1',
        clientId: 'config-client-id',
      };

      const getClient = jest
        .spyOn(service, 'getClientById')
        .mockResolvedValueOnce(client);
      mockKcAdminClient.auth.mockResolvedValue(undefined);

      await service.onModuleInit();

      expect(mockKcAdminClient.auth).toHaveBeenCalledWith(credentials);
      expect(getClient).toHaveBeenCalledTimes(1);
    });

    it('throws if auth fails', async () => {
      mockKcAdminClient.auth.mockRejectedValue(new Error('auth failed'));

      await expect(service.onModuleInit()).rejects.toThrow('auth failed');
    });
  });

  describe('createUser', () => {
    it('creates user and maps roles when realmRoles are present', async () => {
      const user: UserRepresentation = {
        username: 'test-user',
        realmRoles: ['admin', 'editor'],
      };

      mockKcAdminClient.users.create.mockResolvedValue({
        id: 'user-1',
      });

      mockKcAdminClient.users.listAvailableRealmRoleMappings.mockResolvedValue([
        { id: 'role-1', name: 'admin' },
        { id: 'role-2', name: 'editor' },
        { id: 'role-3', name: 'viewer' },
      ]);

      mockKcAdminClient.users.addRealmRoleMappings.mockResolvedValue(undefined);

      const result = await service.createUser(user);

      expect(mockKcAdminClient.users.create).toHaveBeenCalledWith(user);
      expect(
        mockKcAdminClient.users.listAvailableRealmRoleMappings,
      ).toHaveBeenCalledWith({
        id: 'user-1',
        realm: mockAdminConfig.realm,
      });
      expect(mockKcAdminClient.users.addRealmRoleMappings).toHaveBeenCalledWith(
        {
          id: 'user-1',
          realm: mockAdminConfig.realm,
          roles: [
            { id: 'role-1', name: 'admin' },
            { id: 'role-2', name: 'editor' },
          ],
        },
      );
      expect(result).toEqual({ id: 'user-1' });
    });

    it('creates user and does not map roles when realmRoles are missing', async () => {
      const user: UserRepresentation = {
        username: 'test-user',
      };

      mockKcAdminClient.users.create.mockResolvedValue({
        id: 'user-2',
      });

      const result = await service.createUser(user);

      expect(mockKcAdminClient.users.create).toHaveBeenCalledWith(user);
      expect(
        mockKcAdminClient.users.listAvailableRealmRoleMappings,
      ).not.toHaveBeenCalled();
      expect(result).toEqual({ id: 'user-2' });
    });
  });

  describe('getAllUsersAndLastLogin', () => {
    it('returns users with lastLogin derived from events', async () => {
      const users = [
        { id: 'u1', username: 'user1' },
        { id: 'u2', username: 'user2' },
      ];

      const now = Date.now();
      const events: EventRepresentation[] = [
        { clientId: 'e1', userId: 'u1', time: now - 1000 },
        { clientId: 'e2', userId: 'u1', time: now },
        { clientId: 'e3', userId: 'u2', time: now - 5000 },
      ];

      mockKcAdminClient.users.find.mockResolvedValue(users);
      mockKcAdminClient.realms.findEvents.mockResolvedValue(events);

      const result = await service.getAllUsersAndLastLogin();

      expect(mockKcAdminClient.users.find).toHaveBeenCalledWith(
        {
          realm: mockAdminConfig.realm,
        },
        { catchNotFound: false },
      );
      expect(mockKcAdminClient.realms.findEvents).toHaveBeenCalledWith({
        realm: mockAdminConfig.realm,
        type: 'LOGIN',
      });

      expect(result).toHaveLength(2);
      const user1 = result.find((u) => u.id === 'u1')!;
      const user2 = result.find((u) => u.id === 'u2')!;

      expect(user1.lastLogin).toBeInstanceOf(Date);
      expect(user1.lastLogin!.getTime()).toBe(now);
      expect(user2.lastLogin).toBeInstanceOf(Date);
      expect(user2.lastLogin!.getTime()).toBe(now - 5000);
    });
  });

  describe('getClientById', () => {
    it('uses provided clientId when given', async () => {
      const providedId = 'explicit-client-id';

      const clients = [{ id: 'c1', clientId: providedId }];
      mockKcAdminClient.clients.find.mockResolvedValue(clients);

      const result = await service.getClientById(providedId);

      expect(mockKcAdminClient.clients.find).toHaveBeenCalledWith(
        {
          clientId: providedId, // ← updated expectation
          realm: mockAdminConfig.realm,
        },
        { catchNotFound: false },
      );

      expect(result).toBe(clients[0]);
    });

    it('falls back to configService.get("auth.clientId") when no clientId is passed', async () => {
      (mockConfigService.get as jest.Mock).mockReturnValue('config-client-id');

      const clients = [{ id: 'c1', clientId: 'config-client-id' }];
      mockKcAdminClient.clients.find.mockResolvedValue(clients);

      const result = await service.getClientById(); // no explicit clientId

      expect(mockKcAdminClient.clients.find).toHaveBeenCalledWith(
        {
          clientId: 'config-client-id', // ← new fallback logic
          realm: mockAdminConfig.realm,
        },
        { catchNotFound: false },
      );

      expect(result).toBe(clients[0]);
    });

    it('throws if no clients are returned', async () => {
      mockKcAdminClient.clients.find.mockResolvedValue([]);

      await expect(service.getClientById()).rejects.toThrow(
        "Keycloak client 'client-from-config' does not exist",
      );
    });
  });

  describe('addUserToUserPolicy', () => {
    it('updates existing policy, merging users', async () => {
      // set defaultClient directly
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (service as any).defaultClient = {
        id: 'client-1',
      } as ClientRepresentation;

      const projectId = 'proj-1';
      const userId = 'user-1';
      const user: UserRepresentation = {
        id: userId,
        username: 'new-user',
      };

      jest.spyOn(service, 'getUserById').mockResolvedValueOnce(user);

      mockKcAdminClient.clients.findPolicyByName.mockResolvedValue({
        id: 'policy-1',
        name: `analysisPolicy_${projectId}`,
        users: ['existing-user'],
      } as PolicyRepresentation);

      mockKcAdminClient.clients.createOrUpdatePolicy.mockResolvedValue(
        undefined,
      );

      await service.addUserToUserPolicy(projectId, userId);

      expect(mockKcAdminClient.clients.findPolicyByName).toHaveBeenCalledWith({
        id: 'client-1',
        realm: mockAdminConfig.realm,
        name: expect.stringContaining(projectId),
      });

      expect(
        mockKcAdminClient.clients.createOrUpdatePolicy,
      ).toHaveBeenCalledWith({
        id: 'client-1',
        policyName: expect.stringContaining(projectId),
        policy: expect.objectContaining({
          users: expect.arrayContaining(['existing-user', 'new-user']),
        }),
      });

      // when existingPolicy exists, createPermission should not be called
      expect(mockKcAdminClient.clients.createPermission).not.toHaveBeenCalled();
    });

    it('creates permission when policy does not exist', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (service as any).defaultClient = {
        id: 'client-1',
      } as ClientRepresentation;

      const projectId = 'proj-2';
      const userId = 'user-2';
      const user: UserRepresentation = {
        id: userId,
        username: 'another-user',
      };

      jest.spyOn(service, 'getUserById').mockResolvedValueOnce(user);

      mockKcAdminClient.clients.findPolicyByName.mockResolvedValue(null);

      mockKcAdminClient.clients.createOrUpdatePolicy.mockResolvedValue(
        undefined,
      );

      mockKcAdminClient.clients.createPermission.mockResolvedValue(undefined);

      await service.addUserToUserPolicy(projectId, userId);

      expect(mockKcAdminClient.clients.createOrUpdatePolicy).toHaveBeenCalled();

      expect(mockKcAdminClient.clients.createPermission).toHaveBeenCalledWith(
        {
          id: 'client-1',
          type: 'scope',
        },
        expect.objectContaining({
          name: expect.stringContaining(projectId),
          resources: [expect.stringContaining(projectId)],
        }),
      );
    });
  });

  describe('getAccessToken', () => {
    it('authenticates with password grant and returns access token', async () => {
      const login: LoginDto = {
        username: 'user@example.com',
        password: 'secret',
      };

      mockKcAdminClient.auth.mockResolvedValue(undefined);
      mockKcAdminClient.getAccessToken.mockResolvedValue('token-123');

      const result = await service.getAccessToken(login);

      expect(mockKcAdminClient.auth).toHaveBeenCalledWith({
        grantType: 'password',
        clientId: 'sdk-client-id',
        username: login.username,
        password: login.password,
      });

      expect(result).toEqual({
        access_token: 'token-123',
      });
    });
  });
});

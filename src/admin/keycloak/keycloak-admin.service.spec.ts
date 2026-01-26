/* eslint-disable @typescript-eslint/no-explicit-any */
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
import { Logger } from '@nestjs/common';

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
      listResources: jest.fn(),
      listPolicies: jest.fn(),
      delPolicy: jest.fn(),
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
      del: jest.fn(),
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

    // catch thrown errors from the service
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});

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
          clientId: providedId, // updated expectation
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
          clientId: 'config-client-id', // new fallback logic
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

      (service as any).defaultClient = {
        id: 'client-1',
      } as ClientRepresentation;

      const projectId = 'proj-1';
      const userId = 'new-user-id';

      mockKcAdminClient.clients.findPolicyByName.mockResolvedValue({
        id: 'policy-1',
        name: `Analysis of ${projectId}`,
        config: { users: '["existing-user-id"]' },
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
          users: expect.arrayContaining(['existing-user-id', 'new-user-id']),
        }),
      });

      // when existingPolicy exists, createPermission should not be called
      expect(mockKcAdminClient.clients.createPermission).not.toHaveBeenCalled();
    });

    it('creates permission when policy does not exist', async () => {
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
        refreshToken: '',
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

  describe('deleteResource', () => {
    it('returns early when defaultClient.id is missing', async () => {
      (service as any).defaultClient = { id: undefined };

      await service.deleteResource('proj-1');

      expect(mockKcAdminClient.clients.listResources).not.toHaveBeenCalled();
    });

    it('handles resource not found', async () => {
      (service as any).defaultClient = {
        id: 'client-1',
      } as ClientRepresentation;
      // Spy only where you assert catch-path behavior
      const handleSpy = jest
        .spyOn(service as any, 'handleKeycloakError')
        .mockImplementation((_fn: string, err: unknown) => err);

      mockKcAdminClient.clients.listResources.mockResolvedValue([]);

      await service.deleteResource('uuid');

      expect(handleSpy).toHaveBeenCalledWith(
        'deleteResource',
        expect.anything(),
      );
    });

    it('deletes resource then deletes any remaining (orphan) policies', async () => {
      (service as any).defaultClient = { id: 'client-uuid' };
      (service as any).config = { realm: 'test-realm' };

      const projectId = 'cedb48f3-cf26-4b0c-8cb2-cebd60df5083';

      jest
        .spyOn(service as any, 'handleKeycloakError')
        .mockImplementation((_fn: string, err: unknown) => err);

      jest.spyOn(service as any, 'getGroupByName').mockResolvedValue([]);

      mockKcAdminClient.clients.listResources.mockResolvedValue([
        { _id: 'resource-id-1' },
      ]);
      mockKcAdminClient.clients.delResource.mockResolvedValue(undefined);

      // orphan policies (single pass)
      const getPoliciesSpy = jest
        .spyOn(service as any, 'getProjectPolicies')
        .mockResolvedValue([
          {
            id: 'orphan-1',
            name: `Analysis orphan ${projectId}`,
            type: 'user',
          },
          { id: 'orphan-2', name: `More orphan ${projectId}`, type: 'scope' },
        ]);

      mockKcAdminClient.clients.delPolicy.mockResolvedValue(undefined);

      await service.deleteResource(projectId);

      expect(mockKcAdminClient.clients.delResource).toHaveBeenCalled();

      expect(getPoliciesSpy).toHaveBeenCalledTimes(1);
      expect(getPoliciesSpy).toHaveBeenCalledWith(projectId);

      expect(mockKcAdminClient.clients.delPolicy).toHaveBeenCalledTimes(2);
      expect(mockKcAdminClient.clients.delPolicy).toHaveBeenNthCalledWith(1, {
        id: 'client-uuid',
        policyId: 'orphan-1',
        realm: 'test-realm',
      });
      expect(mockKcAdminClient.clients.delPolicy).toHaveBeenNthCalledWith(2, {
        id: 'client-uuid',
        policyId: 'orphan-2',
        realm: 'test-realm',
      });
    });

    it('ignores 404 policy delete failures (isNotFound=true) and continues', async () => {
      (service as any).defaultClient = {
        id: 'client-1',
      } as ClientRepresentation;
      (service as any).config = { realm: 'test-realm' };

      const projectId = 'cedb48f3-cf26-4b0c-8cb2-cebd60df5083';

      mockKcAdminClient.clients.listResources.mockResolvedValue([
        { _id: 'resource-id-1' },
      ]);
      mockKcAdminClient.clients.delResource.mockResolvedValue(undefined);

      jest.spyOn(service as any, 'getProjectPolicies').mockResolvedValueOnce([
        { id: 'scope-1', name: `Analysis ${projectId}`, type: 'scope' },
        { id: 'user-1', name: `Analysis of ${projectId}`, type: 'user' },
      ]);

      jest.spyOn(service as any, 'getGroupByName').mockResolvedValue([]);

      jest
        .spyOn(service as any, 'isNotFound')
        .mockImplementation((e: unknown) => {
          const err = e as any;
          return err?.response?.status === 404;
        });

      const handleSpy = jest
        .spyOn(service as any, 'handleKeycloakError')
        .mockImplementation((_fn: string, err: unknown) => err);

      const notFoundErr = { response: { status: 404 } };
      mockKcAdminClient.clients.delPolicy
        .mockRejectedValueOnce(notFoundErr)
        .mockResolvedValueOnce(undefined);

      await service.deleteResource(projectId);

      expect(mockKcAdminClient.clients.delResource).toHaveBeenCalled();
      expect(handleSpy).not.toHaveBeenCalled();
    });

    it('routes through handleKeycloakError when an orphan policy delete fails with non-404', async () => {
      (service as any).defaultClient = { id: 'client-uuid' };
      (service as any).config = { realm: 'test-realm' };

      const projectId = 'cedb48f3-cf26-4b0c-8cb2-cebd60df5083';

      const handleSpy = jest
        .spyOn(service as any, 'handleKeycloakError')
        .mockImplementation((_fn: string, err: unknown) => err);

      jest.spyOn(service as any, 'getGroupByName').mockResolvedValue([]);

      mockKcAdminClient.clients.listResources.mockResolvedValue([
        { _id: 'resource-id-1' },
      ]);
      mockKcAdminClient.clients.delResource.mockResolvedValue(undefined);

      // orphan policies returned AFTER resource delete
      jest.spyOn(service as any, 'getProjectPolicies').mockResolvedValue([
        { id: 'scope-1', name: `Analysis ${projectId}`, type: 'scope' },
        { id: 'user-1', name: `Analysis of ${projectId}`, type: 'user' },
      ]);

      jest.spyOn(service as any, 'isNotFound').mockReturnValue(false);

      // Make one delete fail with non-404
      const err500 = { response: { status: 500 }, message: 'boom' };
      mockKcAdminClient.clients.delPolicy
        .mockRejectedValueOnce(err500)
        .mockResolvedValueOnce(undefined);

      const res = await service.deleteResource(projectId);

      // Resource delete happens BEFORE orphan cleanup
      expect(mockKcAdminClient.clients.delResource).toHaveBeenCalledWith({
        id: 'client-uuid',
        resourceId: 'resource-id-1',
        realm: 'test-realm',
      });

      // Then it tries to delete orphan policies
      expect(mockKcAdminClient.clients.delPolicy).toHaveBeenCalled();

      // Non-404 failure should be treated as error and routed via handleKeycloakError
      expect(handleSpy).toHaveBeenCalledWith(
        'deleteResource',
        expect.anything(),
      );
      expect(res).toBeTruthy();
    });
  });
});

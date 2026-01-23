/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';

import { KeycloakProcessor } from './keycloak.processor';
import { KeycloakAdminService } from 'src/admin/keycloak/keycloak-admin.service';
import {
  resourcePrefix,
  projectScopes,
  ownerPolicyPrefix,
  ownerPermissionPrefix,
  ownerPermissions,
  groupPrefix,
  analysisPermissionPrefix,
  analysisPermissions,
  analysisPolicyPrefix,
  groupPolicyPrefix,
  groupPermissions,
  groupPermissionPrefix,
  custodianPolicyPrefix,
  custodianPermissionPrefix,
  custodianPermissions,
} from 'src/utils/options.util';
import {
  DecisionStrategy,
  Logic,
  UserRepresentation,
} from '@epsilon-data/keycloak-admin-client';
import type { Job } from 'bull';

describe('KeycloakProcessor.handleAddResource', () => {
  let processor: KeycloakProcessor;

  const keycloakMock = {
    auth: jest.fn(),
    getUserById: jest.fn(),
    getClientById: jest.fn(),
    createResource: jest.fn(),
    createPolicy: jest.fn(),
    createPermission: jest.fn(),
    createGroup: jest.fn(),
    addUserToGroup: jest.fn(),
    checkUser: jest.fn(),
    createUser: jest.fn(),
    setUserActions: jest.fn(),
  };

  const configServiceMock = {
    get: jest.fn(),
  };

  // Bull job mock
  const makeJob = (data: unknown): Job =>
    ({
      id: 'job-1',
      name: 'process-add-resource',
      data,
    }) as Job;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KeycloakProcessor,
        { provide: KeycloakAdminService, useValue: keycloakMock },
        { provide: ConfigService, useValue: configServiceMock },
      ],
    }).compile();

    processor = module.get(KeycloakProcessor);

    // epsilon-token-handler client
    configServiceMock.get.mockImplementation((key: string) => {
      if (key === 'auth.clientId') return 'authorisation-service-client';
      return undefined;
    });

    // default mock stubs
    keycloakMock.auth.mockResolvedValue(undefined);
    keycloakMock.getUserById.mockResolvedValue({
      id: 'owner-1',
      username: 'ownerUser',
    });
    keycloakMock.getClientById.mockResolvedValue({
      id: 'kc-client-1',
      clientId: 'authorisation-service-client',
    });
    keycloakMock.createResource.mockResolvedValue(undefined);
    keycloakMock.createPolicy.mockResolvedValue(undefined);
    keycloakMock.createPermission.mockResolvedValue(undefined);
    keycloakMock.createGroup.mockResolvedValue({
      id: 'group-1',
      name: 'group',
    });
    keycloakMock.addUserToGroup.mockResolvedValue(undefined);
    keycloakMock.checkUser.mockResolvedValue([]);
    keycloakMock.createUser.mockResolvedValue({ id: 'new-user-1' });
    keycloakMock.setUserActions.mockResolvedValue(undefined);
  });

  it('authenticates with client credentials and creates resource/policies/permissions/group (no collaborators, no custodian)', async () => {
    const job = makeJob({
      id: 'proj-123',
      ownerId: 'owner-1',
      collaborators: undefined,
      custodian: undefined,
    });

    await processor.handleAddResource(job);

    expect(keycloakMock.auth).toHaveBeenCalledWith();
    expect(keycloakMock.getUserById).toHaveBeenCalledWith('owner-1');

    expect(configServiceMock.get).toHaveBeenCalledWith('auth.clientId');
    expect(keycloakMock.getClientById).toHaveBeenCalledWith(
      'authorisation-service-client',
    );

    // create resource
    expect(keycloakMock.createResource).toHaveBeenCalledWith(
      { id: 'kc-client-1', clientId: 'authorisation-service-client' },
      {
        name: `${resourcePrefix}proj-123`,
        type: 'project',
        displayName: `${resourcePrefix}proj-123`,
        uris: [`project/proj-123`],
        scopes: projectScopes,
      },
    );

    // owner policy
    expect(keycloakMock.createPolicy).toHaveBeenCalledWith(
      { id: 'kc-client-1', clientId: 'authorisation-service-client' },
      'user',
      {
        name: `${ownerPolicyPrefix}proj-123`,
        decisionStrategy: DecisionStrategy.UNANIMOUS,
        logic: Logic.POSITIVE,
        users: ['ownerUser'],
      },
    );

    // owner permission (no custodian then includes connect)
    expect(keycloakMock.createPermission).toHaveBeenCalledWith(
      { id: 'kc-client-1', clientId: 'authorisation-service-client' },
      'scope',
      expect.objectContaining({
        name: `${ownerPermissionPrefix}proj-123`,
        resources: [`${resourcePrefix}proj-123`],
        scopes: [...ownerPermissions, 'connect'],
        policies: [`${ownerPolicyPrefix}proj-123`],
      }),
    );

    // group created + owner added
    expect(keycloakMock.createGroup).toHaveBeenCalledWith({
      name: `${groupPrefix}proj-123`,
    });
    expect(keycloakMock.addUserToGroup).toHaveBeenCalledWith(
      'owner-1',
      'group-1',
    );

    // group policy + permission
    expect(keycloakMock.createPolicy).toHaveBeenCalledWith(
      { id: 'kc-client-1', clientId: 'authorisation-service-client' },
      'group',
      expect.objectContaining({
        name: `${groupPolicyPrefix}proj-123`,
        groups: ['group-1'],
      }),
    );

    expect(keycloakMock.createPermission).toHaveBeenCalledWith(
      { id: 'kc-client-1', clientId: 'authorisation-service-client' },
      'scope',
      expect.objectContaining({
        name: `${groupPermissionPrefix}proj-123`,
        resources: [`${resourcePrefix}proj-123`],
        scopes: groupPermissions,
        policies: [`${groupPolicyPrefix}proj-123`],
      }),
    );

    // analysis policy + permission
    expect(keycloakMock.createPolicy).toHaveBeenCalledWith(
      { id: 'kc-client-1', clientId: 'authorisation-service-client' },
      'user',
      expect.objectContaining({
        name: `${analysisPolicyPrefix}proj-123`,
      }),
    );

    expect(keycloakMock.createPermission).toHaveBeenCalledWith(
      { id: 'kc-client-1', clientId: 'authorisation-service-client' },
      'scope',
      expect.objectContaining({
        name: `${analysisPermissionPrefix}proj-123`,
        resources: [`${resourcePrefix}proj-123`],
        scopes: analysisPermissions,
        policies: [`${analysisPolicyPrefix}proj-123`],
      }),
    );

    // no collaborator/custodian paths
    expect(keycloakMock.checkUser).not.toHaveBeenCalled();
    expect(keycloakMock.createUser).not.toHaveBeenCalled();
    expect(keycloakMock.setUserActions).not.toHaveBeenCalled();
  });

  it('invites collaborators: creates missing users (and sets user actions), adds existing users to group', async () => {
    // collaborator1 => no existing user => createUser + setUserActions
    // collaborator2 => existing users => addUserToGroup for each
    keycloakMock.checkUser.mockImplementation(
      ({ email }: { email: string }) => {
        if (email === 'new@ex.com') return [];
        if (email === 'existing@ex.com')
          return [{ id: 'u1', username: 'existing@ex.com' }];
        return [];
      },
    );

    keycloakMock.createUser.mockResolvedValueOnce({ id: 'created-1' });

    const job = makeJob({
      id: 'proj-123',
      ownerId: 'owner-1',
      collaborators: ['new@ex.com', 'existing@ex.com'],
      custodian: undefined,
    });

    await processor.handleAddResource(job);

    // group created
    expect(keycloakMock.createGroup).toHaveBeenCalledWith({
      name: `${groupPrefix}proj-123`,
    });

    // new collaborator created and added to the created group
    expect(keycloakMock.createUser).toHaveBeenCalledWith({
      email: 'new@ex.com',
      enabled: true,
      groups: [`${groupPrefix}proj-123`],
    });
    expect(keycloakMock.setUserActions).toHaveBeenCalledWith('created-1');

    // existing collaborator added to the
    expect(keycloakMock.addUserToGroup).toHaveBeenCalledWith('u1', 'group-1');
  });

  it('custodian: creates missing custodian user and creates custodian policy/permission', async () => {
    keycloakMock.checkUser.mockResolvedValueOnce([]); // custodian not found
    keycloakMock.createUser.mockResolvedValueOnce({ id: 'custodian-1' });

    const job = makeJob({
      id: 'proj-123',
      ownerId: 'owner-1',
      collaborators: undefined,
      custodian: 'custodian@ex.com',
    });

    await processor.handleAddResource(job);

    // for owner permission, custodian present => ownerPermissions only (no connect)
    expect(keycloakMock.createPermission).toHaveBeenCalledWith(
      expect.anything(),
      'scope',
      expect.objectContaining({
        name: `${ownerPermissionPrefix}proj-123`,
        scopes: ownerPermissions,
      }),
    );

    // custodian user created + actions set
    expect(keycloakMock.createUser).toHaveBeenCalledWith({
      email: 'custodian@ex.com',
      enabled: true,
      groups: [`${groupPrefix}proj-123`],
    });
    expect(keycloakMock.setUserActions).toHaveBeenCalledWith('custodian-1');

    // set custodian policy (email = )
    expect(keycloakMock.createPolicy).toHaveBeenCalledWith(
      expect.anything(),
      'user',
      expect.objectContaining({
        name: `${custodianPolicyPrefix}proj-123`,
        users: ['custodian@ex.com'],
      }),
    );

    expect(keycloakMock.createPermission).toHaveBeenCalledWith(
      expect.anything(),
      'scope',
      expect.objectContaining({
        name: `${custodianPermissionPrefix}proj-123`,
        resources: [`${resourcePrefix}proj-123`],
        scopes: custodianPermissions,
        policies: [`${custodianPolicyPrefix}proj-123`],
      }),
    );
  });

  it('custodian: existing user -> adds to group and uses username in custodian policy', async () => {
    keycloakMock.checkUser.mockResolvedValueOnce([
      { id: 'cust-uid', username: 'custodianUser' },
    ] as UserRepresentation[]);

    const job = makeJob({
      id: 'proj-123',
      ownerId: 'owner-1',
      collaborators: undefined,
      custodian: 'custodian@ex.com',
    });

    await processor.handleAddResource(job);

    expect(keycloakMock.addUserToGroup).toHaveBeenCalledWith(
      'cust-uid',
      'group-1',
    );

    expect(keycloakMock.createPolicy).toHaveBeenCalledWith(
      expect.anything(),
      'user',
      expect.objectContaining({
        name: `${custodianPolicyPrefix}proj-123`,
        users: ['custodianUser'],
      }),
    );
  });

  it('logs error and stops further work when owner cannot be resolved', async () => {
    const errorSpy = jest
      .spyOn((processor as any).logger, 'error')
      .mockImplementation(() => undefined);

    keycloakMock.getUserById.mockResolvedValueOnce(null);

    const job = makeJob({
      id: 'proj-123',
      ownerId: 'owner-missing',
      collaborators: undefined,
      custodian: undefined,
    });

    await processor.handleAddResource(job);

    expect(errorSpy).toHaveBeenCalled();
    // should fail before creating anything
    expect(keycloakMock.createResource).not.toHaveBeenCalled();
    expect(keycloakMock.createGroup).not.toHaveBeenCalled();
  });

  it('logs error if keycloak.auth throws', async () => {
    const errorSpy = jest
      .spyOn((processor as any).logger, 'error')
      .mockImplementation(() => undefined);

    keycloakMock.auth.mockRejectedValueOnce(new Error('auth failed'));

    const job = makeJob({
      id: 'proj-123',
      ownerId: 'owner-1',
      collaborators: undefined,
      custodian: undefined,
    });

    await processor.handleAddResource(job);

    expect(errorSpy).toHaveBeenCalled();
    expect(keycloakMock.getUserById).not.toHaveBeenCalled();
    expect(keycloakMock.createResource).not.toHaveBeenCalled();
  });
});

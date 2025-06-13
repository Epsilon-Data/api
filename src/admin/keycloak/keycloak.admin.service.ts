import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  KeycloakAdminClient,
  UserRepresentation,
  EventRepresentation,
  RoleRepresentation,
  ResourceRepresentation,
  ClientScopeRepresentation,
} from '@epsilon-data/keycloak-admin-client';
import {
  ADMIN_CONFIG,
  AdminModuleConfig,
  KEYCLOAK_ADMIN_INSTANCE,
} from '../config.interface';

export type UserQueryParams = {
  readonly email?: string;
  readonly emailVerified?: string;
  readonly enabled?: boolean;
  readonly exact?: boolean;
  readonly firstName?: string;
  readonly lastName?: string;
  readonly username?: string;
};

const resourcePrefix = 'project:';
const projectScopes = [
  {
    name: 'view',
  },
  {
    name: 'stats',
  },
  {
    name: 'edit',
  },
  {
    name: 'approve',
  },
  {
    name: 'analysis',
  },
  {
    name: 'delete',
  },
  {
    name: 'connect',
  },
];
const ownerPolicyPrefix = 'Owner of ';
const ownerPermissionPrefix = 'Owner ';
const ownerPermissions = [
  'view',
  'edit',
  'delete',
  'approve',
  'analysis',
  'stats',
];
const groupPrefix = 'Collaborators of ';
const groupPolicyPrefix = 'Collaborators on ';
const groupPermissionPrefix = 'Collaborators ';
const groupPermissions = ['view', 'edit', 'approve', 'analysis', 'stats'];
const custodianPolicyPrefix = 'Custodian of ';
const custodianPermissionPrefix = `Custodian `;
const custodianPermissions = ['view', 'edit', 'connect'];

// FIXME: add to keycloak-admin-client
export enum DecisionStrategy {
  AFFIRMATIVE = 'AFFIRMATIVE',
  UNANIMOUS = 'UNANIMOUS',
  CONSENSUS = 'CONSENSUS',
}
export enum DecisionEffect {
  Permit = 'PERMIT',
  Deny = 'DENY',
}
export enum Logic {
  POSITIVE = 'POSITIVE',
  NEGATIVE = 'NEGATIVE',
}
export interface PolicyRoleRepresentation {
  id: string;
  required?: boolean;
}
export interface PolicyRepresentation {
  config?: Record<string, any>;
  decisionStrategy?: DecisionStrategy;
  description?: string;
  id?: string;
  logic?: Logic;
  name?: string;
  owner?: string;
  policies?: string[];
  resources?: string[];
  scopes?: string[];
  type?: string;
  users?: string[];
  roles?: PolicyRoleRepresentation[];
  groups?: string[];
}

export type ClientQuery = {
  readonly clientId?: string;
  readonly viewableOnly?: boolean;
  readonly search?: boolean;
  readonly q?: string;
};

export interface GroupRepresentation {
  id?: string;
  name?: string;
  path?: string;
  subGroupCount?: number;
  subGroups?: GroupRepresentation[];
  access?: Record<string, boolean>;
  attributes?: Record<string, any>;
  clientRoles?: Record<string, any>;
  realmRoles?: string[];
}

@Injectable()
export class KeycloakAdminService {
  private readonly logger = new Logger('KeycloakAdminService');
  // private kcAdminClient: KeycloakAdminClient;

  constructor(
    @Inject(ADMIN_CONFIG) private config: AdminModuleConfig,
    @Inject(KEYCLOAK_ADMIN_INSTANCE)
    private kcAdminClient: KeycloakAdminClient,
  ) {}

  async createUser(user: UserRepresentation) {
    try {
      const userId = await this.kcAdminClient.users.create(user);
      const userRoles = user.realmRoles;
      if (userRoles && userRoles.length > 0)
        await this.mapRealmRolesToUser(userId.id, userRoles);
      return userId;
    } catch (error) {
      this.logger.error('Error in createUser', error);
    }
  }
  async setUserActions(userId: string) {
    this.logger.debug(`Setting user actions for ${userId}`);
    try {
      await this.kcAdminClient.users.executeActionsEmail({
        id: userId,
        actions: ['UPDATE_PASSWORD'],
      });
    } catch (error) {
      this.logger.error('Error in setUserActions', error);
    }
  }

  async mapRealmRolesToUser(id: string, userRoles: readonly string[]) {
    const listOfRoles =
      await this.kcAdminClient.users.listAvailableRealmRoleMappings({
        id,
        realm: this.config.realm,
      });
    const roles = listOfRoles
      .filter((availableRole) =>
        userRoles.includes(availableRole.name as string),
      )
      .map((role) => {
        return { id: role.id as string, name: role.name as string };
      });

    if (roles.length === userRoles.length) {
      return await this.kcAdminClient.users.addRealmRoleMappings({
        id,
        roles,
        realm: this.config.realm,
      });
    } else {
      const listOfRoleNames = listOfRoles.map((role) => role.name);
      const rolesNotMapped = userRoles.filter(
        (role) => !listOfRoleNames.includes(role),
      );
      return Promise.resolve(rolesNotMapped);
    }
  }

  async getAllUsersAndLastLogin(query?: UserQueryParams) {
    try {
      const usersQuery = await this.kcAdminClient.users.find(
        {
          ...query,
          realm: this.config.realm,
        },
        { catchNotFound: false },
      );
      const eventsQuery = await this.kcAdminClient.realms.findEvents({
        realm: this.config.realm,
        type: 'LOGIN',
      });

      const [users, events] = await Promise.all([usersQuery, eventsQuery]);
      return users.map((user) => {
        const lastLoginEvent = this.getUserLastLoginEvent(user.id, events);
        return {
          ...user,
          lastLogin: new Date(lastLoginEvent?.time),
        };
      });
    } catch (error) {
      this.logger.error('Error in getAllUsersAndLastLogin', error);
    }
  }
  async getAllUsers(query?: UserQueryParams) {
    try {
      return await this.kcAdminClient.users.find(
        {
          ...query,
          realm: this.config.realm,
        },
        { catchNotFound: false },
      );
    } catch (error) {
      this.logger.error('Error in getAllUsers', error);
    }
  }

  async getClientByName() {
    try {
      return await this.kcAdminClient.clients.find(
        {
          clientId: 'epsilon-token-handler',
          realm: this.config.realm,
        },
        { catchNotFound: false },
      );
    } catch (error) {
      this.logger.error('Error in getClientByName', error);
    }
  }

  async getClients() {
    try {
      return await this.kcAdminClient.clients.find();
    } catch (error) {
      this.logger.error('Error in getClients', error);
    }
  }
  async getUserById(id: string) {
    try {
      const userQuery = await this.kcAdminClient.users.findOne(
        {
          id,
          realm: this.config.realm,
        },
        { catchNotFound: false },
      );
      const eventsQuery = await this.kcAdminClient.realms.findEvents({
        realm: this.config.realm,
        type: 'LOGIN',
        user: id,
      });

      const [user, events] = await Promise.all([userQuery, eventsQuery]);

      const lastLoginEvent = this.getUserLastLoginEvent(user.id, events);
      return {
        ...user,
        lastLogin: new Date(lastLoginEvent?.time),
      };
    } catch (error) {
      this.logger.error('Error in getUserById', error);
    }
  }

  async checkUser(query: UserQueryParams) {
    try {
      return await this.kcAdminClient.users.find(
        {
          ...query,
          realm: this.config.realm,
        },
        { catchNotFound: false },
      );
    } catch (error) {
      this.logger.error('Error in getAllUsers', error);
    }
  }

  async updateUser(id: string, user: Partial<UserRepresentation>) {
    try {
      return await this.kcAdminClient.users.update(
        { id, realm: this.config.realm },
        user,
      );
    } catch (error) {
      this.logger.error('Error in updateUser', error);
    }
  }

  async deleteUser(id: string) {
    try {
      return await this.kcAdminClient.users.del({
        id,
        realm: this.config.realm,
      });
    } catch (error) {
      this.logger.error('Error in deleteUser', error);
    }
  }

  async createRole(role: RoleRepresentation) {
    try {
      const { roleName } = await this.kcAdminClient.roles.create(role);
      // get new role ID
      const roleRepresentation: RoleRepresentation =
        await this.getRoleByName(roleName);
      return { id: roleRepresentation?.id as string };
    } catch (error) {
      this.logger.error('Error in createRole', error);
    }
  }
  async createGroup(group: GroupRepresentation) {
    try {
      return await this.kcAdminClient.groups.create({
        ...group,
        realm: this.config.realm,
      });
    } catch (error) {
      this.logger.error('Error in createGroup', error);
    }
  }
  async addUserToGroup(id: string, groupId: string) {
    try {
      return await this.kcAdminClient.users.addToGroup({
        id,
        groupId,
        realm: this.config.realm,
      });
    } catch (error) {
      this.logger.error('Error in addUserToGroup', error);
    }
  }
  async getGroupById(id: string) {
    try {
      return await this.kcAdminClient.groups.findOne({
        id,
        realm: this.config.realm,
      });
    } catch (error) {
      this.logger.error('Error in getGroupById', error);
    }
  }
  async getGroupByName(name: string) {
    try {
      return await this.kcAdminClient.groups.find({
        q: 'name',
        search: name,
        realm: this.config.realm,
      });
    } catch (error) {
      this.logger.error('Error in getGroupById', error);
    }
  }
  async getRoleById(id: string) {
    try {
      return await this.kcAdminClient.roles.findOneById({
        id,
        realm: this.config.realm,
      });
    } catch (error) {
      this.logger.error('Error in getRoleById', error);
    }
  }

  async getRoleByName(name: string) {
    try {
      return await this.kcAdminClient.roles.findOneByName({
        name,
        realm: this.config.realm,
      });
    } catch (error) {
      this.logger.error('Error in getRoleByName', error);
    }
  }

  async updateRole(id: string, role: Partial<RoleRepresentation>) {
    try {
      return await this.kcAdminClient.roles.updateById(
        {
          id,
          realm: this.config.realm,
        },
        role,
      );
    } catch (error) {
      this.logger.error('Error in updateRole', error);
    }
  }

  async deleteRole(id: string) {
    try {
      return await this.kcAdminClient.roles.delById({
        id,
        realm: this.config.realm,
      });
    } catch (error) {
      this.logger.error('Error in deleteRole', error);
    }
  }

  private getUserLastLoginEvent(userId, events) {
    return events
      .filter((loginEvent: EventRepresentation) => loginEvent.userId === userId)
      .sort((a, b) => (b.time || 0) - (a.time || 0))[0];
  }

  async createScope(scope: ClientScopeRepresentation) {
    try {
      // get new scope id
      return await this.kcAdminClient.clientScopes.create(scope);
    } catch (error) {
      this.logger.error('Error in createScope', error);
    }
  }

  async newResource(
    id: string,
    owner: string,
    collaborators: string[],
    custodian?: string,
  ) {
    // create resource
    await this.createResource({
      name: `${resourcePrefix}${id}`,
      type: 'project',
      displayName: `${resourcePrefix}${id}`,
      uris: [`project/${id}`],
      // TODO: make into const object
      scopes: projectScopes,
    });
    // create owner policy
    await this.createPolicy('user', {
      name: `${ownerPolicyPrefix}${id}`,
      decisionStrategy: DecisionStrategy.UNANIMOUS,
      logic: Logic.POSITIVE,
      users: [owner],
    });

    // create owner permission
    await this.createPermission('scope', {
      name: `${ownerPermissionPrefix}${id}`,
      decisionStrategy: DecisionStrategy.UNANIMOUS,
      logic: Logic.POSITIVE,
      resources: [`${resourcePrefix}${id}`],
      // TODO: add these as constants
      scopes: custodian ? ownerPermissions : [...ownerPermissions, 'connect'],
      policies: [`${ownerPolicyPrefix}${id}`],
    });

    // create group
    const createGroup = await this.createGroup({
      name: `${groupPrefix}${id}`,
    });

    // add owner to group
    const getOwnerId = await this.getAllUsers({ username: owner });
    await this.addUserToGroup(getOwnerId[0].id, createGroup.id);

    // create group policy
    await this.createPolicy('group', {
      name: `${groupPolicyPrefix}${id}`,
      decisionStrategy: DecisionStrategy.UNANIMOUS,
      logic: Logic.POSITIVE,
      groups: [createGroup.id],
    });

    // create group permission
    await this.createPermission('scope', {
      name: `${groupPermissionPrefix}${id}`,
      decisionStrategy: DecisionStrategy.UNANIMOUS,
      logic: Logic.POSITIVE,
      resources: [`${resourcePrefix}${id}`],
      scopes: groupPermissions,
      policies: [`${groupPolicyPrefix}${id}`],
    });

    // invite collaborators and add them to the group
    await collaborators.map(async (email) => {
      const users = await this.checkUser({ email });
      if (!users.length) {
        // TODO: add realm roles to user
        const user = await this.createUser({
          username: email,
          email,
          enabled: true,
          groups: [`${groupPrefix}${id}`],
        });
        await this.setUserActions(user.id);
      } else {
        users.map(async (user: UserRepresentation) => {
          await this.addUserToGroup(user.id, createGroup.id);
        });
      }
    });
    if (custodian) {
      const users = await this.checkUser({ email: custodian });
      if (!users.length) {
        // TODO: add realmroles to user
        const user = await this.createUser({
          username: custodian,
          email: custodian,
          enabled: true,
          groups: [`${groupPrefix}${id}`],
        });
        await this.setUserActions(user.id);
      } else {
        users.map(async (user: UserRepresentation) => {
          await this.addUserToGroup(user.id, createGroup.id);
        });
      }
      // create custodian policy
      await this.createPolicy('user', {
        name: `${custodianPolicyPrefix}${id}`,
        decisionStrategy: DecisionStrategy.UNANIMOUS,
        logic: Logic.POSITIVE,
        users: [owner],
      });

      // create custodian permission
      await this.createPermission('scope', {
        name: `${custodianPermissionPrefix}${id}`,
        decisionStrategy: DecisionStrategy.UNANIMOUS,
        logic: Logic.POSITIVE,
        resources: [`${resourcePrefix}${id}`],
        // TODO: add these as constants
        scopes: custodianPermissions,
        policies: [`${custodianPolicyPrefix}${id}`],
      });
    }
  }
  async createResource(resource: ResourceRepresentation) {
    this.logger.debug('Creating resource...');
    try {
      const client = await this.getClientByName();
      return this.kcAdminClient.clients.createResource(
        // TODO: needs changing to token-handler
        { id: client[0].id, realm: this.config.realm },
        resource,
      );
    } catch (error) {
      this.logger.error('Error in createResource', error);
    }
  }
  async createPolicy(policyType: string, policy: PolicyRepresentation) {
    this.logger.debug(`Creating ${policyType} policy...`);
    try {
      const client = await this.getClientByName();
      return this.kcAdminClient.clients.createPolicy(
        {
          id: client[0].id,
          type: policyType,
        },
        policy,
      );
    } catch (error) {
      this.logger.error('Error in createPolicy', error);
    }
  }
  async createPermission(permissionType: string, policy: PolicyRepresentation) {
    this.logger.debug(`Creating ${permissionType} permission...`);
    try {
      const client = await this.getClientByName();
      return this.kcAdminClient.clients.createPolicy(
        {
          id: client[0].id,
          type: permissionType,
        },
        policy,
      );
    } catch (error) {
      this.logger.error('Error in createPermission', error);
    }
  }

  async getAccessToken(
    clientId: string,
    clientSecret: string,
  ): Promise<{
    access_token: string;
    expires_in?: number;
  }> {
    try {
      const { issuerBaseURL, realm } = this.config;

      await this.kcAdminClient.setConfig({
        baseUrl: issuerBaseURL,
        realmName: realm,
      });

      await this.kcAdminClient.auth({
        grantType: 'client_credentials',
        clientId,
        clientSecret,
      });

      const token = await this.kcAdminClient.getAccessToken();
      return { access_token: token };
    } catch (error) {
      this.logger.error('Error getting access token', error);
      throw error;
    }
  }

  //FIXME: not working properly
  async deleteResource(id: string) {
    this.logger.debug('Deleting resource', id);
    try {
      const client = await this.getClientByName();
      this.logger.debug(`Deleting resource ${id}, for client ${client[0].id}`);
      const deleteResource = await this.kcAdminClient.clients.delResource({
        id: client[0].id,
        resourceId: id,
        realm: this.config.realm,
      });

      // const group = await this.getGroupByName(`${groupPrefix}${id}`);
      // if (group.length)
      //   await this.kcAdminClient.groups.del({ id: group[0].id });
      return deleteResource;
    } catch (error) {
      this.logger.error('Error in deleteResource', error);
    }
  }
}

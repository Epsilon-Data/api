import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  KeycloakAdminClient,
  UserRepresentation,
  EventRepresentation,
  RoleRepresentation,
  ResourceRepresentation,
  ClientScopeRepresentation,
  ClientRepresentation,
  Credentials,
  PolicyRepresentation,
  GroupRepresentation,
  DecisionStrategy,
  Logic,
} from '@epsilon-data/keycloak-admin-client';
import { ADMIN_CONFIG, KEYCLOAK_ADMIN_INSTANCE } from '../config.interface';

import type { AdminModuleConfig } from '../config.interface';

import { ConfigService } from '@nestjs/config';
import { LoginDto } from 'src/analysis/dto';

// FIXME: add to consts and DTOs
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
const analysisPolicyPrefix = 'Analysis of ';
const analysisPermissionPrefix = `Analysis `;
const analysisPermissions = ['analysis'];

export type UserQueryParams = {
  readonly email?: string;
  readonly emailVerified?: string;
  readonly enabled?: boolean;
  readonly exact?: boolean;
  readonly firstName?: string;
  readonly lastName?: string;
  readonly username?: string;
};

export interface ExtendedPolicyRepresentation extends PolicyRepresentation {
  groups?: string[];
}
@Injectable()
export class KeycloakAdminService {
  private readonly logger = new Logger('KeycloakAdminService');
  // TODO: get client for resource service
  // private client
  // private kcAdminClient: KeycloakAdminClient;

  constructor(
    @Inject(ADMIN_CONFIG) private config: AdminModuleConfig,
    @Inject(KEYCLOAK_ADMIN_INSTANCE)
    private kcAdminClient: KeycloakAdminClient,
    private configService: ConfigService,
  ) {}

  async auth(credentials: Credentials) {
    return await this.kcAdminClient.auth(credentials);
  }

  async createUser(user: UserRepresentation) {
    try {
      const userId = await this.kcAdminClient.users.create(user);
      const userRoles = user.realmRoles;
      if (userRoles && userRoles.length > 0)
        await this.mapRealmRolesToUser(userId.id, userRoles);
      return userId;
    } catch (error) {
      this.logger.error('Error in createUser', error);
      throw error;
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
      const usersQuery = this.kcAdminClient.users.find(
        {
          ...query,
          realm: this.config.realm,
        },
        { catchNotFound: false },
      );

      const eventsQuery = this.kcAdminClient.realms.findEvents({
        realm: this.config.realm,
        type: 'LOGIN',
      });

      const [users, events] = await Promise.all([usersQuery, eventsQuery]);

      return users.map((user) => {
        const lastLoginEvent = events
          ? this.getUserLastLoginEvent(user.id!, events)
          : null;
        return {
          ...user,
          lastLogin: lastLoginEvent ? new Date(lastLoginEvent.time!) : null,
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
      const clients = await this.kcAdminClient.clients.find(
        {
          clientId: 'epsilon-token-handler',
          realm: this.config.realm,
        },
        { catchNotFound: false },
      );
      if (clients.length) {
        return clients[0];
      } else {
        throw new Error('Keycloak client does not exist!');
      }
    } catch (error) {
      this.logger.error('Error in getClientByName', error);
      throw error;
    }
  }

  async getClients() {
    try {
      return await this.kcAdminClient.clients.find();
    } catch (error) {
      this.logger.error('Error in getClients', error);
    }
  }
  async getUserInfoById(id: string) {
    try {
      const userQuery = this.kcAdminClient.users.findOne(
        {
          id,
          realm: this.config.realm,
        },
        { catchNotFound: false },
      );
      const eventsQuery = this.kcAdminClient.realms.findEvents({
        realm: this.config.realm,
        type: 'LOGIN',
        user: id,
      });

      const [user, events] = await Promise.all([userQuery, eventsQuery]);

      if (user) {
        const lastLoginEvent = events
          ? this.getUserLastLoginEvent(user.id!, events)
          : null;
        return {
          ...user,
          lastLogin: lastLoginEvent ? new Date(lastLoginEvent.time!) : null,
        };
      }
    } catch (error) {
      this.logger.error('Error in getUserInfoById', error);
    }
  }

  async getUserById(id: string) {
    try {
      return await this.kcAdminClient.users.findOne(
        {
          id,
          realm: this.config.realm,
        },
        { catchNotFound: false },
      );
    } catch (error) {
      this.logger.error('Error in getUserById', error);
      throw error;
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
      const roleRepresentation: RoleRepresentation = (await this.getRoleByName(
        roleName,
      )) as ResourceRepresentation;
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
      throw error;
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
      throw error;
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
      throw error;
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
      throw error;
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
      throw error;
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
      throw error;
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
      throw error;
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

  private getUserLastLoginEvent(userId: string, events: EventRepresentation[]) {
    return events
      .filter((loginEvent: EventRepresentation) => loginEvent.userId === userId)
      .sort((a, b) => (b.time || 0) - (a.time || 0))[0];
  }

  async newResource(
    id: string,
    ownerId: string,
    collaborators?: string[],
    custodian?: string,
  ) {
    try {
      // get owner username
      const owner = await this.getUserById(ownerId);
      if (!owner)
        throw new Error(
          `Owner with id ${ownerId} doesn't exists. This should not happen!`,
        );
      const ownerUsername = owner.username!;

      // get client
      const client = await this.getClientByName();

      // create resource
      await this.createResource(client, {
        name: `${resourcePrefix}${id}`,
        type: 'project',
        displayName: `${resourcePrefix}${id}`,
        // TODO: make this URL same as frontend
        uris: [`project/${id}`],
        scopes: projectScopes,
      });

      // create owner policy
      await this.createPolicy(client, 'user', {
        name: `${ownerPolicyPrefix}${id}`,
        decisionStrategy: DecisionStrategy.UNANIMOUS,
        logic: Logic.POSITIVE,
        users: [ownerUsername],
      });

      // create owner permission
      await this.createPermission(client, 'scope', {
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
      await this.addUserToGroup(ownerId, createGroup.id);

      // create group policy
      await this.createPolicy(client, 'group', {
        name: `${groupPolicyPrefix}${id}`,
        decisionStrategy: DecisionStrategy.UNANIMOUS,
        logic: Logic.POSITIVE,
        groups: [createGroup.id],
      });

      // create group permission
      await this.createPermission(client, 'scope', {
        name: `${groupPermissionPrefix}${id}`,
        decisionStrategy: DecisionStrategy.UNANIMOUS,
        logic: Logic.POSITIVE,
        resources: [`${resourcePrefix}${id}`],
        scopes: groupPermissions,
        policies: [`${groupPolicyPrefix}${id}`],
      });

      // create analysis policy
      await this.createPolicy(client, 'user', {
        name: `${analysisPolicyPrefix}${id}`,
        decisionStrategy: DecisionStrategy.UNANIMOUS,
        logic: Logic.POSITIVE,
      });

      // create analysis permission
      await this.createPermission(client, 'scope', {
        name: `${analysisPermissionPrefix}${id}`,
        decisionStrategy: DecisionStrategy.UNANIMOUS,
        logic: Logic.POSITIVE,
        resources: [`${resourcePrefix}${id}`],
        scopes: analysisPermissions,
        policies: [`${analysisPolicyPrefix}${id}`],
      });

      // invite collaborators and add them to the group
      // TODO: improve this
      if (collaborators) {
        const collabQueries = collaborators.map(async (email) => {
          const users = (await this.checkUser({ email })) || [];
          if (!users.length) {
            // TODO: add realm roles to user
            const user = await this.createUser({
              username: email,
              email,
              enabled: true,
              groups: [`${groupPrefix}${id}`],
            });
            return await this.setUserActions(user.id);
          } else {
            return users.map(async (user: UserRepresentation) => {
              await this.addUserToGroup(user.id!, createGroup.id);
            });
          }
        });
        await Promise.all(collabQueries);
      }

      if (custodian) {
        // temp username
        let custodianUserName = custodian.split('@')[0];
        const users = (await this.checkUser({ email: custodian })) || [];
        if (!users.length) {
          // TODO: add realmroles to user
          const user = await this.createUser({
            username: custodianUserName,
            email: custodian,
            enabled: true,
            groups: [`${groupPrefix}${id}`],
          });
          await this.setUserActions(user.id);
        } else {
          const user = users[0];
          custodianUserName = user.username!;
          await this.addUserToGroup(user.id!, createGroup.id);
        }
        // create custodian policy
        await this.createPolicy(client, 'user', {
          name: `${custodianPolicyPrefix}${id}`,
          decisionStrategy: DecisionStrategy.UNANIMOUS,
          logic: Logic.POSITIVE,
          users: [custodianUserName],
        });

        // create custodian permission
        await this.createPermission(client, 'scope', {
          name: `${custodianPermissionPrefix}${id}`,
          decisionStrategy: DecisionStrategy.UNANIMOUS,
          logic: Logic.POSITIVE,
          resources: [`${resourcePrefix}${id}`],
          scopes: custodianPermissions,
          policies: [`${custodianPolicyPrefix}${id}`],
        });
      }
    } catch (error) {
      this.logger.error(`Error creating resource`, error);
    }
  }

  async createResource(
    client: ClientRepresentation,
    resource: ResourceRepresentation,
  ) {
    this.logger.debug('Creating resource...');
    try {
      return this.kcAdminClient.clients.createResource(
        // TODO: needs changing to token-handler
        { id: client.id!, realm: this.config.realm },
        resource,
      );
    } catch (error) {
      this.logger.error('Error in createResource', error);
      throw error;
    }
  }
  async createScope(scope: ClientScopeRepresentation) {
    try {
      // get new scope id
      return await this.kcAdminClient.clientScopes.create(scope);
    } catch (error) {
      this.logger.error('Error in createScope', error);
      throw error;
    }
  }
  async createPolicy(
    client: ClientRepresentation,
    policyType: string,
    policy: ExtendedPolicyRepresentation,
  ) {
    this.logger.debug(`Creating ${policy.name} policy...`);
    try {
      return this.kcAdminClient.clients.createPolicy(
        {
          id: client.id!,
          type: policyType,
        },
        policy,
      );
    } catch (error) {
      this.logger.error('Error in createPolicy', error);
      throw error;
    }
  }

  async addUserToUserPolicy(projectId: string, userId: string) {
    this.logger.debug(
      `Modifying policy ${analysisPolicyPrefix}${projectId}, adding user ${userId}`,
    );
    try {
      // get client
      const client = await this.getClientByName();
      const user = await this.getUserById(userId);
      if (!user)
        throw new Error(
          `User with id ${userId} doesn't exists. This should not happen!`,
        );
      const username = user.username!;
      const existingPolicy = await this.kcAdminClient.clients.findPolicyByName({
        id: client.id!,
        realm: this.config.realm,
        name: `${analysisPolicyPrefix}${projectId}`,
      });
      let policy: PolicyRepresentation = {
        name: `${analysisPolicyPrefix}${projectId}`,
        decisionStrategy: DecisionStrategy.UNANIMOUS,
        type: 'user',
        logic: Logic.POSITIVE,
        users: [username],
      };
      if (existingPolicy) {
        const existingUsers = new Set(existingPolicy.users ?? []);
        existingUsers.add(username);
        policy = {
          ...existingPolicy,
          type: existingPolicy.type ?? 'user',
          users: Array.from(existingUsers),
        };
      }
      await this.kcAdminClient.clients.createOrUpdatePolicy({
        id: client.id!,
        policyName: `${analysisPolicyPrefix}${projectId}`,
        policy: policy,
      });

      if (!existingPolicy)
        // create analysis permission as the existing Policy didn't exist
        await this.createPermission(client, 'scope', {
          name: `${analysisPermissionPrefix}${projectId}`,
          decisionStrategy: DecisionStrategy.UNANIMOUS,
          logic: Logic.POSITIVE,
          resources: [`${resourcePrefix}${projectId}`],
          scopes: analysisPermissions,
          policies: [`${analysisPolicyPrefix}${projectId}`],
        });
    } catch (error) {
      this.logger.error('Error in addUserToUserPolicy', error);
      throw error;
    }
  }
  async createPermission(
    client: ClientRepresentation,
    permissionType: string,
    policy: PolicyRepresentation,
  ) {
    this.logger.debug(`Creating ${policy.name} permission...`);
    try {
      return this.kcAdminClient.clients.createPermission(
        {
          id: client.id!,
          type: permissionType,
        },
        policy,
      );
    } catch (error) {
      this.logger.error('Error in createPermission', error);
      throw error;
    }
  }

  // TODO: perhaps change from doing the auth for each operation
  async getAccessToken(login: LoginDto): Promise<{
    access_token: string;
    expires_in?: number;
  }> {
    await this.auth({
      grantType: 'password',
      clientId: this.configService.get<string>('sdk.clientId')!,
      username: login.username,
      password: login.password,
    });

    const token = await this.kcAdminClient.getAccessToken();
    return { access_token: token || '' };
  }

  //FIXME: not working properly
  async deleteResource(id: string) {
    this.logger.debug('Deleting resource', id);
    try {
      const client = await this.getClientByName();
      if (client) {
        this.logger.debug(`Deleting resource ${id}, for client ${client.id}`);
        const deleteResource = await this.kcAdminClient.clients.delResource({
          id: client.id!,
          resourceId: id,
          realm: this.config.realm,
        });
        // const group = await this.getGroupByName(`${groupPrefix}${id}`);
        // if (group.length)
        //   await this.kcAdminClient.groups.del({ id: group[0].id });
        return deleteResource;
      }
    } catch (error) {
      this.logger.error('Error in deleteResource', error);
      throw error;
    }
  }
}

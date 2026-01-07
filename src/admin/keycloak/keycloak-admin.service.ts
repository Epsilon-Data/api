import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
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
import {
  ADMIN_CONFIG,
  KEYCLOAK_ADMIN_INSTANCE,
} from '../admin-config.interface';

import type { AdminModuleConfig } from '../admin-config.interface';

import { ConfigService } from '@nestjs/config';
import { LoginDto } from 'src/analysis/dto';
import {
  resourcePrefix,
  analysisPolicyPrefix,
  analysisPermissionPrefix,
  analysisPermissions,
} from 'src/utils/options.util';

import {
  KeycloakAdminError,
  KeycloakBadRequestError,
  KeycloakUnauthorizedError,
  KeycloakForbiddenError,
  KeycloakNotFoundError,
  KeycloakConflictError,
  KeycloakUnavailableError,
} from './keycloak-admin.errors';
import { ClientLoginDto } from 'src/coordinator/dto';

export type UserQueryParams = {
  readonly email?: string;
  readonly emailVerified?: string;
  readonly enabled?: boolean;
  readonly exact?: boolean;
  readonly firstName?: string;
  readonly lastName?: string;
  readonly username?: string;
};

type UserWithLastLogin = UserRepresentation & {
  lastLogin: Date | null;
};

export interface ExtendedPolicyRepresentation extends PolicyRepresentation {
  groups?: string[];
}

@Injectable()
export class KeycloakAdminService implements OnModuleInit {
  private readonly logger = new Logger('KeycloakAdminService');
  private defaultClient: ClientRepresentation;

  constructor(
    @Inject(KEYCLOAK_ADMIN_INSTANCE)
    private kcAdminClient: KeycloakAdminClient,
    @Inject(ADMIN_CONFIG) private config: AdminModuleConfig,
    private configService: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.logger.log('Initialising KeycloakAdminService…');

    try {
      const credentials: Credentials = {
        grantType: 'client_credentials',
        clientId: this.config.clientId,
        clientSecret: this.config.clientSecret,
      };
      await this.auth(credentials);
      // set defaultClient
      this.defaultClient = await this.getClientById();

      this.logger.log('KeycloakAdminService initialised successfully');
    } catch (err) {
      this.logger.error(
        'Failed to initialise KeycloakAdminService',
        err as Error,
      );
      throw err; // Fatal error on startup
    }
  }

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
      return this.handleKeycloakError('createUser', error);
    }
  }
  async setUserActions(userId: string) {
    this.logger.debug(`Setting user actions for ${userId}`);
    try {
      await this.kcAdminClient.users.executeActionsEmail({
        id: userId,
        clientId: this.configService.get<string>('auth.clientId'),
        actions: ['UPDATE_PASSWORD'],
        redirectUri: this.configService.get<string>('appUrl'),
      });
    } catch (error) {
      return this.handleKeycloakError('setUserActions', error);
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

  async getAllUsersAndLastLogin(
    query?: UserQueryParams,
  ): Promise<UserWithLastLogin[]> {
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
      return this.handleKeycloakError('getAllUsersAndLastLogin', error);
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
      return this.handleKeycloakError('getAllUsers', error);
    }
  }

  async getClientById(clientId?: string) {
    const requestedClientId =
      clientId ?? this.configService.get<string>('auth.clientId');
    try {
      const clients = await this.kcAdminClient.clients.find(
        {
          clientId: requestedClientId,
          realm: this.config.realm,
        },
        { catchNotFound: false },
      );
      if (!clients.length) {
        throw new KeycloakNotFoundError(
          `Keycloak client '${requestedClientId}' does not exist`,
        );
      }

      return clients[0];
    } catch (error) {
      return this.handleKeycloakError('getClientById', error);
    }
  }

  async getClients() {
    try {
      return await this.kcAdminClient.clients.find();
    } catch (error) {
      return this.handleKeycloakError('getClients', error);
    }
  }
  async getUserInfoById(id: string): Promise<UserWithLastLogin> {
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
      } else {
        throw new KeycloakNotFoundError(`Keycloak user '${id}' does not exist`);
      }
    } catch (error) {
      return this.handleKeycloakError('getUserInfoById', error);
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
      return this.logKeycloakError('getUserById', error);
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
      return this.logKeycloakError('checkUser', error);
    }
  }

  async updateUser(id: string, user: Partial<UserRepresentation>) {
    try {
      return await this.kcAdminClient.users.update(
        { id, realm: this.config.realm },
        user,
      );
    } catch (error) {
      return this.handleKeycloakError('updateUser', error);
    }
  }

  async deleteUser(id: string) {
    try {
      return await this.kcAdminClient.users.del({
        id,
        realm: this.config.realm,
      });
    } catch (error) {
      return this.handleKeycloakError('deleteUser', error);
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
      return this.handleKeycloakError('createRole', error);
    }
  }
  async createGroup(group: GroupRepresentation) {
    this.logger.debug(`Creating ${group.name} group...`);
    try {
      return await this.kcAdminClient.groups.create({
        ...group,
        realm: this.config.realm,
      });
    } catch (error) {
      return this.handleKeycloakError('createGroup', error);
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
      return this.handleKeycloakError('addUserToGroup', error);
    }
  }
  async getGroupById(id: string) {
    try {
      return await this.kcAdminClient.groups.findOne({
        id,
        realm: this.config.realm,
      });
    } catch (error) {
      return this.handleKeycloakError('getGroupById', error);
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
      return this.handleKeycloakError('getGroupByName', error);
    }
  }
  async getRoleById(id: string) {
    try {
      return await this.kcAdminClient.roles.findOneById({
        id,
        realm: this.config.realm,
      });
    } catch (error) {
      return this.handleKeycloakError('getRoleById', error);
    }
  }

  async getRoleByName(name: string) {
    try {
      return await this.kcAdminClient.roles.findOneByName({
        name,
        realm: this.config.realm,
      });
    } catch (error) {
      return this.handleKeycloakError('getRoleByName', error);
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
      return this.handleKeycloakError('updateRole', error);
    }
  }

  async deleteRole(id: string) {
    try {
      return await this.kcAdminClient.roles.delById({
        id,
        realm: this.config.realm,
      });
    } catch (error) {
      return this.handleKeycloakError('deleteRole', error);
    }
  }

  private getUserLastLoginEvent(userId: string, events: EventRepresentation[]) {
    return events
      .filter((loginEvent: EventRepresentation) => loginEvent.userId === userId)
      .sort((a, b) => (b.time || 0) - (a.time || 0))[0];
  }

  async createResource(
    client: ClientRepresentation,
    resource: ResourceRepresentation,
  ) {
    this.logger.debug(`Creating ${resource.name} resource...`);
    try {
      return this.kcAdminClient.clients.createResource(
        { id: client.id!, realm: this.config.realm },
        resource,
      );
    } catch (error) {
      return this.handleKeycloakError('createResource', error);
    }
  }
  async createScope(scope: ClientScopeRepresentation) {
    try {
      // get new scope id
      return await this.kcAdminClient.clientScopes.create(scope);
    } catch (error) {
      return this.handleKeycloakError('createScope', error);
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
      return this.handleKeycloakError('createPolicy', error);
    }
  }

  async addUserToUserPolicy(projectId: string, userId: string) {
    this.logger.debug(
      `Modifying policy ${analysisPolicyPrefix}${projectId}, adding user ${userId}`,
    );
    try {
      const existingPolicy = await this.kcAdminClient.clients.findPolicyByName({
        id: this.defaultClient.id!,
        realm: this.config.realm,
        name: `${analysisPolicyPrefix}${projectId}`,
      });
      let policy: PolicyRepresentation = {
        name: `${analysisPolicyPrefix}${projectId}`,
        decisionStrategy: DecisionStrategy.UNANIMOUS,
        type: 'user',
        logic: Logic.POSITIVE,
      };
      if (existingPolicy) {
        existingPolicy.config ??= {};

        let parsedUsers: unknown;

        try {
          parsedUsers =
            typeof existingPolicy.config.users === 'string'
              ? JSON.parse(existingPolicy.config.users)
              : [];
        } catch {
          parsedUsers = [];
        }

        const usersArray = Array.isArray(parsedUsers)
          ? parsedUsers.filter((u): u is string => typeof u === 'string')
          : [];

        const existingUsers = new Set<string>(usersArray);
        existingUsers.add(userId);
        policy = {
          ...policy,
          type: existingPolicy.type ?? 'user',
          users: Array.from(existingUsers),
        };
      }
      await this.kcAdminClient.clients.createOrUpdatePolicy({
        id: this.defaultClient.id!,
        policyName: `${analysisPolicyPrefix}${projectId}`,
        policy: policy,
      });

      if (!existingPolicy)
        // create analysis permission as the existing Policy didn't exist
        await this.createPermission(this.defaultClient, 'scope', {
          name: `${analysisPermissionPrefix}${projectId}`,
          decisionStrategy: DecisionStrategy.UNANIMOUS,
          logic: Logic.POSITIVE,
          resources: [`${resourcePrefix}${projectId}`],
          scopes: analysisPermissions,
          policies: [`${analysisPolicyPrefix}${projectId}`],
        });
    } catch (error) {
      return this.handleKeycloakError('addUserToUserPolicy', error);
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
      return this.handleKeycloakError('createPermission', error);
    }
  }

  // used by sdk-client
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

  // used by coordinator
  async getAccessTokenClient(login: ClientLoginDto): Promise<{
    access_token: string;
    expires_in?: number;
  }> {
    await this.auth({
      grantType: 'client_credentials',
      clientId:
        login.clientId ??
        this.configService.get<string>('coordinator.clientId'),
      clientSecret: login.clientSecret,
    });

    const token = await this.kcAdminClient.getAccessToken();
    return { access_token: token || '' };
  }

  //FIXME: not working properly
  async deleteResource(id: string) {
    this.logger.debug('Deleting resource', id);
    try {
      if (this.defaultClient) {
        this.logger.debug(
          `Deleting resource ${id}, for client ${this.defaultClient.id}`,
        );
        const deleteResource = await this.kcAdminClient.clients.delResource({
          id: this.defaultClient.id!,
          resourceId: id,
          realm: this.config.realm,
        });
        // const group = await this.getGroupByName(`${groupPrefix}${id}`);
        // if (group.length)
        //   await this.kcAdminClient.groups.del({ id: group[0].id });
        return deleteResource;
      }
    } catch (error) {
      return this.handleKeycloakError('createPermission', error);
    }
  }

  private handleKeycloakError(context: string, error: unknown): never {
    // log error
    this.logKeycloakError(context, error);

    // error already typed
    if (error instanceof KeycloakAdminError) {
      throw error;
    }

    const err = error as {
      response?: { status?: number; data?: unknown };
      code?: string;
      message?: string;
    };
    const status: number | undefined = err?.response?.status;
    const code: string | undefined = err?.code;

    // Network / connection level errors (Keycloak down, DNS, timeout, etc.)
    if (!status) {
      if (
        code === 'ECONNREFUSED' ||
        code === 'ECONNRESET' ||
        code === 'ETIMEDOUT'
      ) {
        throw new KeycloakUnavailableError('Keycloak is unreachable', error);
      }

      throw new KeycloakAdminError('Unknown Keycloak error', error);
    }

    switch (status) {
      case 400:
        throw new KeycloakBadRequestError(`Bad request in ${context}`, error);
      case 401:
        throw new KeycloakUnauthorizedError(
          `Unauthorized Keycloak request in ${context}`,
          error,
        );
      case 403:
        throw new KeycloakForbiddenError(
          `Forbidden Keycloak request in ${context}`,
          error,
        );
      case 404:
        throw new KeycloakNotFoundError(
          `Keycloak resource not found in ${context}`,
          error,
        );
      case 409:
        throw new KeycloakConflictError(
          `Keycloak resource conflict in ${context}`,
          error,
        );
      default:
        if (status >= 500) {
          throw new KeycloakUnavailableError(
            `Keycloak server error (${status}) in ${context}`,
            error,
          );
        }

        throw new KeycloakAdminError(
          `Unexpected Keycloak error (${status}) in ${context}`,
          error,
        );
    }
  }
  private logKeycloakError(context: string, error: unknown): void {
    this.logger.error(`Keycloak error in ${context}`, error as Error);
  }
}

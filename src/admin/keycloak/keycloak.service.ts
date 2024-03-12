import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  KeycloakAdminClient,
  Credentials,
  UserRepresentation,
  EventRepresentation,
  RoleRepresentation,
} from '@epsilon-data/keycloak-admin-client';
import {
  AdminConfigInjectionToken,
  AdminModuleConfig,
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

@Injectable()
export class KeycloakService {
  private readonly logger = new Logger('UsersService');
  private kcAdminClient: KeycloakAdminClient;
  constructor(
    @Inject(AdminConfigInjectionToken) private config: AdminModuleConfig,
  ) {
    const credentials: Credentials = {
      grantType: 'client_credentials',
      clientId: config.clientId,
      clientSecret: config.clientSecret,
    };
    // NOTE: maybe makes sense to do the init for each request
    // it keeps dropping on keycloak restart
    this.init(credentials);
  }

  async init(credentials: Credentials) {
    this.kcAdminClient = new KeycloakAdminClient({
      baseUrl: new URL(this.config.issuerBaseURL).origin,
      realmName: this.config.realm,
    });
    await this.kcAdminClient.auth(credentials);
  }

  async createUser(user: UserRepresentation) {
    try {
      const userId = await this.kcAdminClient.users.create(user);
      const userRoles = user.realmRoles;
      if (userRoles && userRoles.length > 0)
        await this.mapRealmRolesToUser(userId.id, userRoles);
      return userId;
    } catch (error) {
      this.logger.error(error);
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

  async getAllUsers(query?: UserQueryParams) {
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
      this.logger.error(error);
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
      this.logger.error(error);
    }
  }

  async updateUser(id: string, user: Partial<UserRepresentation>) {
    try {
      return await this.kcAdminClient.users.update(
        { id, realm: this.config.realm },
        user,
      );
    } catch (error) {
      this.logger.error(error);
    }
  }

  async deleteUser(id: string) {
    try {
      return await this.kcAdminClient.users.del({
        id,
        realm: this.config.realm,
      });
    } catch (error) {
      this.logger.error(error);
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
      this.logger.error(error);
    }
  }

  async getRoleById(id: string) {
    try {
      return await this.kcAdminClient.roles.findOneById({
        id,
        realm: this.config.realm,
      });
    } catch (error) {
      this.logger.error(error);
    }
  }

  async getRoleByName(name: string) {
    try {
      return await this.kcAdminClient.roles.findOneByName({
        name,
        realm: this.config.realm,
      });
    } catch (error) {
      this.logger.error(error);
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
      this.logger.error(error);
    }
  }

  async deletRole(id: string) {
    try {
      return await this.kcAdminClient.roles.delById({
        id,
        realm: this.config.realm,
      });
    } catch (error) {
      this.logger.error(error);
    }
  }

  private getUserLastLoginEvent(userId, events) {
    return events
      .filter((loginEvent: EventRepresentation) => loginEvent.userId === userId)
      .sort((a, b) => (b.time || 0) - (a.time || 0))[0];
  }
}

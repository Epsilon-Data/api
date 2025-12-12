import {
  AuthorizationClientException,
  AuthorizationServerException,
  Grant,
} from '@epsilon-data/epsilon-api-middleware';

import { Credentials } from '@epsilon-data/keycloak-admin-client';
import {
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import fetch from 'node-fetch';
import * as querystring from 'querystring';
import type { AuthModuleConfig } from '../config.interface';
import { AUTH_CONFIG } from '../config.interface';
import {
  KeycloakAuthzRequestDto,
  KeycloakPermissionDto,
  KeycloakTokenResponseDto,
  PermissionDto,
} from '../dto';
import { Request } from 'express';
// TODO: worth moving all these methods to token-handler
@Injectable()
export class KeycloakService {
  private readonly logger = new Logger('KeycloakService');

  constructor(@Inject(AUTH_CONFIG) private config: AuthModuleConfig) {}

  async getAccessToken(credentials: Credentials) {
    const params = {
      grant_type: credentials.grantType,
      client_id: credentials.clientId,
      ...(credentials.grantType === 'client_credentials'
        ? { client_secret: credentials.clientSecret }
        : {}),
      ...(credentials.grantType === 'password'
        ? { username: credentials.username, password: credentials.password }
        : {}),
      ...(credentials.grantType === 'refresh_token'
        ? { refresh_token: credentials.refreshToken }
        : {}),
    };

    const data = querystring.stringify(params);
    const res = (await fetch(
      `${this.config.issuerBaseURL}/protocol/openid-connect/token`,
      {
        method: 'POST',
        body: data,
      },
    )) as unknown as Response;
    // Read text if it exists
    const text = await res.text();

    if (res.status >= 500) {
      throw AuthorizationServerException(
        `Server error response in a Permission request: ${text}`,
      );
    }

    if (res.status >= 400) {
      throw AuthorizationClientException(
        // Add exception
        Grant.AuthorizationCode,
        res.status,
        text,
      );
    }
    return JSON.parse(text) as KeycloakTokenResponseDto[];
  }

  async checkPermission(
    authzRequest: KeycloakAuthzRequestDto,
    request: Request,
  ) {
    const token = (request.auth?.token ||
      this.extractTokenFromHeader(request)) as string;
    if (!token) {
      return Promise.reject(
        new UnauthorizedException('Authorisation token not found'),
      );
    }

    const params = {
      grant_type: 'urn:ietf:params:oauth:grant-type:uma-ticket',
      audience: authzRequest.audience || this.config.clientId,
      permission: [] as string[],
      response_mode: 'permissions',
    };

    const permissions: PermissionDto[] = authzRequest.permissions || [];
    for (let i = 0; i < permissions.length; i++) {
      const resource = permissions[i];
      let permission = resource.id;

      if (resource.scopes && resource.scopes.length > 0) {
        permission += '#';

        for (let j = 0; j < resource.scopes.length; j++) {
          const scope = resource.scopes[j];
          if (permission.indexOf('#') !== permission.length - 1) {
            permission += ',';
          }
          permission += scope;
        }
      }
      params.permission.push(permission);
    }

    const data = querystring.stringify(params);

    const res = (await fetch(
      `${this.config.issuerBaseURL}/protocol/openid-connect/token`,
      {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + token,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: data,
      },
    )) as unknown as Response;

    // Read text if it exists
    const text = await res.text();
    if (res.status >= 500) {
      throw AuthorizationServerException(
        `Server error response in a Permission request: ${text}`,
      );
    }

    if (res.status >= 400) {
      // If the authorization request does not map to any permission, a 403 HTTP status code is returned instead from Keycloak
      if (res.status === 403) {
        // return false from keycloak
        return false;
      }
      throw AuthorizationClientException(
        // Add exception
        Grant.AuthorizationCode,
        res.status,
        text,
      );
    }

    // status is OK, meaning some permissions exist, lets check if we have all of them
    const keycloakPermissions = JSON.parse(text) as KeycloakPermissionDto[];
    if (this.hasAllScopes(permissions, keycloakPermissions)) {
      return true;
    } else {
      return false;
    }
  }

  async getPermissions(
    authzRequest: KeycloakAuthzRequestDto,
    request: Request,
  ) {
    const token = request.auth?.token || this.extractTokenFromHeader(request);
    if (!token) {
      return Promise.reject(new Error('No bearer token'));
    }
    const params = {
      grant_type: 'urn:ietf:params:oauth:grant-type:uma-ticket',
      audience: authzRequest.audience || this.config.clientId,
      response_mode: 'permissions',
    };

    const data = querystring.stringify(params);
    const res = (await fetch(
      `${this.config.issuerBaseURL}/protocol/openid-connect/token`,
      {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + token,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: data,
      },
    )) as unknown as Response;
    // Read text if it exists
    const text = await res.text();

    if (res.status >= 500) {
      throw AuthorizationServerException(
        `Server error response in a Permission request: ${text}`,
      );
    }

    if (res.status >= 400) {
      if (res.status === 403) {
        // If the authorization request does not map to any permission, a 403 HTTP status code is returned instead from Keycloak
        // return empty array of resource permissions
        return [];
      }
      throw AuthorizationClientException(
        // Add exception
        Grant.AuthorizationCode,
        res.status,
        text,
      );
    }
    return JSON.parse(text) as KeycloakPermissionDto[];
  }

  private extractTokenFromHeader(request: Request): string | null {
    const authHeader = request.headers['authorization'];
    if (!authHeader || typeof authHeader !== 'string') return null;

    const [type, token] = authHeader.split(' ');
    return type === 'Bearer' ? token : null;
  }

  private hasAllScopes(
    expected: PermissionDto[],
    kc: KeycloakPermissionDto[],
  ): boolean {
    const kcMap = new Map(kc.map((p) => [p.rsname, new Set(p.scopes)]));

    return expected.every((e) => {
      const kcScopes = kcMap.get(e.id);
      if (!kcScopes) return false;
      return e.scopes.every((s) => kcScopes.has(s));
    });
  }
}

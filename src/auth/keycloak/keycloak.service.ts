import {
  AuthorizationClientException,
  AuthorizationServerException,
  Grant,
} from '@epsilon-data/epsilon-api-middleware';
import { Inject, Injectable, Logger } from '@nestjs/common';
import fetch from 'node-fetch';
import * as querystring from 'querystring';
import type { AuthModuleConfig } from '../config.interface';
import { AUTH_CONFIG } from '../config.interface';
import {
  KeycloakAuthzRequestDto,
  KeycloakPermissionDecisionDto,
  KeycloakPermissionDto,
  PermissionDto,
} from './dto';
import { Request } from 'express';

@Injectable()
export class KeycloakService {
  private readonly logger = new Logger('KeycloakService');

  constructor(@Inject(AUTH_CONFIG) private config: AuthModuleConfig) {}

  async checkPermission(
    authzRequest: KeycloakAuthzRequestDto,
    request: Request,
  ) {
    const token = (request.auth?.token ||
      this.extractTokenFromHeader(request)) as string;
    if (!token) {
      return Promise.reject(new Error('No bearer token'));
    }

    const params = {
      grant_type: 'urn:ietf:params:oauth:grant-type:uma-ticket',
      audience: authzRequest.audience || this.config.clientId,
      permission: [] as string[],
      response_mode: 'decision',
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
      // If the authorization request does not map to any permission, a 403 HTTP status code is returned instead.
      if (res.status === 403) {
        throw AuthorizationClientException(
          // Add exception
          Grant.AuthorizationCode,
          res.status,
          text,
          'Authorization request does not map to any permission',
        );
      }
      throw AuthorizationClientException(
        // Add exception
        Grant.AuthorizationCode,
        res.status,
        text,
      );
    }
    return JSON.parse(text) as KeycloakPermissionDecisionDto;
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
}

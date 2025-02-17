import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  Inject,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import * as KeycloakConnect from 'keycloak-connect';
import { UnauthorizedException } from '@epsilon-data/epsilon-api-middleware';
import { KEYCLOAK_INSTANCE } from './config.interface';

@Injectable()
export class ResourceGuard implements CanActivate {
  private readonly logger = new Logger(ResourceGuard.name);
  private readonly reflector = new Reflector();
  // project 12231321323:creat
  constructor(
    @Inject(KEYCLOAK_INSTANCE)
    private keyCloakInstance: KeycloakConnect.Keycloak,
    private readonly scopes: string | string[] = '',
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const defaultEnforcerOpts: KeycloakConnect.EnforcerOptions = {
      claims: (request: any) => {
        const httpUri = request.url;
        const userAgent = request.headers['user-agent'];

        this.logger.verbose(
          `Enforcing claims, http.uri: ${httpUri}, user.agent: ${userAgent}`,
        );

        return {
          'http.uri': [httpUri],
          'user.agent': userAgent,
        };
      },
    };

    const ctx = context.switchToHttp();
    const request = ctx.getRequest();
    const response = ctx.getResponse();
    // if is not an HTTP request ignore this guard
    if (!request) {
      return true;
    }

    // const grant = await this.keyCloakInstance.grantManager.createGrant({
    //   access_token: request.access_token,
    // });

    // Build the required scopes
    // const conditionalScopesResult =
    //   conditionalScopes != null || conditionalScopes != undefined
    //     ? conditionalScopes(request, grant.access_token)
    //     : [];

    const scopes = [...this.scopes];

    // Attach resolved scopes
    request.scopes = scopes;

    const enforcerFn = createEnforcerContext(
      request,
      response,
      defaultEnforcerOpts,
    );

    // Build permissions
    const permissions = scopes.map(
      (scope) => `Project 5508b930-d587-4006-b347-3ecb49eb471a:${scope}`,
    );
    const isAllowed = await enforcerFn(this.keyCloakInstance, permissions);

    if (response.headersSent) {
      throw UnauthorizedException(`Invalid scopes`);
    }

    return isAllowed;
  }
}

const createEnforcerContext =
  (request: any, response: any, options?: KeycloakConnect.EnforcerOptions) =>
  (keycloak: KeycloakConnect.Keycloak, permissions: string[]) =>
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    new Promise<boolean>((resolve, _) =>
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      keycloak.enforcer(permissions, options)(request, response, (_: any) => {
        if (request.resourceDenied) {
          resolve(false);
        } else {
          resolve(true);
        }
      }),
    );

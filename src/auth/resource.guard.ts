import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UnauthorizedException } from '@epsilon-data/epsilon-api-middleware';
import { KeycloakService } from './keycloak/keycloak.service';
import { META_RESOURCE } from './resource.decorator';
import { META_SCOPES } from 'nest-keycloak-connect';
import {
  ConditionalScopeFn,
  META_CONDITIONAL_SCOPES,
} from './scopes.decorator';

@Injectable()
export class ResourceGuard implements CanActivate {
  private readonly logger = new Logger(ResourceGuard.name);
  private readonly reflector = new Reflector();
  constructor(private keycloakConnect: KeycloakService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // const defaultEnforcerOpts: KeycloakConnect.EnforcerOptions = {
    //   response_mode: 'permissions',
    //   // resource_server_id: 'epsilon-token-handler',
    //   // claims: (request: any) => {
    //   //   const httpUri = request.url;
    //   //   const userAgent = request.headers['user-agent'];

    //   //   this.logger.verbose(
    //   //     `Enforcing claims, http.uri: ${httpUri}, user.agent: ${userAgent}`,
    //   //   );

    //   //   return {
    //   //     'http.uri': [httpUri],
    //   //     'user.agent': userAgent,
    //   //   };
    //   // },
    // };

    const ctx = context.switchToHttp();
    const request = ctx.getRequest();
    const response = ctx.getResponse();
    // if is not an HTTP request ignore this guard
    if (!request) {
      return true;
    }

    // get resource
    const metaResource =
      this.reflector.get<string>(META_RESOURCE, context.getHandler()) ||
      this.reflector.get<string>(META_RESOURCE, context.getClass());

    // get id
    // TODO: make it more general so you can use either params or request body
    const resource = request.params.id
      ? `${metaResource} ${request.params.id}`
      : metaResource;

    //get scopes
    const explicitScopes =
      this.reflector.get<string[]>(META_SCOPES, context.getHandler()) ?? [];
    const conditionalScopes = this.reflector.get<ConditionalScopeFn>(
      META_CONDITIONAL_SCOPES,
      context.getHandler(),
    );
    // Build the required scopes
    const conditionalScopesResult =
      conditionalScopes != null || conditionalScopes != undefined
        ? conditionalScopes(request, request.auth.token)
        : [];

    const scopes = [...explicitScopes, ...conditionalScopesResult];

    // Attach resolved scopes
    request.scopes = [scopes];

    const permission = {
      id: resource,
      scopes: scopes,
    };
    const authzRequest = {
      permissions: [permission],
      response_mode: 'decision', // can be 'permissions'
    };

    const res = await this.keycloakConnect.checkPermission(
      authzRequest,
      request,
    );

    if (response.headersSent) {
      throw UnauthorizedException(`Invalid scopes`);
    }
    return res.result;
  }
}

// const createEnforcerContext =
//   (request: any, response: any, options?: KeycloakConnect.EnforcerOptions) =>
//   (keycloak: KeycloakConnect.Keycloak, permissions: string[]) =>
//     // eslint-disable-next-line @typescript-eslint/no-unused-vars
//     new Promise<boolean>((resolve, _) =>
//       // eslint-disable-next-line @typescript-eslint/no-unused-vars
//       keycloak.enforcer(permissions, options)(request, response, (_: any) => {
//         // console.log(response);
//         if (request.resourceDenied) {
//           resolve(false);
//         } else {
//           resolve(true);
//         }
//       }),
//     );

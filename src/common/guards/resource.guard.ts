import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UnauthorizedException } from '@epsilon-data/epsilon-api-middleware';
import { KeycloakService } from '../../auth/keycloak/keycloak.service';
import { META_RESOURCE } from '../decorators/resource.decorator';
import { META_SCOPES } from '../decorators/scopes.decorator';
import {
  ConditionalScopeFn,
  META_CONDITIONAL_SCOPES,
} from '../decorators/scopes.decorator';
import { KeycloakAuthzRequestDto, PermissionDto } from 'src/auth/dto';
import { Request, Response } from 'express';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class ResourceGuard implements CanActivate {
  private readonly logger = new Logger(ResourceGuard.name);
  private readonly reflector = new Reflector();
  constructor(private keycloakConnect: KeycloakService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // get context
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<
      Request & {
        auth?: { payload?: Record<string, unknown> };
        scopes?: string[];
      }
    >();
    const response = ctx.getResponse<Response>();

    // if is not an HTTP request ignore this guard
    if (!request) {
      return true;
    }

    const userId = request?.auth?.payload?.sub;
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    // if no user and set to public bypass
    if (!userId && isPublic) return true;

    // get resource meta
    const metaResource =
      this.reflector.get<string>(META_RESOURCE, context.getHandler()) ||
      this.reflector.get<string>(META_RESOURCE, context.getClass());

    // get parameter if exists
    const resource = Object.values(request.params)
      ? `${metaResource}:${Object.values(request.params)[0]}`
      : metaResource;

    // get explicit scopes
    const explicitScopes =
      this.reflector.get<string[]>(META_SCOPES, context.getHandler()) ?? [];

    // get conditional scopes
    const conditionalScopes = this.reflector.get<ConditionalScopeFn>(
      META_CONDITIONAL_SCOPES,
      context.getHandler(),
    );
    const conditionalScopesResult = conditionalScopes
      ? conditionalScopes(request, request.auth?.token || '')
      : [];

    // combine scopes
    const scopes = [...explicitScopes, ...conditionalScopesResult];

    // Attach resolved scopes
    request.scopes = [...scopes];

    // build permissions object
    const permission: PermissionDto = {
      id: resource,
      scopes: scopes,
    };
    const authzRequest: KeycloakAuthzRequestDto = {
      permissions: [permission],
      response_mode: 'permissions', // can be 'decision'
    };

    const isAllowed = await this.keycloakConnect.checkPermission(
      authzRequest,
      request,
    );

    if (response.headersSent) {
      throw UnauthorizedException(`Invalid scopes`);
    }
    return isAllowed;
  }
}

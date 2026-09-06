import { ExecutionContext } from '@nestjs/common';
import { ResourceGuard } from './resource.guard';
import { KeycloakService } from 'src/auth/keycloak/keycloak.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { META_RESOURCE } from '../decorators/resource.decorator';
import {
  META_CONDITIONAL_SCOPES,
  META_SCOPES,
} from '../decorators/scopes.decorator';

type Meta = {
  isPublic?: boolean;
  resource?: string;
  scopes?: string[];
  conditionalScopes?: (request: unknown, token: string) => string[];
};

describe('ResourceGuard', () => {
  let guard: ResourceGuard;
  const keycloakMock = { checkPermission: jest.fn() };

  const buildContext = (request: unknown, meta: Meta = {}, response = {}) => {
    const handler = () => undefined;
    const cls = class {};
    const ctx = {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
      getHandler: () => handler,
      getClass: () => cls,
    } as unknown as ExecutionContext;

    const reflector = (
      guard as unknown as {
        reflector: {
          get: (key: string, target: unknown) => unknown;
          getAllAndOverride: (key: string, targets: unknown[]) => unknown;
        };
      }
    ).reflector;

    jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
      if (key === IS_PUBLIC_KEY) return meta.isPublic;
      return undefined;
    });
    jest.spyOn(reflector, 'get').mockImplementation((key, target) => {
      if (key === META_RESOURCE && target === handler) return meta.resource;
      if (key === META_SCOPES && target === handler) return meta.scopes;
      if (key === META_CONDITIONAL_SCOPES && target === handler)
        return meta.conditionalScopes;
      return undefined;
    });

    return ctx;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    guard = new ResourceGuard(keycloakMock as unknown as KeycloakService);
  });

  it('bypasses non-HTTP contexts without consulting Keycloak', async () => {
    const ctx = buildContext(null);

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(keycloakMock.checkPermission).not.toHaveBeenCalled();
  });

  it('bypasses public routes when there is no authenticated user', async () => {
    const request = { params: {}, auth: undefined };
    const ctx = buildContext(request, { isPublic: true });

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(keycloakMock.checkPermission).not.toHaveBeenCalled();
  });

  it('allows access when Keycloak grants the permission', async () => {
    keycloakMock.checkPermission.mockResolvedValue(true);
    const request = {
      params: { projectId: 'p-1' },
      auth: { payload: { sub: 'user-1' }, token: 'tok' },
    };
    const ctx = buildContext(request, {
      resource: 'project',
      scopes: ['analysis'],
    });

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('denies access when Keycloak rejects the permission', async () => {
    keycloakMock.checkPermission.mockResolvedValue(false);
    const request = {
      params: { projectId: 'p-1' },
      auth: { payload: { sub: 'user-1' }, token: 'tok' },
    };
    const ctx = buildContext(request, {
      resource: 'project',
      scopes: ['analysis'],
    });

    await expect(guard.canActivate(ctx)).resolves.toBe(false);
  });

  it('builds the permission as resource:<first route param> with explicit scopes', async () => {
    keycloakMock.checkPermission.mockResolvedValue(true);
    const request = {
      params: { projectId: 'p-42' },
      auth: { payload: { sub: 'user-1' }, token: 'tok' },
    };
    const ctx = buildContext(request, {
      resource: 'project',
      scopes: ['analysis', 'read'],
    });

    await guard.canActivate(ctx);

    expect(keycloakMock.checkPermission).toHaveBeenCalledWith(
      {
        permissions: [{ id: 'project:p-42', scopes: ['analysis', 'read'] }],
        response_mode: 'permissions',
      },
      request,
    );
  });

  it('merges conditional scopes resolved from the request and token', async () => {
    keycloakMock.checkPermission.mockResolvedValue(true);
    const conditionalScopes = jest.fn().mockReturnValue(['write']);
    const request = {
      params: { projectId: 'p-1' },
      auth: { payload: { sub: 'user-1' }, token: 'tok' },
    };
    const ctx = buildContext(request, {
      resource: 'project',
      scopes: ['read'],
      conditionalScopes,
    });

    await guard.canActivate(ctx);

    expect(conditionalScopes).toHaveBeenCalledWith(request, 'tok');
    expect(keycloakMock.checkPermission).toHaveBeenCalledWith(
      expect.objectContaining({
        permissions: [{ id: 'project:p-1', scopes: ['read', 'write'] }],
      }),
      request,
    );
  });

  it('attaches the resolved scopes to the request', async () => {
    keycloakMock.checkPermission.mockResolvedValue(true);
    const request: {
      params: Record<string, string>;
      auth: unknown;
      scopes?: string[];
    } = {
      params: { projectId: 'p-1' },
      auth: { payload: { sub: 'user-1' }, token: 'tok' },
    };
    const ctx = buildContext(request, {
      resource: 'project',
      scopes: ['analysis'],
    });

    await guard.canActivate(ctx);

    expect(request.scopes).toEqual(['analysis']);
  });

  it('propagates Keycloak errors (e.g. missing token)', async () => {
    keycloakMock.checkPermission.mockRejectedValue(
      new Error('Authorisation token not found'),
    );
    const request = {
      params: { projectId: 'p-1' },
      auth: { payload: { sub: 'user-1' }, token: '' },
    };
    const ctx = buildContext(request, {
      resource: 'project',
      scopes: ['analysis'],
    });

    await expect(guard.canActivate(ctx)).rejects.toThrow(
      'Authorisation token not found',
    );
  });

  it('throws when the response was already sent', async () => {
    keycloakMock.checkPermission.mockResolvedValue(true);
    const request = {
      params: { projectId: 'p-1' },
      auth: { payload: { sub: 'user-1' }, token: 'tok' },
    };
    const ctx = buildContext(
      request,
      { resource: 'project', scopes: ['analysis'] },
      { headersSent: true },
    );

    // the middleware library's UnauthorizedException is a factory returning a
    // plain error object, so match on shape rather than Error instance
    await expect(guard.canActivate(ctx)).rejects.toMatchObject({
      message: 'Invalid scopes',
    });
  });
});

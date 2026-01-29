import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Request } from 'express';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly requiredRoles: string[]) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const payload = request?.auth?.payload;

    if (!payload) {
      throw new ForbiddenException('No token payload found');
    }

    const realmAccess = payload['realm_access'] as
      | { roles?: string[] }
      | undefined;
    const userRoles = realmAccess?.roles || [];

    const hasRole = this.requiredRoles.some((role) => userRoles.includes(role));

    if (!hasRole) {
      throw new ForbiddenException('Insufficient role permissions');
    }

    return true;
  }
}

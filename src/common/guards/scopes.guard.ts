import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Observable } from 'rxjs';
import { requiredScopes } from 'express-oauth2-jwt-bearer';
import { UnauthorizedException } from '@epsilon-data/epsilon-api-middleware';
import { Request, Response } from 'express';

@Injectable()
export class ScopesGuard implements CanActivate {
  constructor(private readonly scopes: string | string[] = '') {}

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const ctx = context.switchToHttp();

    let err = undefined;
    const resp = ctx.getResponse<Response>();
    requiredScopes(this.scopes)(ctx.getRequest<Request>(), resp, (res) => {
      err = res;
    });

    if (resp.headersSent) {
      throw UnauthorizedException(`Invalid scopes`);
    }

    if (err) {
      throw new Error(err);
    }

    return true;
  }
}

import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Observable } from 'rxjs';
import { requiredScopes } from 'express-oauth2-jwt-bearer';
import { UnauthorizedException } from 'src/middleware/exceptions/TokenHandlerException';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly scopes: string | string[] = '') {}

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const ctx = context.switchToHttp();

    let err = undefined;
    const resp = ctx.getResponse();
    requiredScopes(this.scopes)(ctx.getRequest(), resp, (res) => {
      err = res;
    });

    if (resp.headersSent) {
      throw UnauthorizedException(`Invalid scopes`);
    }

    if (err) {
      throw err;
    }

    return true;
  }
}

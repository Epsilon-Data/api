import { Injectable } from '@nestjs/common';
import { Request } from 'express';

@Injectable()
export class UserService {
  async admin(request: Request) {
    const access: { account?: { roles: string[] } } =
      request.auth.payload.resource_access;
    if (access && access.account && access.account.roles) {
      return access.account.roles.indexOf('admin') !== -1;
    }
    return false;
  }
}

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
@Injectable()
export class UserService {
  constructor(private readonly configService: ConfigService) {}
  async admin(request: Request) {
    const access: { account?: { roles: string[] } } =
      request.auth.payload.resource_access;
    if (access && access.account && access.account.roles) {
      return access.account.roles.indexOf('admin') !== -1;
    }
    return false;
  }

  async getUserFullName(id: string) {
    // TODO: get user full name from endpoint
    // const res = await fetch(
    //   'http://localhost:8080/admin/realms/EPSILON' + `/users/${id}`,
    //   {
    //     method: 'GET',
    //     headers: {
    //       Authorization: 'Bearer ' + token,
    //       'Content-Type': 'application/x-www-form-urlencoded',
    //     },
    //   },
    // );

    // const text = await res.text();
    // console.log(text);
    return id;
  }
}

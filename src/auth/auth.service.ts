import { Injectable, UnauthorizedException } from '@nestjs/common';

@Injectable()
export class AuthService {
  constructor() {}

  async signIn(username: string, pass: string): Promise<any> {
    if (username && pass) {
      throw new UnauthorizedException();
    }
    const user = { username, pass };
    // TODO: Generate a JWT and return it here
    // instead of the user object
    return user;
  }
}

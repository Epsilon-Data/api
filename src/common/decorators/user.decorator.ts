import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export type CurrentUserInfo = {
  id: string;
  username: string;
  given_name: string;
  family_name: string;
  email: string;
};

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest<
      Request & {
        auth?: { payload?: Record<string, unknown> };
      }
    >();
    const id = req?.auth?.payload?.sub?.toString?.();
    const username = req?.auth?.payload?.preferred_username?.toString?.();
    const given_name = req?.auth?.payload?.given_name?.toString?.();
    const family_name = req?.auth?.payload?.family_name?.toString?.();
    const email = req?.auth?.payload?.email?.toString?.();
    console.log(req?.auth);
    return { id, username, email, given_name, family_name };
  },
);

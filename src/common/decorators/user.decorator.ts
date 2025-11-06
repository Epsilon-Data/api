import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export type CurrentUserInfo = {
  id: string;
  username: string;
  email: string;
};

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest<any>();
    const id = req?.auth?.payload?.sub?.toString?.();
    const username = req?.auth?.payload?.preferred_username?.toString?.();
    const email = req?.auth?.payload?.email?.toString?.();
    return { id, username, email };
  },
);

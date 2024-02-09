import { AuthExceptionFilter } from './auth.filter';

describe('AuthFilter', () => {
  it('should be defined', () => {
    expect(new AuthExceptionFilter()).toBeDefined();
  });
});

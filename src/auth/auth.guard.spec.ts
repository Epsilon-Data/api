import { ScopesGuard } from './scopes.guard';

describe('AuthGuard', () => {
  it('should be defined', () => {
    expect(new ScopesGuard()).toBeDefined();
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { DatabaseSourceGateway } from './database_source.gateway';

describe('DatabaseSourceGateway', () => {
  let gateway: DatabaseSourceGateway;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DatabaseSourceGateway],
    }).compile();

    gateway = module.get<DatabaseSourceGateway>(DatabaseSourceGateway);
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });
});

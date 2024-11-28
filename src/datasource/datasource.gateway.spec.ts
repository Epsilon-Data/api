import { Test, TestingModule } from '@nestjs/testing';
import { DatasourceGateway } from './datasource.gateway';

describe('DatabaseSourceGateway', () => {
  let gateway: DatasourceGateway;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DatasourceGateway],
    }).compile();

    gateway = module.get<DatasourceGateway>(DatasourceGateway);
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });
});

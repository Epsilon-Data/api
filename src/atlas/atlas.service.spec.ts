import { Test, TestingModule } from '@nestjs/testing';
import { AtlasService } from './atlas.service';

describe('AtlasService', () => {
  let service: AtlasService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AtlasService],
    }).compile();

    service = module.get<AtlasService>(AtlasService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

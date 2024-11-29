import { Test, TestingModule } from '@nestjs/testing';
import { StandardAnalysisService } from './standard_analysis.service';

describe('AnalysisService', () => {
  let service: StandardAnalysisService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [StandardAnalysisService],
    }).compile();

    service = module.get<StandardAnalysisService>(StandardAnalysisService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

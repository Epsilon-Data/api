import { Controller, Get } from '@nestjs/common';
import { ProviderRegistryService } from './provider-registry.service';
import { ModelsResponse } from './types';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('models')
@Controller('models')
export class LlmController {
  constructor(private readonly providerRegistry: ProviderRegistryService) {}

  @Get()
  @ApiOperation({
    summary: 'List available LLM models',
    description:
      'Get all available LLM models across all providers with their capabilities.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of models retrieved successfully',
    type: ModelsResponse,
  })
  getModels(): ModelsResponse {
    return this.providerRegistry.listModels();
  }
}

import { ApiProperty } from '@nestjs/swagger';

export interface ModelMetadata {
  id: string; // e.g., "gpt-5-mini-2025-08-07"
  displayName: string; // e.g., "GPT-5 Mini"
  provider: string; // e.g., "openai"
  capabilities: string[]; // e.g., ["graph", "csv-analysis"]
}

export class ModelInfo {
  @ApiProperty({
    description: 'Full model identifier',
    example: 'openai:gpt-4',
  })
  id: string;

  @ApiProperty({
    description: 'Human-readable model name',
    example: 'GPT-4',
  })
  displayName: string;

  @ApiProperty({
    description: 'Provider name',
    example: 'openai',
  })
  provider: string;

  @ApiProperty({
    description: 'Model capabilities',
    type: [String],
    example: ['graph', 'csv-analysis'],
  })
  capabilities: string[];
}

export class ModelsResponse {
  @ApiProperty({
    description: 'Available LLM models',
    type: [ModelInfo],
  })
  models: ModelInfo[];

  @ApiProperty({
    description: 'Default model ID',
    example: 'openai:gpt-4',
  })
  defaultModel: string;
}

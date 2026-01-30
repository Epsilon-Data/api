import { ModelMetadata } from '../types';

export type SchemaType = 'graph' | 'csv-analysis';

export interface LlmParams {
  headings: string[];
  context?: string;
  prompt: string;
  structured: string;
  schemaType?: SchemaType;
  modelId: string;
  file?: {
    base64: string;
    filename: string;
  };
}

export interface LlmProvider {
  name: string;
  call<T = unknown>(params: LlmParams): Promise<T>;
  listModels(): Promise<ModelMetadata[]>;
}

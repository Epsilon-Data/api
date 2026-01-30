import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OpenAI } from 'openai';
import { z } from 'zod';
import { readFile } from 'node:fs/promises';
import { LlmParams, LlmProvider, SchemaType } from './base.provider';
import { ModelMetadata } from '../types';
import { buildPrompt } from './prompt-builder';
import { zodTextFormat } from 'openai/helpers/zod';

const graphSchema = z.object({
  nodes: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      depth: z.number(),
    }),
  ),
  edges: z
    .array(
      z.object({
        source: z.string(),
        target: z.string(),
      }),
    )
    .optional()
    .default([]),
});

const csvAnalysisSchema = z.object({
  columns: z.array(
    z.object({
      name: z.string(),
      type: z.enum(['metric', 'ordinal', 'nominal', 'unknown']),
    }),
  ),
  analysis: z.array(
    z.object({
      column: z.string(),
      statistics: z.array(
        z.object({
          name: z.string(),
          value: z.string(),
          applicable: z.boolean(),
        }),
      ),
    }),
  ),
  suggestions: z.array(z.string()),
});

@Injectable()
export class OpenaiProvider implements LlmProvider {
  readonly name = 'openai';
  private readonly openai: OpenAI;
  private readonly logger = new Logger(OpenaiProvider.name);

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('openai.apiKey');
    if (!apiKey) {
      throw new InternalServerErrorException(
        'OPENAI_API_KEY is required but not configured. Please check your environment variables.',
      );
    }

    this.openai = new OpenAI({ apiKey });
  }

  async call<T = unknown>(params: LlmParams): Promise<T> {
    const {
      headings,
      context,
      prompt,
      structured,
      file,
      modelId,
      schemaType = 'graph',
    } = params;
    const systemPrompt = await readFile(prompt, 'utf8');
    const outputGuard = await readFile(structured, 'utf8');

    const userPrompt = buildPrompt({
      headings: headings ?? [],
      context,
      encodedFile: file?.base64,
    });

    // Select appropriate schema and format name based on schema type
    const { schema, formatName } = this.getSchemaConfig(schemaType);

    const res = await this.openai.responses.parse({
      model: modelId,
      input: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
        { role: 'system', content: outputGuard },
      ],
      text: {
        format: zodTextFormat(schema, formatName),
      },
    });

    return res.output_parsed as T;
  }

  async listModels(): Promise<ModelMetadata[]> {
    try {
      const whitelist = this.configService.get<string[]>(
        'modelWhitelist.openai',
        [],
      );
      const modelsList = await this.openai.models.list();
      const models: ModelMetadata[] = [];

      for await (const model of modelsList) {
        // Only include whitelisted models
        if (whitelist.includes(model.id)) {
          models.push({
            id: model.id,
            displayName: this.formatDisplayName(model.id),
            provider: this.name,
            capabilities: ['graph', 'csv-analysis'],
          });
        }
      }

      return models;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new InternalServerErrorException(
        `Failed to fetch OpenAI models: ${errorMessage}`,
      );
    }
  }

  private formatDisplayName(modelId: string): string {
    // Convert model ID to friendly display name
    // e.g., "gpt-5-mini-2025-08-07" -> "GPT-5 Mini"
    const parts = modelId.split('-');
    if (parts[0] === 'gpt' && parts[1] === '5' && parts[2]) {
      const variant = parts[2]; // mini, turbo, etc.
      return `GPT-5 ${variant.charAt(0).toUpperCase() + variant.slice(1)}`;
    }
    return modelId; // fallback to ID if pattern doesn't match
  }

  private getSchemaConfig(schemaType: SchemaType): {
    schema: z.ZodType;
    formatName: string;
  } {
    switch (schemaType) {
      case 'graph':
        return { schema: graphSchema, formatName: 'graph' };
      case 'csv-analysis':
        return { schema: csvAnalysisSchema, formatName: 'csv_analysis' };
      default:
        throw new InternalServerErrorException(
          'Unsupported schema type: ' + String(schemaType),
        );
    }
  }
}

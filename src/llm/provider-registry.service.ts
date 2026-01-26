import {
  Injectable,
  InternalServerErrorException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LlmProvider } from './providers/base.provider';
import { ModelMetadata, ModelInfo, ModelsResponse } from './types';

@Injectable()
export class ProviderRegistryService {
  private readonly providers = new Map<string, LlmProvider>();
  private readonly modelMetadata = new Map<string, ModelMetadata>();
  private defaultModelId: string = '';

  constructor(private readonly configService: ConfigService) {}

  /**
   * Register a provider (models will be discovered separately)
   */
  registerProvider(provider: LlmProvider): void {
    this.providers.set(provider.name, provider);
  }

  /**
   * Discover models from all registered providers
   */
  async discoverModels(): Promise<void> {
    this.modelMetadata.clear();
    const discoveryErrors: string[] = [];

    for (const [providerName, provider] of this.providers.entries()) {
      try {
        const models = await provider.listModels();

        for (const model of models) {
          const fullId = `${providerName}:${model.id}`;
          this.modelMetadata.set(fullId, {
            ...model,
            provider: providerName,
          });
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        discoveryErrors.push(`${providerName}: ${errorMessage}`);
        console.warn(
          `Failed to discover models for provider ${providerName}:`,
          errorMessage,
        );
      }
    }

    // Throw error if all providers failed
    if (this.modelMetadata.size === 0) {
      throw new InternalServerErrorException(
        `No models available: all providers failed to initialize.\n${discoveryErrors.join('\n')}`,
      );
    }

    // Set default model ID
    const defaultProvider =
      this.configService.get<string>('defaultProvider') || 'openai';

    // Find first model from default provider, or any provider if not available
    const defaultProviderModels = Array.from(
      this.modelMetadata.entries(),
    ).filter(([id]) => id.startsWith(`${defaultProvider}:`));

    if (defaultProviderModels.length > 0) {
      this.defaultModelId = defaultProviderModels[0][0];
    } else if (this.modelMetadata.size > 0) {
      // Fallback to first available model from any provider
      this.defaultModelId = Array.from(this.modelMetadata.keys())[0];
      console.warn(
        `Default provider "${defaultProvider}" has no models, using fallback: ${this.defaultModelId}`,
      );
    }
  }

  /**
   * Get provider instance by model ID
   * @param modelId - Full model identifier (e.g., "openai:gpt-5-mini-2025-08-07")
   * @returns Provider instance
   */
  getProvider(modelId?: string): LlmProvider {
    const id = modelId || this.defaultModelId;
    const [providerName] = id.split(':');

    const provider = this.providers.get(providerName);
    if (!provider) {
      throw new BadRequestException(
        `Provider "${providerName}" not found. Available providers: ${Array.from(this.providers.keys()).join(', ')}`,
      );
    }

    // Verify model exists - this is user input validation, so use BadRequestException
    if (!this.modelMetadata.has(id)) {
      const availableModels = Array.from(this.modelMetadata.keys()).join(', ');
      throw new BadRequestException(
        `Model "${id}" not found. Available models: ${availableModels}`,
      );
    }

    return provider;
  }

  /**
   * Get model metadata by ID
   */
  getModelMetadata(modelId: string): ModelMetadata | undefined {
    return this.modelMetadata.get(modelId);
  }

  /**
   * List all available models
   */
  listModels(): ModelsResponse {
    const models: ModelInfo[] = Array.from(this.modelMetadata.entries()).map(
      ([id, metadata]) => ({
        id,
        displayName: metadata.displayName,
        provider: metadata.provider,
        capabilities: metadata.capabilities,
      }),
    );

    return {
      models,
      defaultModel: this.defaultModelId,
    };
  }

  /**
   * Get the default model ID
   */
  getDefaultModelId(): string {
    return this.defaultModelId;
  }
}

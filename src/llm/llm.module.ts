import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LlmService } from './llm.service';
import { LlmController } from './llm.controller';
import { OpenaiProvider } from './providers/openai.provider';
import { ProviderRegistryService } from './provider-registry.service';

@Module({
  controllers: [LlmController],
  providers: [LlmService, OpenaiProvider, ProviderRegistryService],
  exports: [LlmService, ProviderRegistryService],
})
export class LlmModule implements OnModuleInit {
  constructor(
    private readonly providerRegistry: ProviderRegistryService,
    private readonly openaiProvider: OpenaiProvider,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit() {
    // Register providers
    this.providerRegistry.registerProvider(this.openaiProvider);

    // Discover models from all registered providers
    await this.providerRegistry.discoverModels();
  }
}

import {
  Injectable,
  InternalServerErrorException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ProviderRegistryService } from './provider-registry.service';
import * as path from 'path';
import fs from 'fs/promises';
import { GraphPayload } from '../graph/types';
import pdfParse from 'pdf-parse';
import type { Result as PdfParseResult } from 'pdf-parse';

@Injectable()
export class LlmService {
  private promptContent: string;
  private structuredOutputContent: string;
  private readonly logger = new Logger('LlmService');

  constructor(private readonly providerRegistry: ProviderRegistryService) {
    this.loadPrompts().catch((err) => {
      const e: unknown = err;
      if (e instanceof Error) {
        console.error(
          'Critical: Failed to load LLM prompts during LlmService initialization.',
          e.message,
        );
      } else {
        console.error(
          'Critical: Failed to load LLM prompts during LlmService initialization.',
          JSON.stringify(e),
        );
      }
    });
  }

  private async loadPrompts() {
    const baseDir = path.resolve(__dirname, '..', '..', 'src', 'prompts');
    this.promptContent = await fs.readFile(
      path.join(baseDir, 'prompt.md'),
      'utf8',
    );
    this.structuredOutputContent = await fs.readFile(
      path.join(baseDir, 'structured_output.md'),
      'utf8',
    );
  }

  private truncateText(text: string, maxChars: number): string {
    return text.length > maxChars ? text.slice(0, maxChars) : text;
  }

  async analyseFile(
    filename: string,
    filePath: string,
    mimetype: string,
    contextInput?: string,
    modelId?: string,
  ): Promise<GraphPayload> {
    if (!this.promptContent || !this.structuredOutputContent) {
      throw new InternalServerErrorException(
        'LLM prompts are not loaded. Service cannot proceed.',
      );
    }

    let extractedText: string = '';

    if (filePath) {
      // Extract file content
      try {
        const buffer = await fs.readFile(filePath);
        if (mimetype === 'application/pdf') {
          // disable lint because pdf-parse has poor types and its not really recognized
          /* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
          const data: PdfParseResult = await pdfParse(buffer);
          extractedText = data.text as string;
          /* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
        }
        // TODO: Add handlers for other mimetypes (e.g., 'application/json', 'text/plain')

        // Truncate if text is very long (e.g. > 50k characters, adjust as needed for token limits)
        // TODO: limit should ideally be configurable and related to the LLM's context window.
        extractedText = this.truncateText(extractedText, 50000);
      } catch (err: unknown) {
        let msg = 'Unknown error';
        if (err instanceof Error) {
          msg = err.message;
          console.error(
            `Failed to extract text from ${filename} (mimetype: ${mimetype}):`,
            msg,
          );
        } else {
          console.error(
            `Failed to extract text from ${filename} (mimetype: ${mimetype}):`,
            JSON.stringify(err),
          );
        }
        throw new InternalServerErrorException(
          `Failed to process file content: ${msg}`,
        );
      }
    }

    // Append additional context with high precedence
    if (contextInput?.trim()) {
      extractedText = `${extractedText}\n\n---\n\nIMPORTANT ADDITIONAL INSTRUCTIONS:\nThe user has provided the following specific context that should take precedence over the file content above:\n\n${contextInput}\n\nPlease prioritize this additional context when analyzing and categorizing the data.`;
    }

    if (!extractedText.trim()) {
      console.warn(
        `No textual content derived for ${filename}. Proceeding with potentially empty content to LLM.`,
      );
      throw new BadRequestException(
        'No content could be derived from the file or provided context.',
      );
    }

    // These paths are now used by providers. Ensure they are correct.
    const promptPath = path.join(
      path.resolve(__dirname, '..', '..', 'src', 'prompts'),
      'prompt.md',
    );
    const structuredPath = path.join(
      path.resolve(__dirname, '..', '..', 'src', 'prompts'),
      'structured_output.md',
    );

    // Get provider from registry (uses default if modelId not provided)
    const provider = this.providerRegistry.getProvider(modelId);

    // Extract actual model ID from full identifier (e.g., "openai:gpt-5-mini" -> "gpt-5-mini")
    const actualModelId = modelId
      ? modelId.split(':')[1]
      : this.providerRegistry.getDefaultModelId().split(':')[1];

    const result: GraphPayload = await provider.call({
      headings: [],
      context: extractedText,
      prompt: promptPath,
      structured: structuredPath,
      schemaType: 'graph',
      modelId: actualModelId,
    });

    // this.logger.log(
    //   `LLM result: ${JSON.stringify(result)}, type: ${typeof result}`,
    // );

    return result;
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { LlmService } from './llm.service';
import { ProviderRegistryService } from './provider-registry.service';
import {
  InternalServerErrorException,
  BadRequestException,
} from '@nestjs/common';
import fs from 'fs/promises';
import pdfParse from 'pdf-parse';
import { GraphPayload } from '../graph/types';
import { LlmProvider } from './providers/base.provider';

jest.mock('fs/promises');
jest.mock('pdf-parse');

describe('LlmService', () => {
  let service: LlmService;
  let providerRegistry: jest.Mocked<ProviderRegistryService>;
  let fsMock: jest.Mocked<typeof fs>;

  const mockProvider = {
    call: jest.fn(),
    name: 'openai',
    listModels: jest.fn(),
  };

  beforeEach(async () => {
    fsMock = fs as jest.Mocked<typeof fs>;

    fsMock.readFile.mockImplementation((filePath: string) => {
      if (filePath.includes('prompt.md')) {
        return Promise.resolve('Mock prompt content');
      }
      if (filePath.includes('structured_output.md')) {
        return Promise.resolve('Mock structured output content');
      }
      return Promise.resolve(Buffer.from('mock file content'));
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LlmService,
        {
          provide: ProviderRegistryService,
          useValue: {
            getProvider: jest.fn(),
            getDefaultModelId: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<LlmService>(LlmService);
    providerRegistry = module.get(ProviderRegistryService);

    await new Promise((resolve) => setTimeout(resolve, 20));

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('loadPrompts', () => {
    it('should load prompt files during initialization', async () => {
      const localFsMock = fs as jest.Mocked<typeof fs>;
      let promptLoaded = false;
      let structuredLoaded = false;

      localFsMock.readFile.mockImplementation((filePath: string) => {
        if (filePath.includes('prompt.md')) {
          promptLoaded = true;
          return Promise.resolve('Mock prompt content');
        }
        if (filePath.includes('structured_output.md')) {
          structuredLoaded = true;
          return Promise.resolve('Mock structured output content');
        }
        return Promise.resolve(Buffer.from('mock file content'));
      });

      await Test.createTestingModule({
        providers: [
          LlmService,
          {
            provide: ProviderRegistryService,
            useValue: {
              getProvider: jest.fn(),
              getDefaultModelId: jest.fn(),
            },
          },
        ],
      }).compile();

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(promptLoaded).toBe(true);
      expect(structuredLoaded).toBe(true);
    });

    it('should handle errors during prompt loading', async () => {
      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      fsMock.readFile.mockRejectedValue(new Error('File not found'));

      await Test.createTestingModule({
        providers: [
          LlmService,
          {
            provide: ProviderRegistryService,
            useValue: {
              getProvider: jest.fn(),
              getDefaultModelId: jest.fn(),
            },
          },
        ],
      }).compile();

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to load LLM prompts'),
        expect.any(String),
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe('analyseFile', () => {
    const filename = 'test.pdf';
    const filePath = '/path/to/test.pdf';
    const mimetype = 'application/pdf';

    beforeEach(() => {
      providerRegistry.getProvider.mockReturnValue(mockProvider as LlmProvider);
      providerRegistry.getDefaultModelId.mockReturnValue('openai:gpt-4');
    });

    it('should extract text from PDF file and call provider', async () => {
      const mockPdfText = 'Extracted PDF content';
      const mockGraphPayload: GraphPayload = {
        nodes: [],
        edges: [],
      };

      pdfParse.mockResolvedValue({ text: mockPdfText });
      fsMock.readFile.mockResolvedValue(Buffer.from('pdf content'));
      mockProvider.call.mockResolvedValue(mockGraphPayload);

      const result = await service.analyseFile(filename, filePath, mimetype);

      expect(fsMock.readFile).toHaveBeenCalledWith(filePath);
      expect(pdfParse).toHaveBeenCalled();
      expect(mockProvider.call).toHaveBeenCalledWith(
        expect.objectContaining({
          context: mockPdfText,
          schemaType: 'graph',
        }),
      );
      expect(result).toEqual(mockGraphPayload);
    });

    it('should append additional context with high precedence', async () => {
      const mockPdfText = 'Extracted PDF content';
      const contextInput = 'Additional user context';
      const mockGraphPayload: GraphPayload = {
        nodes: [],
        edges: [],
      };

      (pdfParse as any).mockResolvedValue({ text: mockPdfText });
      fsMock.readFile.mockResolvedValue(Buffer.from('pdf content'));
      mockProvider.call.mockResolvedValue(mockGraphPayload);

      await service.analyseFile(filename, filePath, mimetype, contextInput);

      expect(mockProvider.call).toHaveBeenCalledWith(
        expect.objectContaining({
          context: expect.stringContaining('IMPORTANT ADDITIONAL INSTRUCTIONS'),
        }),
      );
      expect(mockProvider.call).toHaveBeenCalledWith(
        expect.objectContaining({
          context: expect.stringContaining(contextInput),
        }),
      );
    });

    it('should truncate very long text to 50000 characters', async () => {
      const longText = 'a'.repeat(60000);
      const mockGraphPayload: GraphPayload = {
        nodes: [],
        edges: [],
      };

      (pdfParse as any).mockResolvedValue({ text: longText });
      fsMock.readFile.mockResolvedValue(Buffer.from('pdf content'));
      mockProvider.call.mockResolvedValue(mockGraphPayload);

      await service.analyseFile(filename, filePath, mimetype);

      expect(mockProvider.call).toHaveBeenCalledWith(
        expect.objectContaining({
          context: expect.stringMatching(/^a{50000}$/),
        }),
      );
    });

    it('should use custom modelId when provided', async () => {
      const mockPdfText = 'Extracted PDF content';
      const mockGraphPayload: GraphPayload = {
        nodes: [],
        edges: [],
      };
      const customModelId = 'anthropic:claude-3';

      (pdfParse as any).mockResolvedValue({ text: mockPdfText });
      fsMock.readFile.mockResolvedValue(Buffer.from('pdf content'));
      mockProvider.call.mockResolvedValue(mockGraphPayload);

      await service.analyseFile(
        filename,
        filePath,
        mimetype,
        undefined,
        customModelId,
      );

      expect(providerRegistry.getProvider).toHaveBeenCalledWith(customModelId);
      expect(mockProvider.call).toHaveBeenCalledWith(
        expect.objectContaining({
          modelId: 'claude-3',
        }),
      );
    });

    it('should throw error when file extraction fails', async () => {
      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      fsMock.readFile.mockRejectedValue(new Error('File read error'));

      await expect(
        service.analyseFile(filename, filePath, mimetype),
      ).rejects.toThrow(InternalServerErrorException);
      await expect(
        service.analyseFile(filename, filePath, mimetype),
      ).rejects.toThrow('Failed to process file content');

      consoleErrorSpy.mockRestore();
    });

    it('should throw error when no content is extracted', async () => {
      const consoleWarnSpy = jest
        .spyOn(console, 'warn')
        .mockImplementation(() => {});

      (service as any).promptContent = 'Mock prompt content';
      (service as any).structuredOutputContent =
        'Mock structured output content';

      (pdfParse as any).mockResolvedValue({ text: '' });
      fsMock.readFile.mockResolvedValue(Buffer.from('pdf content'));

      await expect(
        service.analyseFile(filename, filePath, mimetype),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.analyseFile(filename, filePath, mimetype),
      ).rejects.toThrow('No content could be derived from the file');

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('No textual content derived'),
      );

      consoleWarnSpy.mockRestore();
    });

    it('should handle pdf-parse errors gracefully', async () => {
      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      (pdfParse as any).mockRejectedValue(new Error('PDF parsing failed'));
      fsMock.readFile.mockResolvedValue(Buffer.from('pdf content'));

      await expect(
        service.analyseFile(filename, filePath, mimetype),
      ).rejects.toThrow(InternalServerErrorException);

      consoleErrorSpy.mockRestore();
    });

    it('should pass correct prompt paths to provider', async () => {
      const mockPdfText = 'Extracted PDF content';
      const mockGraphPayload: GraphPayload = {
        nodes: [],
        edges: [],
      };

      (pdfParse as any).mockResolvedValue({ text: mockPdfText });
      fsMock.readFile.mockResolvedValue(Buffer.from('pdf content'));
      mockProvider.call.mockResolvedValue(mockGraphPayload);

      await service.analyseFile(filename, filePath, mimetype);

      expect(mockProvider.call).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining('prompt.md'),
          structured: expect.stringContaining('structured_output.md'),
        }),
      );
    });
  });
});

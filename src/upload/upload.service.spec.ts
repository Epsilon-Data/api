/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { UploadService } from './upload.service';
import { JobsService } from '../jobs/jobs.service';
import { GraphService } from '../graph/graph.service';
import { BadRequestException, Logger } from '@nestjs/common';
import { writeFile, unlink } from 'node:fs/promises';

jest.mock('node:fs/promises');
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-job-id-123'),
}));

describe('UploadService', () => {
  let service: UploadService;
  let jobsService: jest.Mocked<JobsService>;
  let graphService: jest.Mocked<GraphService>;

  const writeFileMock = writeFile as jest.MockedFunction<typeof writeFile>;
  const unlinkMock = unlink as jest.MockedFunction<typeof unlink>;

  beforeAll(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UploadService,
        {
          provide: JobsService,
          useValue: {
            enqueue: jest.fn(),
            status: jest.fn(),
          },
        },
        {
          provide: GraphService,
          useValue: {
            generateGraphFromFile: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<UploadService>(UploadService);
    jobsService = module.get(JobsService);
    graphService = module.get(GraphService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('processFile', () => {
    it('should enqueue job with file path when path is provided', () => {
      const file = {
        path: '/uploads/test.pdf',
        originalname: 'test.pdf',
        mimetype: 'application/pdf',
        buffer: Buffer.from(''),
      } as Express.Multer.File;

      const context = 'Test context';
      const modelId = 'openai:gpt-4';

      const jobId = service.processFile(file, context, modelId);

      expect(jobId).toBe('test-job-id-123');
      expect(jobsService.enqueue).toHaveBeenCalledTimes(1);
      expect(jobsService.enqueue).toHaveBeenCalledWith(
        'test-job-id-123',
        expect.any(Function),
      );
    });

    it('should enqueue job without context and modelId', () => {
      const file = {
        path: '/uploads/test.pdf',
        originalname: 'test.pdf',
        mimetype: 'application/pdf',
        buffer: Buffer.from('test content'),
      } as Express.Multer.File;

      const jobId = service.processFile(file);

      expect(jobId).toBe('test-job-id-123');
      expect(jobsService.enqueue).toHaveBeenCalledTimes(1);
    });

    it('should create temp file from buffer when path is not provided', async () => {
      const buffer = Buffer.from('test content');
      const file = {
        path: undefined,
        originalname: 'test.pdf',
        mimetype: 'application/pdf',
        buffer,
      } as unknown as Express.Multer.File;

      writeFileMock.mockResolvedValue(undefined);
      unlinkMock.mockResolvedValue(undefined);
      graphService.generateGraphFromFile.mockResolvedValue({
        nodes: [],
        edges: [],
      });

      service.processFile(file);

      expect(jobsService.enqueue).toHaveBeenCalledTimes(1);

      const enqueuedFn = jobsService.enqueue.mock.calls[0][1];
      await enqueuedFn();

      expect(writeFileMock).toHaveBeenCalledWith(
        '/tmp/test-job-id-123-test.pdf',
        buffer,
      );
      expect(graphService.generateGraphFromFile).toHaveBeenCalledWith(
        'test.pdf',
        '/tmp/test-job-id-123-test.pdf',
        'application/pdf',
        undefined,
        undefined,
      );
    });

    it('should throw BadRequestException when no path and no buffer', async () => {
      const file = {
        path: undefined,
        originalname: 'test.pdf',
        mimetype: 'application/pdf',
        buffer: undefined,
      } as unknown as Express.Multer.File;

      service.processFile(file);

      const enqueuedFn = jobsService.enqueue.mock.calls[0][1];

      await expect(enqueuedFn()).rejects.toThrow(BadRequestException);
      await expect(enqueuedFn()).rejects.toThrow(
        'File content unavailable (no path or buffer)',
      );
    });

    it('should call generateGraphFromFile with correct parameters', async () => {
      const file = {
        path: '/uploads/document.pdf',
        originalname: 'document.pdf',
        mimetype: 'application/pdf',
        buffer: Buffer.from('content'),
      } as Express.Multer.File;

      const context = 'Important context';
      const modelId = 'anthropic:claude-3';

      graphService.generateGraphFromFile.mockResolvedValue({
        nodes: [{ id: '1', label: 'Node', depth: 0, colour: '#ffffff' }],
        edges: [],
      });
      unlinkMock.mockResolvedValue(undefined);

      service.processFile(file, context, modelId);

      const enqueuedFn = jobsService.enqueue.mock.calls[0][1];
      const result = await enqueuedFn();

      expect(graphService.generateGraphFromFile).toHaveBeenCalledWith(
        'document.pdf',
        '/uploads/document.pdf',
        'application/pdf',
        context,
        modelId,
      );
      expect(result).toEqual({
        nodes: [{ id: '1', label: 'Node', depth: 0, colour: '#ffffff' }],
        edges: [],
      });
    });

    it('should delete file after processing when path exists', async () => {
      const file = {
        path: '/uploads/test.pdf',
        originalname: 'test.pdf',
        mimetype: 'application/pdf',
        buffer: Buffer.from(''),
      } as Express.Multer.File;

      graphService.generateGraphFromFile.mockResolvedValue({
        nodes: [],
        edges: [],
      });
      unlinkMock.mockResolvedValue(undefined);

      service.processFile(file);

      const enqueuedFn = jobsService.enqueue.mock.calls[0][1];
      await enqueuedFn();

      expect(unlinkMock).toHaveBeenCalledWith('/uploads/test.pdf');
    });

    it('should delete temp file after processing when created from buffer', async () => {
      const file = {
        path: undefined,
        originalname: 'test.pdf',
        mimetype: 'application/pdf',
        buffer: Buffer.from('content'),
      } as unknown as Express.Multer.File;

      writeFileMock.mockResolvedValue(undefined);
      graphService.generateGraphFromFile.mockResolvedValue({
        nodes: [],
        edges: [],
      });
      unlinkMock.mockResolvedValue(undefined);

      service.processFile(file);

      const enqueuedFn = jobsService.enqueue.mock.calls[0][1];
      await enqueuedFn();

      expect(unlinkMock).toHaveBeenCalledWith('/tmp/test-job-id-123-test.pdf');
    });

    it('should handle file deletion errors gracefully', async () => {
      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      const file = {
        path: '/uploads/test.pdf',
        originalname: 'test.pdf',
        mimetype: 'application/pdf',
        buffer: Buffer.from(''),
      } as Express.Multer.File;

      graphService.generateGraphFromFile.mockResolvedValue({
        nodes: [],
        edges: [],
      });
      unlinkMock.mockRejectedValue(new Error('Permission denied'));

      service.processFile(file);

      const enqueuedFn = jobsService.enqueue.mock.calls[0][1];
      await enqueuedFn();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '`Failed to delete temporary file ${filePath}:`',
        expect.any(Error),
      );

      consoleErrorSpy.mockRestore();
    });

    it('should delete file even when generateGraphFromFile throws error', async () => {
      const file = {
        path: '/uploads/test.pdf',
        originalname: 'test.pdf',
        mimetype: 'application/pdf',
        buffer: Buffer.from(''),
      } as Express.Multer.File;

      graphService.generateGraphFromFile.mockRejectedValue(
        new Error('Graph generation failed'),
      );
      unlinkMock.mockResolvedValue(undefined);

      service.processFile(file);

      const enqueuedFn = jobsService.enqueue.mock.calls[0][1];

      await expect(enqueuedFn()).rejects.toThrow('Graph generation failed');
      expect(unlinkMock).toHaveBeenCalledWith('/uploads/test.pdf');
    });

    it('should handle different mimetypes', async () => {
      const pdfFile = {
        path: '/uploads/doc.pdf',
        originalname: 'doc.pdf',
        mimetype: 'application/pdf',
        buffer: Buffer.from(''),
      } as Express.Multer.File;

      const jsonFile = {
        path: '/uploads/data.json',
        originalname: 'data.json',
        mimetype: 'application/json',
        buffer: Buffer.from(''),
      } as Express.Multer.File;

      graphService.generateGraphFromFile.mockResolvedValue({
        nodes: [],
        edges: [],
      });
      unlinkMock.mockResolvedValue(undefined);

      service.processFile(pdfFile);
      service.processFile(jsonFile);

      const pdfFn = jobsService.enqueue.mock.calls[0][1];
      const jsonFn = jobsService.enqueue.mock.calls[1][1];

      await pdfFn();
      await jsonFn();

      expect(graphService.generateGraphFromFile).toHaveBeenNthCalledWith(
        1,
        'doc.pdf',
        '/uploads/doc.pdf',
        'application/pdf',
        undefined,
        undefined,
      );

      expect(graphService.generateGraphFromFile).toHaveBeenNthCalledWith(
        2,
        'data.json',
        '/uploads/data.json',
        'application/json',
        undefined,
        undefined,
      );
    });

    it('should log file properties', () => {
      const logSpy = jest.spyOn(Logger.prototype, 'log');

      const file = {
        path: '/uploads/test.pdf',
        originalname: 'test.pdf',
        mimetype: 'application/pdf',
        buffer: Buffer.from('content'),
      } as Express.Multer.File;

      service.processFile(file);

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('File properties'),
      );
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('File Path: /uploads/test.pdf'),
      );
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Buffer: Present'),
      );
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Name: test.pdf'),
      );
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Type: application/pdf'),
      );
    });

    it('should log when buffer is missing', () => {
      const logSpy = jest.spyOn(Logger.prototype, 'log');

      const file = {
        path: '/uploads/test.pdf',
        originalname: 'test.pdf',
        mimetype: 'application/pdf',
        buffer: undefined,
      } as unknown as Express.Multer.File;

      service.processFile(file);

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Buffer: Missing'),
      );
    });
  });
});

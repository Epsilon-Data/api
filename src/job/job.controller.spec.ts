import { Test, TestingModule } from '@nestjs/testing';
import { JobController } from './job.controller';
import { JobService } from './job.service';
import { NotFoundException } from '@nestjs/common';

describe('JobController', () => {
  let controller: JobController;

  const jobServiceMock = {
    getJobStatus: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [JobController],
      providers: [{ provide: JobService, useValue: jobServiceMock }],
    }).compile();

    controller = module.get<JobController>(JobController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getJobStatus', () => {
    it('should map PENDING status correctly', async () => {
      jobServiceMock.getJobStatus.mockResolvedValue({
        jobId: 'job-1',
        status: 'PENDING',
        result: null,
        error: null,
      });

      const result = await controller.getJobStatus('job-1');

      expect(result).toEqual({ jobId: 'job-1', status: 'pending' });
      expect(jobServiceMock.getJobStatus).toHaveBeenCalledWith('job-1');
    });

    it('should map ACTIVE status to pending', async () => {
      jobServiceMock.getJobStatus.mockResolvedValue({
        jobId: 'job-1',
        status: 'ACTIVE',
        result: null,
        error: null,
      });

      const result = await controller.getJobStatus('job-1');

      expect(result.status).toBe('pending');
    });

    it('should map COMPLETED status and include result', async () => {
      jobServiceMock.getJobStatus.mockResolvedValue({
        jobId: 'job-1',
        status: 'COMPLETED',
        result: { rows: 42 },
        error: null,
      });

      const result = await controller.getJobStatus('job-1');

      expect(result).toEqual({
        jobId: 'job-1',
        status: 'completed',
        result: { rows: 42 },
      });
    });

    it('should map FAILED status and include error', async () => {
      jobServiceMock.getJobStatus.mockResolvedValue({
        jobId: 'job-1',
        status: 'FAILED',
        result: null,
        error: 'Connection timeout',
      });

      const result = await controller.getJobStatus('job-1');

      expect(result).toEqual({
        jobId: 'job-1',
        status: 'error',
        error: 'Connection timeout',
      });
    });

    it('should not include result or error when they are null', async () => {
      jobServiceMock.getJobStatus.mockResolvedValue({
        jobId: 'job-1',
        status: 'COMPLETED',
        result: null,
        error: null,
      });

      const result = await controller.getJobStatus('job-1');

      expect(result).toEqual({ jobId: 'job-1', status: 'completed' });
      expect(result).not.toHaveProperty('result');
      expect(result).not.toHaveProperty('error');
    });

    it('should propagate NotFoundException from service', async () => {
      jobServiceMock.getJobStatus.mockRejectedValue(
        new NotFoundException('Job not-found not found'),
      );

      await expect(controller.getJobStatus('not-found')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});

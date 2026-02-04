import { Test, TestingModule } from '@nestjs/testing';
import { JobsService } from './jobs.service';

describe('JobsService', () => {
  let service: JobsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [JobsService],
    }).compile();

    service = module.get<JobsService>(JobsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('enqueue', () => {
    it('should set job status to pending immediately', () => {
      const jobId = 'job-1';
      const fn = jest.fn().mockResolvedValue('result');

      service.enqueue(jobId, fn);

      const status = service.status(jobId);
      expect(status).toEqual({ status: 'pending' });
    });

    it('should update status to completed when job succeeds', async () => {
      const jobId = 'job-success';
      const expectedResult = { data: 'success' };
      const fn = jest.fn().mockResolvedValue(expectedResult);

      service.enqueue(jobId, fn);

      // wait for promise to resolve or else it wont change from pending to completed
      await new Promise((resolve) => setTimeout(resolve, 10));

      const status = service.status(jobId);
      expect(status).toEqual({
        status: 'completed',
        result: expectedResult,
      });
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should update status to error when job fails with Error', async () => {
      const jobId = 'job-error';
      const errorMessage = 'Something went wrong';
      const fn = jest.fn().mockRejectedValue(new Error(errorMessage));

      const consoleSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      service.enqueue(jobId, fn);

      await new Promise((resolve) => setTimeout(resolve, 10));

      const status = service.status(jobId);
      expect(status).toEqual({
        status: 'error',
        error: errorMessage,
      });
      expect(consoleSpy).toHaveBeenCalledWith('Job failed', expect.any(Error));
      expect(fn).toHaveBeenCalledTimes(1);

      consoleSpy.mockRestore();
    });

    it('should handle non-Error rejection with stringified value', async () => {
      const jobId = 'job-non-error';
      const errorObj = { code: 'ERR_UNKNOWN', details: 'Unknown failure' };
      const fn = jest.fn().mockRejectedValue(errorObj);

      const consoleSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      service.enqueue(jobId, fn);

      await new Promise((resolve) => setTimeout(resolve, 10));

      const status = service.status(jobId);
      expect(status).toEqual({
        status: 'error',
        error: JSON.stringify(errorObj),
      });
      expect(consoleSpy).toHaveBeenCalledWith('Job failed', errorObj);

      consoleSpy.mockRestore();
    });

    it('should handle multiple jobs independently', async () => {
      const job1Id = 'job-1';
      const job2Id = 'job-2';
      const fn1 = jest.fn().mockResolvedValue('result-1');
      const fn2 = jest.fn().mockResolvedValue('result-2');

      service.enqueue(job1Id, fn1);
      service.enqueue(job2Id, fn2);

      await new Promise((resolve) => setTimeout(resolve, 10));

      const status1 = service.status(job1Id);
      const status2 = service.status(job2Id);

      expect(status1).toEqual({ status: 'completed', result: 'result-1' });
      expect(status2).toEqual({ status: 'completed', result: 'result-2' });
    });

    it('should overwrite existing job with same id', async () => {
      const jobId = 'duplicate-job';
      const fn1 = jest.fn().mockResolvedValue('first-result');
      const fn2 = jest.fn().mockResolvedValue('second-result');

      service.enqueue(jobId, fn1);
      service.enqueue(jobId, fn2);

      await new Promise((resolve) => setTimeout(resolve, 10));

      const status = service.status(jobId);
      expect(status).toEqual({ status: 'completed', result: 'second-result' });
      expect(fn1).toHaveBeenCalledTimes(1);
      expect(fn2).toHaveBeenCalledTimes(1);
    });

    it('should handle async job function with delay', async () => {
      const jobId = 'delayed-job';
      const fn = jest
        .fn()
        .mockImplementation(
          () =>
            new Promise((resolve) =>
              setTimeout(() => resolve('delayed-result'), 50),
            ),
        );

      service.enqueue(jobId, fn);

      // Check status is pending
      let status = service.status(jobId);
      expect(status).toEqual({ status: 'pending' });

      await new Promise((resolve) => setTimeout(resolve, 100));

      status = service.status(jobId);
      expect(status).toEqual({ status: 'completed', result: 'delayed-result' });
    });
  });

  describe('status', () => {
    it('should return undefined for non-existent job', () => {
      const status = service.status('non-existent-job');
      expect(status).toBeUndefined();
    });

    it('should return pending status for enqueued job', () => {
      const jobId = 'pending-job';
      const fn = jest.fn().mockImplementation(
        () => new Promise(() => {}), // Never resolves
      );

      service.enqueue(jobId, fn);

      const status = service.status(jobId);
      expect(status).toEqual({ status: 'pending' });
    });

    it('should return completed status with result', async () => {
      const jobId = 'completed-job';
      const result = { id: 123, name: 'Test' };
      const fn = jest.fn().mockResolvedValue(result);

      service.enqueue(jobId, fn);

      await new Promise((resolve) => setTimeout(resolve, 10));

      const status = service.status(jobId);
      expect(status).toEqual({ status: 'completed', result });
    });

    it('should return error status with error message', async () => {
      const jobId = 'error-job';
      const fn = jest.fn().mockRejectedValue(new Error('Job failed'));

      const consoleSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      service.enqueue(jobId, fn);

      await new Promise((resolve) => setTimeout(resolve, 10));

      const status = service.status(jobId);
      expect(status).toEqual({ status: 'error', error: 'Job failed' });

      consoleSpy.mockRestore();
    });

    it('should return status with correct type inference', async () => {
      const jobId = 'typed-job';
      type CustomResult = { count: number; items: string[] };
      const result: CustomResult = { count: 2, items: ['a', 'b'] };
      const fn = jest.fn().mockResolvedValue(result);

      service.enqueue<CustomResult>(jobId, fn);

      await new Promise((resolve) => setTimeout(resolve, 10));

      const status = service.status<CustomResult>(jobId);
      expect(status?.status).toBe('completed');
      if (status?.status === 'completed') {
        expect(status.result).toEqual(result);
        expect(status.result.count).toBe(2);
      }
    });
  });
});

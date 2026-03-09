/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import { Test, TestingModule } from '@nestjs/testing';
import { ConnectionRequestController } from './connection-request.controller';
import { ConnectionRequestService } from './connection-request.service';
import {
  UnauthorizedException,
  BadRequestException,
  ServiceUnavailableException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ResourceGuard } from 'src/common/guards/resource.guard';
import type { CurrentUserInfo } from 'src/common/decorators/user.decorator';
import type { Request } from 'express';

const mockGuard = { canActivate: () => true };

describe('ConnectionRequestController', () => {
  let controller: ConnectionRequestController;

  const mockUser: CurrentUserInfo = {
    id: 'user-123',
    email: 'test@example.org',
    given_name: 'Test',
    family_name: 'User',
  };

  const mockRequest = {
    auth: { token: 'mock-token' },
  } as unknown as Request;

  const serviceMock = {
    getList: jest.fn(),
    getDetails: jest.fn(),
    testConnection: jest.fn(),
    approve: jest.fn(),
    getComments: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ConnectionRequestController],
      providers: [{ provide: ConnectionRequestService, useValue: serviceMock }],
    })
      .overrideGuard(ResourceGuard)
      .useValue(mockGuard)
      .compile();

    controller = module.get<ConnectionRequestController>(
      ConnectionRequestController,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getList', () => {
    it('should return user connection requests', () => {
      const requests = [{ requestId: 'r1', status: 'PENDING' }];
      serviceMock.getList.mockReturnValue(requests);

      const result = controller.getList(mockUser);

      expect(result).toEqual(requests);
      expect(serviceMock.getList).toHaveBeenCalledWith('user-123');
    });
  });

  describe('getDetails', () => {
    it('should return request details', async () => {
      const details = { requestId: 'r1', status: 'APPROVED' };
      serviceMock.getDetails.mockResolvedValue(details);

      const result = await controller.getDetails(mockUser, 'r1');

      expect(result).toEqual(details);
      expect(serviceMock.getDetails).toHaveBeenCalledWith(
        'test@example.org',
        'r1',
      );
    });
  });

  describe('testConnection', () => {
    it('should return success on valid connection', async () => {
      serviceMock.testConnection.mockResolvedValue({ success: true });
      const dto = { url: 'postgres://localhost/test' } as any;

      const result = await controller.testConnection(dto);

      expect(result).toEqual({ success: true });
    });

    it('should throw UnauthorizedException on wrong credentials (28P01)', async () => {
      serviceMock.testConnection.mockRejectedValue({ code: '28P01' });

      await expect(
        controller.testConnection({ url: 'postgres://...' } as any),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw BadRequestException on non-existent database (3D000)', async () => {
      serviceMock.testConnection.mockRejectedValue({ code: '3D000' });

      await expect(
        controller.testConnection({ url: 'postgres://...' } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ServiceUnavailableException on ECONNREFUSED', async () => {
      serviceMock.testConnection.mockRejectedValue({ code: 'ECONNREFUSED' });

      await expect(
        controller.testConnection({ url: 'postgres://...' } as any),
      ).rejects.toThrow(ServiceUnavailableException);
    });

    it('should throw ServiceUnavailableException on ENOTFOUND', async () => {
      serviceMock.testConnection.mockRejectedValue({ code: 'ENOTFOUND' });

      await expect(
        controller.testConnection({ url: 'postgres://...' } as any),
      ).rejects.toThrow(ServiceUnavailableException);
    });

    it('should throw UnauthorizedException on password-related message', async () => {
      serviceMock.testConnection.mockRejectedValue({
        message: 'password authentication failed',
      });

      await expect(
        controller.testConnection({ url: 'postgres://...' } as any),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw BadRequestException on "does not exist" message', async () => {
      serviceMock.testConnection.mockRejectedValue({
        message: 'database "foo" does not exist',
      });

      await expect(
        controller.testConnection({ url: 'postgres://...' } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw InternalServerErrorException on SSL errors', async () => {
      serviceMock.testConnection.mockRejectedValue({
        message: 'SSL connection required',
      });

      await expect(
        controller.testConnection({ url: 'postgres://...' } as any),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('should throw InternalServerErrorException on unknown errors', async () => {
      serviceMock.testConnection.mockRejectedValue({});

      await expect(
        controller.testConnection({ url: 'postgres://...' } as any),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('approve', () => {
    it('should call service.approve with correct params', async () => {
      const dto = { decision: 'APPROVED' } as any;
      serviceMock.approve.mockResolvedValue(undefined);

      await controller.approve(mockRequest, mockUser, 'r1', 'p1', dto);

      expect(serviceMock.approve).toHaveBeenCalledWith(
        mockUser,
        'r1',
        'p1',
        dto,
        'mock-token',
      );
    });
  });

  describe('getComments', () => {
    it('should return comments for a request', async () => {
      const comments = [{ id: 'c1', content: 'Test comment' }];
      serviceMock.getComments.mockResolvedValue(comments);
      const query = { page: 1, limit: 10 } as any;

      const result = await controller.getComments(mockUser, 'r1', query);

      expect(result).toEqual(comments);
      expect(serviceMock.getComments).toHaveBeenCalledWith(
        'user-123',
        'r1',
        query,
      );
    });
  });
});

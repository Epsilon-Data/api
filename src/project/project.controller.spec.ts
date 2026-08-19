/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import { Test, TestingModule } from '@nestjs/testing';
import { ProjectController } from './project.controller';
import { ProjectService } from './project.service';
import { KeycloakService } from 'src/auth/keycloak/keycloak.service';
import { ResourceGuard } from 'src/common/guards/resource.guard';
import type { CurrentUserInfo } from 'src/common/decorators/user.decorator';
import type { Request } from 'express';

jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mocked-uuid'),
}));

const mockGuard = { canActivate: () => true };

describe('ProjectController', () => {
  let controller: ProjectController;

  const mockUser: CurrentUserInfo = {
    id: 'user-123',
    email: 'test@example.org',
    given_name: 'Test',
    family_name: 'User',
  };

  const mockRequest = {
    auth: { token: 'mock-token' },
  } as unknown as Request;

  const projectServiceMock = {
    createProject: jest.fn(),
    getUserOwnedProjects: jest.fn(),
    getUserSharedProjects: jest.fn(),
    getAllProjects: jest.fn(),
    getProjectDetails: jest.fn(),
    getProjectPublicDetails: jest.fn(),
    getProjectRequests: jest.fn(),
    updateProject: jest.fn(),
    deleteProject: jest.fn(),
    getProjectSettings: jest.fn(),
    updateProjectSettings: jest.fn(),
    uploadProjectCover: jest.fn(),
    updateCredentials: jest.fn(),
  };

  const keycloakServiceMock = {
    getPermissions: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProjectController],
      providers: [
        { provide: ProjectService, useValue: projectServiceMock },
        { provide: KeycloakService, useValue: keycloakServiceMock },
      ],
    })
      .overrideGuard(ResourceGuard)
      .useValue(mockGuard)
      .compile();

    controller = module.get<ProjectController>(ProjectController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createProject', () => {
    it('should call projectService.createProject with user, dto, and token', async () => {
      const dto = { name: 'Test Project' } as any;
      projectServiceMock.createProject.mockResolvedValue(undefined);

      await controller.createProject(mockRequest, mockUser, dto);

      expect(projectServiceMock.createProject).toHaveBeenCalledWith(
        mockUser,
        dto,
        'mock-token',
      );
    });
  });

  describe('getUserOwnedProjects', () => {
    it('should return user owned projects', async () => {
      const projects = [{ projectId: 'p1', name: 'Project 1' }];
      const query = { page: 1, limit: 12 } as any;
      projectServiceMock.getUserOwnedProjects.mockResolvedValue(projects);

      const result = await controller.getUserOwnedProjects(mockUser, query);

      expect(result).toEqual(projects);
      expect(projectServiceMock.getUserOwnedProjects).toHaveBeenCalledWith(
        'user-123',
        query,
      );
    });
  });

  describe('getUserSharedProjects', () => {
    it('should get permissions and return shared projects', async () => {
      const permissions = [{ rsname: 'project:p1', scopes: ['view'] }];
      const projects = [{ projectId: 'p1', name: 'Shared Project' }];
      const query = { page: 1, limit: 12 } as any;
      keycloakServiceMock.getPermissions.mockResolvedValue(permissions);
      projectServiceMock.getUserSharedProjects.mockResolvedValue(projects);

      const result = await controller.getUserSharedProjects(mockRequest, query);

      expect(keycloakServiceMock.getPermissions).toHaveBeenCalled();
      expect(projectServiceMock.getUserSharedProjects).toHaveBeenCalledWith(
        permissions,
        query,
      );
      expect(result).toEqual(projects);
    });
  });

  describe('getAllProjects', () => {
    it('should return all public projects', async () => {
      const projects = [{ projectId: 'p1', name: 'Public Project' }];
      projectServiceMock.getAllProjects.mockResolvedValue(projects);

      const result = await controller.getAllProjects();

      expect(result).toEqual(projects);
      expect(projectServiceMock.getAllProjects).toHaveBeenCalled();
    });
  });

  describe('getProjectDetails', () => {
    it('should return project details for a valid UUID', async () => {
      const details = { projectId: 'p1', name: 'Test', ownerId: 'user-123' };
      projectServiceMock.getProjectDetails.mockResolvedValue(details);

      const result = await controller.getProjectDetails('p1');

      expect(result).toEqual(details);
      expect(projectServiceMock.getProjectDetails).toHaveBeenCalledWith('p1');
    });
  });

  describe('getProjectPublicDetails', () => {
    it('should return public project details', async () => {
      const details = { projectId: 'p1', name: 'Public Project' };
      projectServiceMock.getProjectPublicDetails.mockResolvedValue(details);

      const result = await controller.getProjectPublicDetails('p1');

      expect(result).toEqual(details);
      expect(projectServiceMock.getProjectPublicDetails).toHaveBeenCalledWith(
        'p1',
      );
    });
  });

  describe('getProjectRequests', () => {
    it('should return project requests', async () => {
      const requests = { connection: [], analysis: [] };
      projectServiceMock.getProjectRequests.mockResolvedValue(requests);

      const result = await controller.getProjectRequests(mockUser, 'p1');

      expect(result).toEqual(requests);
      expect(projectServiceMock.getProjectRequests).toHaveBeenCalledWith(
        'p1',
        'user-123',
        'test@example.org',
      );
    });
  });

  describe('updateProject', () => {
    it('should call updateProject with projectId, dto, and token', () => {
      const dto = { projectId: 'p1', name: 'Updated' } as any;
      projectServiceMock.updateProject.mockResolvedValue({});

      controller.updateProject(mockRequest, 'p1', dto);

      expect(projectServiceMock.updateProject).toHaveBeenCalledWith(
        'p1',
        dto,
        'mock-token',
      );
    });
  });

  describe('deleteProject', () => {
    it('should call deleteProject with projectId', () => {
      projectServiceMock.deleteProject.mockResolvedValue(undefined);

      controller.deleteProject('p1');

      expect(projectServiceMock.deleteProject).toHaveBeenCalledWith('p1');
    });
  });

  describe('getProjectSettings', () => {
    it('should return project settings', async () => {
      const settings = {
        projectId: 'p1',
        visualizations: null,
        cover: null,
      };
      projectServiceMock.getProjectSettings.mockResolvedValue(settings);

      const result = await controller.getProjectSettings('p1');

      expect(result).toEqual(settings);
    });
  });

  describe('updateCredentials', () => {
    it('should call updateCredentials with correct params', async () => {
      const dto = { dbDetails: { url: 'postgres://...' } } as any;
      projectServiceMock.updateCredentials.mockResolvedValue(undefined);

      await controller.updateCredentials(mockRequest, mockUser, 'p1', dto);

      expect(projectServiceMock.updateCredentials).toHaveBeenCalledWith(
        mockUser,
        'p1',
        dto,
        'mock-token',
      );
    });
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { KeycloakAdminService } from './keycloak/keycloak-admin.service';
import { RolesGuard } from 'src/common/guards/roles.guard';

const mockGuard = { canActivate: () => true };

describe('AdminController', () => {
  let controller: AdminController;

  const adminServiceMock = {
    getStats: jest.fn(),
    getProjects: jest.fn(),
    getProjectById: jest.fn(),
    getProjectUsers: jest.fn(),
    getRequests: jest.fn(),
    getRequestById: jest.fn(),
    getComments: jest.fn(),
    getNotifications: jest.fn(),
    getArchetypes: jest.fn(),
    getProjectArchetypes: jest.fn(),
    getArchetypeById: jest.fn(),
  };

  const keycloakServiceMock = {
    getAllUsersAndLastLogin: jest.fn(),
    getUserInfoById: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [
        { provide: AdminService, useValue: adminServiceMock },
        { provide: KeycloakAdminService, useValue: keycloakServiceMock },
      ],
    })
      .overrideGuard(RolesGuard)
      .useValue(mockGuard)
      .compile();

    controller = module.get<AdminController>(AdminController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getUsers', () => {
    it('should return all users', async () => {
      const users = [{ id: 'u1', username: 'admin' }];
      keycloakServiceMock.getAllUsersAndLastLogin.mockResolvedValue(users);

      const result = await controller.getUsers();

      expect(result).toEqual(users);
      expect(keycloakServiceMock.getAllUsersAndLastLogin).toHaveBeenCalled();
    });
  });

  describe('getUserById', () => {
    it('should return user by id', async () => {
      const user = { id: 'u1', username: 'admin' };
      keycloakServiceMock.getUserInfoById.mockResolvedValue(user);

      const result = await controller.getUserById('u1');

      expect(result).toEqual(user);
      expect(keycloakServiceMock.getUserInfoById).toHaveBeenCalledWith('u1');
    });
  });

  describe('getStats', () => {
    it('should return dashboard statistics', async () => {
      const stats = { projects: 10, users: 5, requests: 3 };
      adminServiceMock.getStats.mockResolvedValue(stats);

      const result = await controller.getStats();

      expect(result).toEqual(stats);
    });
  });

  describe('getProjects', () => {
    it('should pass query params and return paginated projects', async () => {
      const query = { page: 1, limit: 10, search: 'health' };
      const response = {
        data: [{ projectId: 'p1' }],
        pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
      };
      adminServiceMock.getProjects.mockResolvedValue(response);

      const result = await controller.getProjects(query);

      expect(result).toEqual(response);
      expect(adminServiceMock.getProjects).toHaveBeenCalledWith(query);
    });
  });

  describe('getProjectById', () => {
    it('should return project by id', async () => {
      const project = { projectId: 'p1', name: 'Test' };
      adminServiceMock.getProjectById.mockResolvedValue(project);

      const result = await controller.getProjectById('p1');

      expect(result).toEqual(project);
      expect(adminServiceMock.getProjectById).toHaveBeenCalledWith('p1');
    });
  });

  describe('getProjectUsers', () => {
    it('should return users with access to project', async () => {
      const users = [{ id: 'u1', name: 'User 1' }];
      adminServiceMock.getProjectUsers.mockResolvedValue(users);

      const result = await controller.getProjectUsers('p1');

      expect(result).toEqual(users);
      expect(adminServiceMock.getProjectUsers).toHaveBeenCalledWith('p1');
    });
  });

  describe('getRequests', () => {
    it('should pass query and return paginated requests', async () => {
      const query = { page: 1, limit: 10 };
      const response = {
        data: [],
        pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
      };
      adminServiceMock.getRequests.mockResolvedValue(response);

      const result = await controller.getRequests(query);

      expect(result).toEqual(response);
      expect(adminServiceMock.getRequests).toHaveBeenCalledWith(query);
    });
  });

  describe('getRequestById', () => {
    it('should return request by id', async () => {
      const request = { requestId: 'r1', status: 'PENDING' };
      adminServiceMock.getRequestById.mockResolvedValue(request);

      const result = await controller.getRequestById('r1');

      expect(result).toEqual(request);
      expect(adminServiceMock.getRequestById).toHaveBeenCalledWith('r1');
    });
  });

  describe('getComments', () => {
    it('should return paginated comments', async () => {
      const query = { page: 1, limit: 10 };
      const response = {
        data: [],
        pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
      };
      adminServiceMock.getComments.mockResolvedValue(response);

      const result = await controller.getComments(query);

      expect(result).toEqual(response);
      expect(adminServiceMock.getComments).toHaveBeenCalledWith(query);
    });
  });

  describe('getNotifications', () => {
    it('should return paginated notifications', async () => {
      const query = { page: 1, limit: 10 };
      const response = {
        data: [],
        pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
      };
      adminServiceMock.getNotifications.mockResolvedValue(response);

      const result = await controller.getNotifications(query);

      expect(result).toEqual(response);
      expect(adminServiceMock.getNotifications).toHaveBeenCalledWith(query);
    });
  });

  describe('getArchetypes', () => {
    it('should return paginated archetypes', async () => {
      const query = { page: 1, limit: 10 };
      const response = {
        data: [],
        pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
      };
      adminServiceMock.getArchetypes.mockResolvedValue(response);

      const result = await controller.getArchetypes(query);

      expect(result).toEqual(response);
      expect(adminServiceMock.getArchetypes).toHaveBeenCalledWith(query);
    });
  });

  describe('getProjectArchetypes', () => {
    it('should return archetypes for a project', async () => {
      const archetypes = [{ id: 'a1' }];
      adminServiceMock.getProjectArchetypes.mockResolvedValue(archetypes);

      const result = await controller.getProjectArchetypes('p1');

      expect(result).toEqual(archetypes);
      expect(adminServiceMock.getProjectArchetypes).toHaveBeenCalledWith('p1');
    });
  });

  describe('getArchetypeById', () => {
    it('should return archetype by project and archetype id', async () => {
      const archetype = { id: 'a1', projectId: 'p1' };
      adminServiceMock.getArchetypeById.mockResolvedValue(archetype);

      const result = await controller.getArchetypeById('p1', 'a1');

      expect(result).toEqual(archetype);
      expect(adminServiceMock.getArchetypeById).toHaveBeenCalledWith(
        'p1',
        'a1',
      );
    });
  });
});

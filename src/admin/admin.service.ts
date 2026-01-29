import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  AdminProjectsQueryDto,
  AdminRequestsQueryDto,
  PaginationQueryDto,
  AdminNotificationsQueryDto,
  AdminArchetypesQueryDto,
} from './dto';
import { Prisma } from 'src/generated/prisma/client';
import { ArchetypeService } from 'src/archetype/archetype.service';
import { KeycloakAdminService } from './keycloak/keycloak-admin.service';
import { groupPrefix, analysisPolicyPrefix } from 'src/utils/options.util';

export interface ProjectUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'owner' | 'collaborator' | 'analyst';
}

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly archetypeService: ArchetypeService,
    private readonly keycloakService: KeycloakAdminService,
  ) {}

  async getStats() {
    const [projectCount, requestCount, commentCount, notificationCount] =
      await Promise.all([
        this.prisma.project.count(),
        this.prisma.request.count(),
        this.prisma.comment.count(),
        this.prisma.notification.count(),
      ]);

    const [pendingRequests, approvedRequests, projectsByStatus] =
      await Promise.all([
        this.prisma.request.count({ where: { status: 'PENDING' } }),
        this.prisma.request.count({ where: { status: 'APPROVED' } }),
        this.prisma.project.groupBy({
          by: ['status'],
          _count: { status: true },
        }),
      ]);

    return {
      projectCount,
      requestCount,
      commentCount,
      notificationCount,
      pendingRequests,
      approvedRequests,
      projectsByStatus: projectsByStatus.map((item) => ({
        status: item.status,
        count: item._count.status,
      })),
    };
  }

  async getProjects(query: AdminProjectsQueryDto) {
    const { page = 1, limit = 10, search, status } = query;

    const where: Prisma.ProjectWhereInput = {
      ...(status && { status }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { university: { contains: search, mode: 'insensitive' } },
          { lead: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [projects, total] = await Promise.all([
      this.prisma.project.findMany({
        where,
        orderBy: { lastModified: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          projectId: true,
          name: true,
          university: true,
          lead: true,
          status: true,
          lastModified: true,
          createdDate: true,
        },
      }),
      this.prisma.project.count({ where }),
    ]);

    return {
      data: projects,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getProjectById(id: string) {
    return this.prisma.project.findUnique({
      where: { projectId: id },
      include: {
        connection: {
          include: {
            request: true,
          },
        },
        analysis: true,
      },
    });
  }

  async getRequests(query: AdminRequestsQueryDto) {
    const { page = 1, limit = 10, search, status } = query;

    const where: Prisma.RequestWhereInput = {
      ...(status && { status }),
      ...(search && {
        analysis: {
          requestorName: { contains: search, mode: 'insensitive' },
        },
      }),
    };

    const [requests, total] = await Promise.all([
      this.prisma.request.findMany({
        where,
        orderBy: { lastModified: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          analysis: {
            select: {
              requestorName: true,
              requestorEmail: true,
              requestorOrgName: true,
              requestorPosition: true,
              projectName: true,
              projectDescription: true,
              projectStartDate: true,
              projectEndDate: true,
            },
          },
          connection: {
            select: {
              projectId: true,
              project: {
                select: {
                  projectId: true,
                  name: true,
                  status: true,
                },
              },
            },
          },
          _count: {
            select: { comments: true },
          },
        },
      }),
      this.prisma.request.count({ where }),
    ]);

    return {
      data: requests,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getRequestById(id: string) {
    return this.prisma.request.findUnique({
      where: { requestId: id },
      include: {
        analysis: true,
        comments: {
          orderBy: { createdDate: 'desc' },
        },
        connection: {
          include: {
            project: {
              select: {
                projectId: true,
                name: true,
              },
            },
          },
        },
      },
    });
  }

  async getComments(query: PaginationQueryDto) {
    const { page = 1, limit = 10, search } = query;

    const where: Prisma.CommentWhereInput = {
      ...(search && {
        OR: [
          { content: { contains: search, mode: 'insensitive' } },
          { authorName: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [comments, total] = await Promise.all([
      this.prisma.comment.findMany({
        where,
        orderBy: { createdDate: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          request: {
            include: {
              analysis: {
                select: {
                  projectName: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.comment.count({ where }),
    ]);

    return {
      data: comments,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getNotifications(query: AdminNotificationsQueryDto) {
    const { page = 1, limit = 10, search, status } = query;

    const where: Prisma.NotificationWhereInput = {
      ...(search && {
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { message: { contains: search, mode: 'insensitive' } },
        ],
      }),
      ...(status && {
        NotificationRecipient: {
          some: {
            status,
          },
        },
      }),
    };

    const [notifications, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdDate: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          NotificationSender: true,
          NotificationRecipient: true,
        },
      }),
      this.prisma.notification.count({ where }),
    ]);

    return {
      data: notifications,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getArchetypes(query: AdminArchetypesQueryDto) {
    const { page = 1, limit = 10, search, status } = query;

    // Get all projects to fetch their archetypes
    const projects = await this.prisma.project.findMany({
      select: { projectId: true, name: true },
    });

    // Fetch archetypes for all projects in parallel
    const archetypePromises = projects.map(async (project) => {
      try {
        const archetypes = await this.archetypeService.fetchArchetypes(
          project.projectId,
        );
        return archetypes.map((archetype) => ({
          ...archetype,
          projectId: project.projectId,
          projectName: project.name,
        }));
      } catch {
        return [];
      }
    });

    const archetypeArrays = await Promise.all(archetypePromises);
    let allArchetypes = archetypeArrays.flat();

    // Apply filters
    if (status) {
      allArchetypes = allArchetypes.filter((a) => a.status === status);
    }
    if (search) {
      const searchLower = search.toLowerCase();
      allArchetypes = allArchetypes.filter(
        (a) =>
          a.name?.toLowerCase().includes(searchLower) ||
          a.projectName.toLowerCase().includes(searchLower),
      );
    }

    // Sort by lastModified descending
    allArchetypes.sort(
      (a, b) =>
        new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime(),
    );

    // Paginate
    const total = allArchetypes.length;
    const paginatedArchetypes = allArchetypes.slice(
      (page - 1) * limit,
      page * limit,
    );

    return {
      data: paginatedArchetypes,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getProjectArchetypes(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { projectId },
      select: { projectId: true, name: true },
    });

    if (!project) {
      return [];
    }

    try {
      const archetypes = await this.archetypeService.fetchArchetypes(projectId);
      return archetypes.map((archetype) => ({
        ...archetype,
        projectId: project.projectId,
        projectName: project.name,
      }));
    } catch {
      return [];
    }
  }

  async getArchetypeById(projectId: string, archetypeId: string) {
    return this.archetypeService.getArchetypeDetails(projectId, archetypeId);
  }

  async getProjectUsers(projectId: string): Promise<ProjectUser[]> {
    const users: ProjectUser[] = [];
    const seenUserIds = new Set<string>();

    // Get project owner
    const project = await this.prisma.project.findUnique({
      where: { projectId },
      select: { ownerId: true },
    });

    if (project?.ownerId) {
      try {
        const owner = await this.keycloakService.getUserById(project.ownerId);
        if (owner) {
          users.push({
            id: owner.id!,
            email: owner.email || '',
            firstName: owner.firstName || '',
            lastName: owner.lastName || '',
            role: 'owner',
          });
          seenUserIds.add(owner.id!);
        }
      } catch (error) {
        this.logger.warn(`Failed to fetch owner ${project.ownerId}: ${error}`);
      }
    }

    // Get collaborators from group
    try {
      const groups = await this.keycloakService.getGroupByName(
        `${groupPrefix}${projectId}`,
      );
      if (groups.length > 0) {
        const members = await this.keycloakService.getGroupMembers(
          groups[0].id!,
        );
        if (members && Array.isArray(members)) {
          for (const member of members) {
            if (!seenUserIds.has(member.id!)) {
              users.push({
                id: member.id!,
                email: member.email || '',
                firstName: member.firstName || '',
                lastName: member.lastName || '',
                role: 'collaborator',
              });
              seenUserIds.add(member.id!);
            }
          }
        }
      }
    } catch (error) {
      this.logger.warn(`Failed to fetch collaborators group: ${error}`);
    }

    // Get analysis users from policy
    try {
      const policies = await this.keycloakService.getProjectPolicies(projectId);
      const analysisPolicy = policies.find(
        (p) => p.name === `${analysisPolicyPrefix}${projectId}`,
      );

      if (analysisPolicy?.config?.users) {
        let userIds: string[] = [];
        try {
          const parsed: unknown =
            typeof analysisPolicy.config.users === 'string'
              ? JSON.parse(analysisPolicy.config.users)
              : [];
          userIds = Array.isArray(parsed)
            ? parsed.filter((u): u is string => typeof u === 'string')
            : [];
        } catch {
          userIds = [];
        }

        for (const userId of userIds) {
          if (!seenUserIds.has(userId)) {
            try {
              const user = await this.keycloakService.getUserById(userId);
              if (user) {
                users.push({
                  id: user.id!,
                  email: user.email || '',
                  firstName: user.firstName || '',
                  lastName: user.lastName || '',
                  role: 'analyst',
                });
                seenUserIds.add(user.id!);
              }
            } catch (error) {
              this.logger.warn(`Failed to fetch analyst ${userId}: ${error}`);
            }
          }
        }
      }
    } catch (error) {
      this.logger.warn(`Failed to fetch analysis policy: ${error}`);
    }

    return users;
  }
}

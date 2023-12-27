import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { ConnectionRequestDto } from './dto';

@Injectable()
export class ConnectionRequestService {
  constructor(private prisma: PrismaService) {}
  async details(requestId: number) {
    return await this.prisma.connectionRequest.findUnique({
      where: {
        id: requestId,
      },
      select: {
        status: true,
        createdDate: true,
        dataCollectionStartDate: true,
        dataCollectionEndDate: true,
        dataParticipantsNum: true,
        dataDescription: true,
        dataKeywords: true,
        additionalInfo: true,
        Project: {
          select: {
            name: true,
            startDate: true,
            endDate: true,
            lead: true,
            members: true,
            university: true,
            faculty: true,
            ethicsId: true,
            description: true,
          },
        },
        OrgAdmin: {
          select: {
            email: true,
          },
        },
        ResearcherDb: {
          select: {
            name: true,
            type: true,
          },
        },
      },
    });
  }

  async summary(userId: number, userType: string) {
    if (userType === 'researcher') {
      return await this.prisma.connectionRequest.findMany({
        where: {
          requestor: userId,
        },
        select: {
          id: true,
          status: true,
          createdDate: true,
          Project: {
            select: {
              name: true,
            },
          },
        },
      });
    } else if (userType === 'orgAdmin') {
      return await this.prisma.connectionRequest.findMany({
        where: {
          orgAdminId: userId,
        },
        select: {
          id: true,
          requestor: true,
          status: true,
          createdDate: true,
          Project: {
            select: {
              name: true,
            },
          },
        },
      });
    }
  }

  async create(dto: ConnectionRequestDto) {
    const request = {
      requestor: dto.requestor,
      status: 1,
      dataParticipantsNum: dto.dataInfo.participantsNumber,
      dataDescription: dto.dataInfo.description,
      dataKeywords: dto.dataInfo.keywords,
      additionalInfo: dto.additionalInfo,
      dataCollectionStartDate: dto.dataInfo.collectionDuration[0],
      dataCollectionEndDate: dto.dataInfo.collectionDuration[1],
      Project: {
        create: {
          name: dto.projectInfo.name,
          lead: dto.projectInfo.lead,
          university: dto.projectInfo.university,
          faculty: dto.projectInfo.faculty,
          ethicsId: dto.projectInfo.ethicsApprovalId,
          description: dto.projectInfo.description,
          startDate: dto.projectInfo.duration[0],
          endDate: dto.projectInfo.duration[1],
          members: dto.projectInfo.members,
        },
      },
    };

    let information = {};
    if (dto.databaseInfo) {
      information = {
        ResearcherDb: {
          create: {
            name: dto.databaseInfo.name,
            type: dto.databaseInfo.type,
          },
        },
      };
    } else {
      const existingOrgAdmin = await this.prisma.orgAdmin.findFirst({
        where: {
          email: dto.orgAdminEmail,
        },
        select: {
          id: true,
        },
      });
      if (existingOrgAdmin) {
        information = {
          orgAdminId: existingOrgAdmin.id,
        };
      } else {
        information = {
          OrgAdmin: {
            create: {
              email: dto.orgAdminEmail,
            },
          },
        };
      }
      return await this.prisma.connectionRequest.create({
        data: {
          ...request,
          ...information,
        },
      });
    }
  }
}

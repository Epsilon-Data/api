import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { ConnectionRequestDto } from './dto';

@Injectable()
export class ConnectionRequestService {
  constructor(private prisma: PrismaService) {}
  details() {
    return 'details';
  }

  summary() {
    return 'summary';
  }

  async create(dto: ConnectionRequestDto) {
    const project = await this.prisma.project.create({
      data: {
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
    });

    let request = null;

    if (dto.databaseInfo) {
      const database = await this.prisma.researcherDb.create({
        data: {
          dbName: dto.databaseInfo.name,
          dbType: dto.databaseInfo.type,
        },
      });

      request = await this.prisma.connectionRequest.create({
        data: {
          requestor: dto.requestor,
          projectId: project.id,
          status: 1,
          dbId: database.id,
          dataParticipantsNum: dto.dataInfo.participantsNumber,
          dataDescription: dto.dataInfo.description,
          dataKeywords: dto.dataInfo.keywords,
          dataCollectionStartDate: dto.dataInfo.collectionDuration[0],
          dataCollectionEndDate: dto.dataInfo.collectionDuration[1],
        },
      });
    } else {
      const orgAdmin = await this.prisma.orgAdmin.create({
        data: {
          email: dto.orgAdminEmail,
        },
      });
      request = await this.prisma.connectionRequest.create({
        data: {
          requestor: dto.requestor,
          projectId: project.id,
          status: 1,
          orgAdminId: orgAdmin.id,
          dataParticipantsNum: dto.dataInfo.participantsNumber,
          dataDescription: dto.dataInfo.description,
          dataKeywords: dto.dataInfo.keywords,
          additionalInfo: dto.additionalInfo,
          dataCollectionStartDate: dto.dataInfo.collectionDuration[0],
          dataCollectionEndDate: dto.dataInfo.collectionDuration[1],
        },
      });
    }

    return request;
  }
}

import { Injectable } from '@nestjs/common';
import { AtlasService } from 'src/atlas/atlas.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { AccessDto } from './dto';
import { FileStorageService } from 'src/file_storage/file_storage.service';

@Injectable()
export class BrowseDatasetService {
  constructor(
    private prisma: PrismaService,
    private atlas: AtlasService,
    private fileStorage: FileStorageService,
  ) {}

  async projects() {
    const request = await this.prisma.connectionRequest.findMany({
      where: {
        status: {
          equals: 3,
        },
      },
      select: {
        dataKeywords: true,
        createdDate: true,
        Project: true,
      },
    });

    const browseList = request.map(async (item) => {
      const bucket = 'cover';
      const key = `${item.Project.id}/cover.jpg`;
      let cover = null;

      const exists = await this.fileStorage.fileExists(bucket, key);
      if (exists) {
        cover = await this.fileStorage.getFileUrl(bucket, key);
      }

      return {
        id: item.Project.id,
        name: item.Project.name,
        organisation: item.Project.university,
        createdDate: item.createdDate,
        description: item.Project.description,
        keywords: item.dataKeywords,
        cover: cover,
      };
    });

    return Promise.all(browseList);
  }

  async projectDetails(userId: string, projectId: string) {
    const isOwnProject = await this.prisma.connectionRequest.findFirst({
      where: {
        requestor: userId,
        projectId: projectId,
      },
    });

    const request = await this.prisma.connectionRequest.findUnique({
      where: {
        projectId: projectId,
      },
      select: {
        atlasId: true,
        dataDescription: true,
        dataParticipantsNum: true,
        dataKeywords: true,
        dataCollectionStartDate: true,
        dataCollectionEndDate: true,
        Project: true,
      },
    });

    const params = {
      query: `from archetype where instance.__guid = "${request.atlasId}" select is_active, __state, __guid, qualifiedName`,
    };
    const result = await this.atlas.get('/search/dsl', params);

    const activeTemplate = result.attributes.values.find(
      (item) => item[0] === true && item[1] === 'ACTIVE',
    );

    const templateGuid = activeTemplate[2];
    const templateName = activeTemplate[3].split('@', 2)[1];

    const templateInfo = {
      id: templateGuid,
      name: templateName,
      nodes: [],
      edges: [],
    };

    const templateEntity = await this.atlas.get(`/entity/guid/${templateGuid}`);
    for (const key in templateEntity.referredEntities) {
      const entity = templateEntity.referredEntities[key];

      if (entity.typeName.includes('archetype_')) {
        const splitted = entity.attributes.qualifiedName.split('@', 3);
        const node = {
          id: splitted[2],
          position: {
            x: Number(entity.attributes.position.x),
            y: Number(entity.attributes.position.y),
          },
          data: {
            label: entity.attributes.displayName,
          },
          type: entity.typeName.replace('archetype_', ''),
          width: entity.attributes.width,
          height: entity.attributes.height,
          selected: false,
          positionAbsolute: {
            x: Number(entity.attributes.position.x),
            y: Number(entity.attributes.position.y),
          },
          dragging: false,
        };
        templateInfo.nodes.push(node);

        if (entity.typeName != 'archetype_object') {
          const edge = {
            source: splitted[2],
            target: '',
            sourceHandle: null,
            targetHandle: null,
            id: '',
          };

          const name =
            entity.typeName == 'archetype_category'
              ? entity.relationshipAttributes.object.qualifiedName
              : entity.relationshipAttributes.category.qualifiedName;

          edge.target = name.split('@')[2];
          edge.id = `edge_${edge.source}_${edge.target}`;

          templateInfo.edges.push(edge);
        }
      }
    }

    const details = {
      name: request.Project.name,
      duration: [request.Project.startDate, request.Project.endDate],
      lead: request.Project.lead,
      members: request.Project.members,
      university: request.Project.university,
      faculty: request.Project.faculty,
      ethicsId: request.Project.ethicsId,
      description: request.Project.description,
      dataDescription: request.dataDescription,
      collectionDuration: [
        request.dataCollectionStartDate,
        request.dataCollectionEndDate,
      ],
      dataKeywords: request.dataKeywords,
      dataParticipantsNum: request.dataParticipantsNum,
      archetype: templateInfo ? templateInfo : null,
      visualisations: request.Project.visualisations,
      isOwnProject: isOwnProject ? true : false,
      lastUpdated: request.Project.lastUpdated,
    };

    return details;
  }

  async projectSummary(projectId: string) {
    const request = await this.prisma.connectionRequest.findUnique({
      where: {
        projectId: projectId,
      },
      select: {
        Project: true,
      },
    });

    return {
      id: request.Project.customId,
      name: request.Project.name,
      organisation: request.Project.university,
    };
  }

  async createRequest(details: AccessDto) {
    await this.prisma.userRequest.create({
      data: {
        projectId: details.id,
        accessPurpose: details.accessPurpose,
        requestor: details.requestor,
        requestorName: details.requestorName,
        requestorEmail: details.email,
        requestorOrgName: details.orgName,
        requestorPosition: details.position,
        projectName: details.projectName,
        projectStartDate: details.projectDuration[0],
        projectEndDate: details.projectDuration[1],
        projectBackground: details.projectBackground,
        projectObjective: details.projectObjective,
        projectHypotheses: details.projectHypotheses,
        projectOutcome: details.projectOutcome,
        projectMembers: details.projectMembers,
        ethicsId: details.ethicsId,
        status: 1,
      },
    });
    return details;
  }
}

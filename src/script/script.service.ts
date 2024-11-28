import { Injectable } from '@nestjs/common';
import { AtlasService } from 'src/atlas/atlas.service';
import { DataProcessingService } from 'src/data_processing/data_processing.service';
import { FileStorageService } from 'src/file_storage/file_storage.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { Request } from 'express';

@Injectable()
export class ScriptService {
  constructor(
    private prisma: PrismaService,
    private dataProcess: DataProcessingService,
    private atlas: AtlasService,
    private fileStorage: FileStorageService,
  ) {}

  async uploadScript(
    request: Request,
    analysisId: string,
    file: Express.Multer.File,
  ) {
    const fileContent = file.buffer.toString('utf-8');
    const variables = await this.dataProcess.extractCsvVariables(fileContent);
    const mapping = variables.reduce((obj, str) => {
      obj[str] = null;
      return obj;
    }, {});

    const createRequest = await this.prisma.script.upsert({
      where: {
        analysisId_name: { analysisId: analysisId, name: file.originalname },
      },
      update: {
        status: 4,
        statusMsg:
          'Incomplete upload settings. Please check your upload settings to proceed.',
        lastUpdatedUser:
          request.auth.payload.given_name +
          ' ' +
          request.auth.payload.family_name,
        mapping: mapping,
      },
      create: {
        analysisId: analysisId,
        name: file.originalname,
        status: 4,
        statusMsg:
          'Incomplete upload settings. Please check your upload settings to proceed.',
        lastUpdatedUser:
          request.auth.payload.given_name +
          ' ' +
          request.auth.payload.family_name,
        mapping: mapping,
      },
    });

    this.fileStorage.putFile(
      'script',
      `${analysisId}/${file.originalname}`,
      file,
    );

    return createRequest.id;
  }

  async deleteScript(scriptId: string) {
    const bucket = 'script';
    const resBucket = 'report';
    const request = await this.prisma.script.findUnique({
      where: {
        id: scriptId,
      },
      select: {
        name: true,
        Analysis: {
          select: {
            id: true,
          },
        },
      },
    });

    await this.prisma.script.delete({
      where: {
        id: scriptId,
      },
    });

    await this.fileStorage.deleteFile(
      bucket,
      `${request.Analysis.id}/${request.name}`,
    );

    const isPrepend = await this.fileStorage.fileExists(
      bucket,
      `${request.Analysis.id}/prepend-${request.name}`,
    );

    const isResult = await this.fileStorage.fileExists(
      resBucket,
      `${request.Analysis.id}/${request.name}`.replace('.R', '.html'),
    );

    if (isPrepend) {
      await this.fileStorage.deleteFile(
        bucket,
        `${request.Analysis.id}/prepend-${request.name}`,
      );
    }

    if (isResult) {
      await this.fileStorage.deleteFile(
        resBucket,
        `${request.Analysis.id}/${request.name}`.replace('.R', '.html'),
      );
    }

    return scriptId;
  }

  async getScriptMapping(scriptId: string, request: Request) {
    let isResearch = false;
    const access: { roles?: string[] } = request.auth.payload.realm_access;
    if (access && access.roles) {
      isResearch = access.roles.indexOf('research') !== -1;
    }

    const scriptRequest = await this.prisma.script.findUnique({
      where: {
        id: scriptId,
      },
      select: {
        name: true,
        mapping: true,
        Analysis: {
          select: {
            id: true,
            UserRequest: {
              select: {
                Project: {
                  select: {
                    ConnectionRequest: {
                      select: {
                        atlasId: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    const sourceId =
      scriptRequest.Analysis.UserRequest.Project.ConnectionRequest.atlasId;
    const params = {
      query: `from archetype where instance.__guid = "${sourceId}" and __state = "ACTIVE" and is_active = true`,
    };

    const result = await this.atlas.get('/search/dsl', params);

    const archetypeId = result.entities[0].guid;

    const archetypeEntity = await this.atlas.get(`/entity/guid/${archetypeId}`);

    const csvNames = [];

    for (const key in archetypeEntity.referredEntities) {
      const entity = archetypeEntity.referredEntities[key];

      if (
        entity.typeName == 'archetype_category' &&
        entity.status == 'ACTIVE'
      ) {
        if (
          entity.relationshipAttributes.permissions === undefined ||
          entity.relationshipAttributes.permissions.length === 0
        ) {
          continue;
        }

        let permissionName = 'permission_performAnalysis';
        if (isResearch) {
          permissionName = `${permissionName}@research`;
        }

        const hasPerformAnalysis =
          entity.relationshipAttributes.permissions.some(
            (permission) => permission.qualifiedName == permissionName,
          );

        if (hasPerformAnalysis) {
          csvNames.push(entity.attributes.name);
        }
      }
    }

    const script = await this.fileStorage.getFileUrl(
      'script',
      `${scriptRequest.Analysis.id}/${scriptRequest.name}`,
    );

    return {
      script: script,
      mapping: scriptRequest.mapping,
      csv: csvNames,
    };
  }

  async addScriptMapping(scriptId: string, mapping: string) {
    const parsed = JSON.parse(mapping);
    let hasNull = false;
    for (const value of Object.values(parsed)) {
      if (value === null) {
        hasNull = true;
        break;
      }
    }

    if (hasNull) {
      return await this.prisma.script.update({
        where: {
          id: scriptId,
        },
        data: {
          mapping: parsed,
          status: 4,
          statusMsg:
            'Incomplete upload settings. Please check your upload settings to proceed.',
        },
      });
    }

    const request = await this.prisma.script.findUnique({
      where: {
        id: scriptId,
      },
      select: {
        name: true,
        mapping: true,
        Analysis: {
          select: {
            id: true,
            UserRequest: {
              select: {
                Project: {
                  select: {
                    ConnectionRequest: {
                      select: {
                        atlasId: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    await this.dataProcess.preprocessScript(
      request.Analysis.UserRequest.Project.ConnectionRequest.atlasId,
      request.Analysis.id,
      { id: scriptId, name: request.name, mapping: parsed },
    );

    await this.prisma.script.update({
      where: {
        id: scriptId,
      },
      data: {
        mapping: parsed,
        status: 1,
        statusMsg: 'Script checking in progress.',
      },
    });

    await this.dataProcess.runScript(
      request.Analysis.id,
      request.name,
      scriptId,
    );
  }
}

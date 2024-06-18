import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { Request } from 'express';
import { ScriptService } from 'src/script/script.service';
import { DatabaseSourceService } from 'src/database_source/database_source.service';

@Injectable()
export class DatasetService {
  constructor(
    private prisma: PrismaService,
    private script: ScriptService,
    private databaseSource: DatabaseSourceService,
  ) {}

  async list(request: Request) {
    const userId = request.auth.payload.sub;
    const requestList = await this.prisma.userRequest.findMany({
      where: {
        requestor: userId,
        status: 3,
      },
      include: {
        Project: true,
      },
    });

    const filteredList = requestList.map(async (request) => {
      return {
        id: request.id,
        projectId: request.Project.id,
        projectCustomId: request.Project.customId,
        projectName: request.Project.name,
        connectDate: request.completeDate,
      };
    });

    const result = await Promise.all(filteredList);
    return result;
  }

  async analysisList(userRequestId: string) {
    this.getColumns(userRequestId);
    const requestList = await this.prisma.analysis.findMany({
      where: {
        userRequestId: userRequestId,
      },
      select: {
        id: true,
        name: true,
        createdDate: true,
        lastUpdated: true,
        lastUpdatedUser: true,
      },
    });

    return requestList;
  }

  async createAnalysis(request: Request, userRequestId: string, name: string) {
    await this.prisma.analysis.create({
      data: {
        userRequestId: userRequestId,
        name: name,
        lastUpdatedUser:
          request.auth.payload.given_name +
          ' ' +
          request.auth.payload.family_name,
      },
    });

    return name;
  }

  async uploadScript(
    request: Request,
    analysisId: string,
    file: Express.Multer.File,
  ) {
    await this.prisma.script.create({
      data: {
        analysisId: analysisId,
        name: file.originalname,
        status: 1,
        statusMsg: 'Script checking in progress',
        lastUpdatedUser:
          request.auth.payload.given_name +
          ' ' +
          request.auth.payload.family_name,
        script: file.buffer,
      },
    });

    // const result = await this.script.runScript(file.path);
    // console.log(result);
    return file.buffer;
  }

  async analysisDetails(analysisId: string) {
    return await this.prisma.analysis.findUnique({
      where: {
        id: analysisId,
      },
      select: {
        id: true,
        name: true,
        description: true,
        Script: true,
      },
    });
  }

  async deleteScript(scriptId: string) {
    await this.prisma.script.delete({
      where: {
        id: scriptId,
      },
    });

    return scriptId;
  }

  async getColumns(userRequestId: string) {
    const request = await this.prisma.userRequest.findUnique({
      where: {
        id: userRequestId,
      },
      select: {
        Project: {
          select: {
            id: true,
          },
        },
      },
    });

    return await this.databaseSource.columns(request.Project.id);
  }
}

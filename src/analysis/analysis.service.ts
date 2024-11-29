import { Injectable } from '@nestjs/common';
import { Request } from 'express';
import { DatabaseService } from 'src/database/database.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { StandardAnalysisService } from 'src/standard_analysis/standard_analysis.service';
import { DescriptiveDto } from './dto';

@Injectable()
export class AnalysisService {
  constructor(
    private prisma: PrismaService,
    private analysis: StandardAnalysisService,
    private database: DatabaseService,
  ) {}

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

  async descriptiveAnalysis(dto: DescriptiveDto) {
    const request = await this.prisma.userRequest.findUnique({
      where: {
        id: dto.id,
      },
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
    });

    await this.database.connect(request.Project.ConnectionRequest.atlasId);
    await this.database.initialize();
    this.analysis.setDatabaseService(this.database);

    const result = [];
    for (const variable of dto.variables) {
      let analyzedRes = {};
      if (variable.type === 'ord') {
        analyzedRes = await this.analysis.getOrdinalAnalysis(
          variable.table,
          variable.name,
          dto.calculate,
        );
      } else if (variable.type === 'nom') {
        analyzedRes = await this.analysis.getNominalAnalysis(
          variable.table,
          variable.name,
        );
      }
      if (Object.keys(analyzedRes).length !== 0) {
        analyzedRes['name'] = variable.name;
        analyzedRes['type'] = variable.type;
        result.push(analyzedRes);
      }
    }

    this.database.disconnect();

    return Promise.all(result)
      .then(() => {
        return result;
      })
      .catch((error) => {
        console.error(error);
      });
  }

  async deleteAnalysis(analysisId: string) {
    const deleteScript = this.prisma.script.deleteMany({
      where: {
        analysisId: analysisId,
      },
    });

    const deleteAnalysis = this.prisma.analysis.delete({
      where: {
        id: analysisId,
      },
    });

    await this.prisma.$transaction([deleteScript, deleteAnalysis]);
  }
}

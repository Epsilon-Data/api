import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { DatasourceService } from 'src/datasource/datasource.service';
import { DataProcessingService } from 'src/data_processing/data_processing.service';
import { FileStorageService } from 'src/file_storage/file_storage.service';
import { format } from 'fast-csv';
import { PassThrough } from 'stream';

@Injectable()
export class DatasetService {
  constructor(
    private prisma: PrismaService,
    private databaseSource: DatasourceService,
    private dataProcess: DataProcessingService,
    private fileStorage: FileStorageService,
  ) {}

  // async list(userId: string) {
  //   const requestList = await this.prisma.analysis.findMany({
  //     where: {
  //       request: {
  //         requestorId: userId,
  //         status: 3,
  //       },
  //     },
  //     select: {
  //       requestId: true,
  //       request: {
  //         select: {
  //           createdDate: true,
  //         },
  //       },
  //       project: {
  //         select: {
  //           projectId: true,
  //           customId: true,
  //           name: true,
  //         },
  //       },
  //     },
  //   });

  //   const filteredList = requestList.map(async (request) => {
  //     return {
  //       id: request.requestId,
  //       projectId: request.project.projectId,
  //       projectCustomId: request.project.customId,
  //       projectName: request.project.name,
  //       connectDate: request.request.createdDate,
  //     };
  //   });

  //   const result = await Promise.all(filteredList);
  //   return result;
  // }

  // async analysisList(userRequestId: string) {
  //   const requestList = await this.prisma.analysis.findMany({
  //     where: {
  //       userRequestId: userRequestId,
  //     },
  //     select: {
  //       id: true,
  //       name: true,
  //       createdDate: true,
  //       lastUpdated: true,
  //       lastUpdatedUser: true,
  //     },
  //   });

  //   return requestList;
  // }

  async getColumns(userRequestId: string) {
    const request = await this.prisma.analysis.findUnique({
      where: {
        requestId: userRequestId,
      },
      select: {
        project: {
          select: {
            projectId: true,
          },
        },
      },
    });

    return await this.databaseSource.columns(request.project.projectId);
  }

  async downloadDataset(userRequestId: string) {
    const userRequest = await this.prisma.analysis.findUnique({
      where: {
        requestId: userRequestId,
      },
      select: {
        project: {
          select: {
            connection: {
              select: {
                requestId: true,
                atlasId: true,
              },
            },
          },
        },
      },
    });

    const sourceId = userRequest.project.connection.requestId;
    const atlasId = userRequest.project.connection.atlasId;

    const result = await this.dataProcess.generateDownloadDataset(
      sourceId,
      atlasId,
    );

    const zipFilePath = await this.dataProcess.createAndZipCsvFiles(
      result.data,
    );

    return zipFilePath;
  }

  // async getReport(scriptId: string) {
  //   const script = await this.prisma.script.findUnique({
  //     where: {
  //       id: scriptId,
  //     },
  //     select: {
  //       name: true,
  //       Analysis: {
  //         select: {
  //           id: true,
  //         },
  //       },
  //     },
  //   });

  //   const analysisId = script.Analysis.id;

  //   const url = await this.fileStorage.getFileUrl(
  //     'report',
  //     `${analysisId}/${script.name}`.replace('.R', '.html'),
  //   );

  //   return url;
  // }

  // async getDatasetsByUser(userId: string, isSynthetic: boolean) {
  //   const requestList = await this.prisma.analysis.findMany({
  //     where: {
  //       request: {
  //         requestorId: userId,
  //         status: 3,
  //       },
  //     },
  //     include: {
  //       project: {
  //         include: {
  //           connection: true,
  //         },
  //       },
  //     },
  //   });

  //   const datasetList = [];

  //   for (const request of requestList) {
  //     const sourceId = request.project.connection.requestId;
  //     const atlasId = request.project.connection.atlasId;

  //     let result = { data: [], csvColumns: [] };

  //     if (isSynthetic) {
  //       result = await this.dataProcess.generateDownloadDataset(
  //         sourceId,
  //         atlasId,
  //       );
  //     } else {
  //       result = await this.dataProcess.generateDataset(sourceId, atlasId);
  //     }

  //     if (result.data.length === 0) {
  //       continue;
  //     }

  //     const datasetWithLinks = await this.uploadDatasets(
  //       result.data,
  //       'temp',
  //       userId,
  //     );

  //     datasetList.push({
  //       projectId: request.project.projectId,
  //       sourceId: sourceId,
  //       atlasId: atlasId,
  //       csvColumns: result.csvColumns,
  //       dataset: datasetWithLinks,
  //     });
  //   }

  //   return datasetList;
  // }

  private async uploadDatasets(
    datasets: { filename: string; data: any[]; link?: string }[],
    bucketName: string,
    userId: string,
  ): Promise<{ filename: string; data: any[]; link?: string }[]> {
    await this.fileStorage.createBucketIfNotExists(bucketName);
    await Promise.all(
      datasets.map(async (dataset) => {
        const { filename, data } = dataset;

        const csvStream = format({ headers: true });
        const passThroughStream = new PassThrough();

        csvStream.pipe(passThroughStream);
        data.forEach((row) => csvStream.write(row));
        csvStream.end();

        await this.fileStorage.putFile(bucketName, `${userId}-${filename}`, {
          buffer: passThroughStream.read(),
          mimetype: 'text/csv',
        } as Express.Multer.File);

        dataset.link = await this.fileStorage.getFileUrl(
          bucketName,
          `${userId}-${filename}`,
        );
      }),
    );

    return datasets;
  }
}

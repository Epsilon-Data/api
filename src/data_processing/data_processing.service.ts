import { Injectable } from '@nestjs/common';
import { CassandraService } from 'src/cassandra/cassandra.service';
import { exec } from 'child_process';
import { PrismaService } from 'src/prisma/prisma.service';
import { DatabaseService } from 'src/database/database.service';
import * as fs from 'fs';
import * as yaml from 'js-yaml';
import { FileStorageService } from 'src/file_storage/file_storage.service';
import { parse } from 'csv-parse';
import { Readable } from 'stream';
import { createObjectCsvWriter } from 'csv-writer';
import * as archiver from 'archiver';
import { join } from 'path';

type Row = {
  table_name: string;
  columns: string[];
  type: 'FOREIGN KEY' | 'PRIMARY KEY' | 'UNIQUE';
};

@Injectable()
export class DataProcessingService {
  private script;
  constructor(
    private prisma: PrismaService,
    private cassandra: CassandraService,
    private database: DatabaseService,
    private fileStorage: FileStorageService,
  ) {}

  async runScript(userPath: string): Promise<string> {
    return userPath;
  }

  async preprocessScript(
    userPath: string,
    sourceId: string,
    scriptId: string,
  ): Promise<string> {
    const query = `SELECT type, host, port, username, password, name, column_mapping FROM sources WHERE id = ?`;
    const queryParams = [sourceId];
    const result = await this.cassandra.query(query, queryParams);

    const sourceDetails = {
      ...result[0],
      host:
        result[0].host == 'host.docker.internal' ? 'localhost' : result[0].host,
    };

    const scriptPath = process.cwd() + '/scripts/process.py';

    if (result[0].column_mapping) {
      await this.prisma.script.update({
        where: {
          id: scriptId,
        },
        data: {
          status: 2,
          statusMsg:
            'No columns allowed for analysis. Contact data owner to update permissions or column.',
        },
      });
    } else {
      return new Promise((resolve, reject) => {
        const args = [
          process.cwd() + '/' + userPath,
          JSON.stringify(sourceDetails),
          JSON.stringify(result[0].column_mapping),
        ];
        const command = `python3 '${scriptPath}' '${args.join("' '")}'`;

        exec(command, (error, stdout, stderr) => {
          if (error) {
            reject(`Error: ${stderr}`);
          } else {
            resolve(stdout);
          }
        });
      });
    }
  }

  async extractCsvVariables(buffer: Buffer): Promise<string[]> {
    const fileContent = buffer.toString('utf-8');
    const csvImportPattern =
      /(\w+)\s*<-\s*(read\.csv|read_csv|read\.csv2)\(.+\)/g;
    const matches = [...fileContent.matchAll(csvImportPattern)];
    return matches.map((match) => match[1]);
  }

  async dataSynthesis(sourceId: string) {
    const scriptPath = process.cwd() + '/scripts/synthesis.py';

    const constraintsQuery = `SELECT table_name, columns, type FROM constraints WHERE source_id = ? ALLOW FILTERING`;
    const constraintsQueryParams = [sourceId];
    const constraintsResult = await this.cassandra.query(
      constraintsQuery,
      constraintsQueryParams,
    );

    const tablesQuery = `SELECT table_name FROM tables WHERE source_id = ? ALLOW FILTERING`;
    const tablesQueryParams = [sourceId];
    const tablesResult = await this.cassandra.query(
      tablesQuery,
      tablesQueryParams,
    );

    const tableNames = tablesResult.map((table) => table.table_name);
    const foreignKeys = this.getForeignKeys(constraintsResult);
    const primaryKeys = this.getPrimaryKeys(constraintsResult);

    const dbDetails = await this.database.connect(sourceId);

    if (dbDetails) {
      new Promise((resolve, reject) => {
        const args = {
          dbDetails,
          sourceId,
          tableNames,
          foreignKeys,
          primaryKeys,
        };
        const yamlFilePath = `${process.cwd()}/script_args.yaml`;
        fs.writeFileSync(yamlFilePath, yaml.dump(args));

        const command = `python3 '${scriptPath}' '${yamlFilePath}'`;

        exec(command, (error, stdout, stderr) => {
          if (error) {
            reject(`Error: ${stderr}`);
          } else {
            resolve(stdout);
          }
        });
      });
    }
  }

  private getForeignKeys(data: Row[]): { [key: string]: string[] } {
    const foreignKeys: { [key: string]: string[] } = {};

    data.forEach((row) => {
      if (row.type === 'FOREIGN KEY' || row.type === 'UNIQUE') {
        if (!foreignKeys[row.table_name]) {
          foreignKeys[row.table_name] = [];
        }
        const checkSet = new Set(foreignKeys[row.table_name]);
        row.columns.forEach((item) => {
          if (!checkSet.has(item)) {
            foreignKeys[row.table_name].push(item);
            checkSet.add(item); // Update the set to include the newly added item
          }
        });
      }
    });

    return foreignKeys;
  }

  private getPrimaryKeys(data: Row[]): { [key: string]: string[] } {
    const primaryKeys: { [key: string]: string[] } = {};

    data.forEach((row) => {
      if (row.type === 'PRIMARY KEY') {
        primaryKeys[row.table_name] = row.columns;
      }
    });

    return primaryKeys;
  }

  private async createAndZipCsvFiles(
    files: { filename: string; data: any[] }[],
  ): Promise<string> {
    const csvFolderPath = 'csv_files';
    const zipFilePath = 'dataset.zip';

    if (!fs.existsSync(csvFolderPath)) {
      fs.mkdirSync(csvFolderPath);
    }

    // Create CSV files
    for (const file of files) {
      if (Object.keys(file.data[0]).length === 0) continue;
      const csvWriter = createObjectCsvWriter({
        path: join(csvFolderPath, file.filename),
        header: await this.extractHeaders(file.data),
      });
      await csvWriter.writeRecords(file.data);
    }

    // Create a zip file
    const output = fs.createWriteStream(zipFilePath);
    const archive = archiver('zip', {
      zlib: { level: 9 },
    });

    return new Promise((resolve, reject) => {
      output.on('close', () => resolve(zipFilePath));
      archive.on('error', (err) => reject(err));

      archive.pipe(output);
      archive.directory(csvFolderPath, false);
      archive.finalize();
    });
  }

  private async extractHeaders(data: any[]): Promise<any[]> {
    const headers = Object.keys(data[0]);
    return headers.map((header) => ({ id: header, title: header }));
  }

  private async parseJsonStream(stream: Readable): Promise<any> {
    return new Promise((resolve, reject) => {
      let jsonString = '';
      stream
        .on('data', (chunk) => {
          jsonString += chunk;
        })
        .on('end', () => {
          try {
            const jsonData = JSON.parse(jsonString);
            resolve(jsonData);
          } catch (err) {
            reject(err);
          }
        })
        .on('error', reject);
    });
  }

  private async parseCsvStream(stream: Readable): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const results: any[] = [];
      stream
        .pipe(parse())
        .on('data', (data) => {
          results.push(data);
        })
        .on('end', () => resolve(results))
        .on('error', reject);
    });
  }

  async generateDownloadDataset(
    sourceId: string,
    isResearch: boolean,
  ): Promise<string> {
    const bucket = 'synthetic';
    const query = `SELECT template, column_mapping, permissions FROM sources WHERE id = ?`;
    const queryParams = [sourceId];
    const result = await this.cassandra.query(query, queryParams);

    if (
      result[0].template &&
      result[0].permissions &&
      result[0].column_mapping
    ) {
      const template = JSON.parse(result[0].template);
      const permissions = JSON.parse(result[0].permissions);
      const columnMapping = JSON.parse(result[0].column_mapping);

      const mappingStream = await this.fileStorage.getFile(
        bucket,
        `${sourceId}/mapping.json`,
      );
      const csvMapping = await this.parseJsonStream(mappingStream);
      const activePermission = permissions.find((item) => item.active);
      if (activePermission) {
        const corrTemplate = template.find(
          (item) => item.id === activePermission.templateId,
        );

        const corrColumnMapping = columnMapping.find(
          (item) => item.templateId === activePermission.templateId,
        );

        if (corrTemplate && corrColumnMapping) {
          if (isResearch) {
            const settings = activePermission.settings.find(
              (item) => item.role == 'research',
            );

            const access = settings.access.filter((access) =>
              access.permissions.includes('performAnalysis'),
            );

            const getColumns = (nodeId: string) => {
              const node = corrColumnMapping.mapping.find(
                (map) => map.nodeId === nodeId,
              );
              return node ? node.columns : [];
            };

            const createCsvData = async (
              csvFileName: string,
              tableData: { [table: string]: any[] },
              columns: { name: string; table: string }[],
            ) => {
              // Extract the required columns
              const combinedData: any[] = [];

              const numRows = 200;
              const columnIndex = {};
              for (let i = 0; i < numRows; i++) {
                const row: any = {};
                for (const col of columns) {
                  if (i == 0) {
                    columnIndex[col.name] = tableData[col.table][i].findIndex(
                      (item) => item === col.name,
                    );
                  } else {
                    if (tableData[col.table][i]) {
                      const index = columnIndex[col.name];
                      row[col.name] = tableData[col.table][i][index];
                    } else {
                      row[col.name] = '';
                    }
                  }
                }

                if (i != 0) {
                  combinedData.push(row);
                }
              }

              return { filename: csvFileName, data: combinedData };
            };

            const tableData: { [table: string]: any[] } = {};
            for (const table of Object.keys(csvMapping)) {
              const csvFile = csvMapping[table];
              const csvStream = await this.fileStorage.getFile(
                bucket,
                `${sourceId}/synth-${csvFile}.csv`,
              );
              tableData[table] = await this.parseCsvStream(csvStream);
            }

            const downloadData = [];
            for (const node of access) {
              if (node.nodeType !== 'category') continue;
              const categoryColumns = getColumns(node.nodeId);
              const connectedEdges = corrTemplate.edges.filter(
                (edge) =>
                  edge.source === node.nodeId || edge.target === node.nodeId,
              );
              let subcategoryNodes = connectedEdges.map((edge) =>
                edge.source === node.nodeId ? edge.target : edge.source,
              );

              if (subcategoryNodes.length > 2) {
                subcategoryNodes = subcategoryNodes.filter((target) =>
                  access.some((item) => item.nodeId === target),
                );
              }

              const subcategoryColumns = subcategoryNodes.flatMap(getColumns);

              const allColumns = [...categoryColumns, ...subcategoryColumns];

              const csvFileName = `${node.nodeName}.csv`;

              const csvData = await createCsvData(
                csvFileName,
                tableData,
                allColumns,
              );

              downloadData.push(csvData);
            }

            const zipFilePath = await this.createAndZipCsvFiles(downloadData);

            return zipFilePath;
          }
        }
      }
    }
  }
}

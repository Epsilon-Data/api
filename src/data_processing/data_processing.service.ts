import { Injectable } from '@nestjs/common';
import { AtlasService } from 'src/atlas/atlas.service';
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
import * as path from 'path';

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
    private atlas: AtlasService,
    private database: DatabaseService,
    private fileStorage: FileStorageService,
  ) {}

  async runScript(analysisId: string, scriptName: string, scriptId: string) {
    const bucket = 'script';
    const resBucket = 'script-result';
    const scriptStream = await this.fileStorage.getFile(
      bucket,
      `${analysisId}/prepend-${scriptName}`,
    );

    const script = await this.parseScriptStream(scriptStream);

    const outputFolder = process.cwd() + `/temp_files`;

    const scriptPath = `${outputFolder}/${scriptId}.R`;
    fs.writeFileSync(scriptPath, script);

    // Path for the output HTML file
    const outputPath = `${outputFolder}/${scriptId}.html`;

    const args = {
      scriptPath,
      outputPath,
      scriptName,
    };

    const yamlFilePath = `${process.cwd()}/script_args.yaml`;
    fs.writeFileSync(yamlFilePath, yaml.dump(args));

    await new Promise((resolve) => {
      exec(
        `Rscript ${process.cwd()}/scripts/execute.R ${yamlFilePath}`,
        async (error) => {
          if (error) {
            const statusMessage = `Error: ${error.message}`;
            await this.prisma.script.update({
              where: {
                id: scriptId,
              },
              data: {
                status: 2,
                statusMsg: statusMessage,
              },
            });
          } else {
            await this.prisma.script.update({
              where: {
                id: scriptId,
              },
              data: {
                status: 3,
                statusMsg: 'Script validated successfully',
              },
            });
            const htmlContent = fs.readFileSync(outputPath, 'utf-8');
            const multerFile = this.createMulterFile(outputPath, htmlContent);
            await this.fileStorage.putFile(
              resBucket,
              `${analysisId}/${scriptName}`.replace('.R', '.html'),
              multerFile,
            );

            fs.unlinkSync(scriptPath);
            fs.unlinkSync(outputPath);
            resolve(htmlContent);
          }
        },
      );
    });
  }

  async preprocessScript(
    sourceId: string,
    analysisId: string,
    scriptDetails: { id: string; name: string; mapping: any },
  ): Promise<string> {
    const scriptPath = process.cwd() + '/scripts/process.py';

    const dbResult = await this.atlas.get('/entity/guid/' + sourceId);

    const instanceId = dbResult.instance.guid;

    const dsResult = await this.atlas.get('/entity/guid/' + instanceId);

    // TODO: get password
    const dbDetails = {
      type: dsResult.entity.attributes.rdbms_type,
      host:
        dsResult.entity.attributes.hostname == 'host.docker.internal'
          ? 'localhost'
          : dsResult.entity.attributes.hostname,
      port: dsResult.entity.attributes.port,
      username: dbResult.entity.attributes.owner,
      // password: result.password,
      name: dbResult.entity.attributes.name,
    };

    // TODO: get column_mapping, template, permissions
    if (!dbResult.column_mapping) {
      await this.prisma.script.update({
        where: {
          id: scriptDetails.id,
        },
        data: {
          status: 2,
          statusMsg:
            'No columns allowed for analysis. Contact data owner to update permissions or column.',
        },
      });
    } else {
      const template = JSON.parse(dbResult.template);
      const permissions = JSON.parse(dbResult.permissions);
      const columnMapping = JSON.parse(dbResult.column_mapping);
      const role = 'research';

      const csvColumns = await this.csvColumns(
        template,
        permissions,
        columnMapping,
        role,
      );

      return new Promise((resolve, reject) => {
        const args = {
          dbDetails,
          analysisId,
          scriptDetails,
          csvColumns,
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

  async extractCsvVariables(script: string): Promise<string[]> {
    const csvImportPattern =
      /(\w+)\s*<-\s*(read\.csv|read_csv|read\.csv2)\(.+\)/g;
    const matches = [...script.matchAll(csvImportPattern)];
    return matches.map((match) => match[1]);
  }

  async dataSynthesis(sourceId: string) {
    const scriptPath = process.cwd() + '/scripts/synthesis.py';

    //TODO: get constraints: table_name, column, type
    const constraintsResult = await this.atlas.get('/entity/guid/' + sourceId);

    //TODO: get tables: table_name
    const tablesResult = await this.atlas.get('/entity/guid/' + sourceId);

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

  private async parseScriptStream(stream: Readable): Promise<string> {
    return new Promise((resolve, reject) => {
      const chunks: any[] = [];
      stream.on('data', (chunk) => chunks.push(chunk));
      stream.on('error', (err) => reject(err));
      stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    });
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

  async generateDownloadDataset(sourceId: string): Promise<string> {
    const bucket = 'synthetic';

    //TODO: get sources: template, column_mapping, permissions
    const result = await this.atlas.get('/entity/guid/' + sourceId);

    if (
      result[0].template &&
      result[0].permissions &&
      result[0].column_mapping
    ) {
      const template = JSON.parse(result[0].template);
      const permissions = JSON.parse(result[0].permissions);
      const columnMapping = JSON.parse(result[0].column_mapping);
      const role = 'research';

      const csvColumns = await this.csvColumns(
        template,
        permissions,
        columnMapping,
        role,
      );

      const mappingStream = await this.fileStorage.getFile(
        bucket,
        `${sourceId}/mapping.json`,
      );
      const csvMapping = await this.parseJsonStream(mappingStream);

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
      for (const csvName of Object.keys(csvColumns)) {
        const corrCols = csvColumns[csvName];

        const csvFileName = `${csvName}.csv`;

        const csvData = await createCsvData(csvFileName, tableData, corrCols);

        downloadData.push(csvData);
      }

      const zipFilePath = await this.createAndZipCsvFiles(downloadData);

      return zipFilePath;
    }
  }

  private async csvColumns(
    template,
    permissions,
    columnMapping,
    role,
  ): Promise<any> {
    const activePermission = permissions.find((item) => item.active);
    if (activePermission) {
      const corrTemplate = template.find(
        (item) => item.id === activePermission.templateId,
      );

      const corrColumnMapping = columnMapping.find(
        (item) => item.templateId === activePermission.templateId,
      );

      if (corrTemplate && corrColumnMapping) {
        const settings = activePermission.settings.find(
          (item) => item.role == role,
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

        const output = {};
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

          output[`${node.nodeName}`] = allColumns;
        }
        return output;
      }
    }
    return null;
  }

  async parseCoverStream(stream: Readable): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      let buffer = '';
      stream
        .on('data', (chunk) => {
          buffer += chunk;
        })
        .on('end', () => {
          resolve(Buffer.from(buffer));
        })
        .on('error', reject);
    });
  }

  private createMulterFile(
    filePath: string,
    content: string,
  ): Express.Multer.File {
    const fileBuffer = Buffer.from(content, 'utf-8');
    const multerFile: Express.Multer.File = {
      fieldname: 'file',
      originalname: path.basename(filePath),
      encoding: '7bit',
      mimetype: 'text/html',
      size: fileBuffer.length,
      buffer: fileBuffer,
      destination: '',
      filename: path.basename(filePath),
      path: filePath,
      stream: fs.createReadStream(filePath),
    };
    return multerFile;
  }
}

import { Injectable } from '@nestjs/common';
import { CassandraService } from 'src/cassandra/cassandra.service';
import { exec } from 'child_process';
import { PrismaService } from 'src/prisma/prisma.service';
import { DatabaseService } from 'src/database/database.service';
import * as fs from 'fs';
import * as archiver from 'archiver';

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
    const scriptPath = process.cwd() + '/scripts/data_synthesis.py';

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

    await this.database.connect(sourceId);
    await this.database.initialize();
    const folder = await this.database.exportAllTablesToCsv(tableNames);
    this.database.disconnect();

    if (folder) {
      new Promise((resolve, reject) => {
        const args = [
          `${process.cwd()}/csv/${folder}`,
          JSON.stringify(tableNames),
          JSON.stringify(foreignKeys),
          JSON.stringify(primaryKeys),
        ];
        const command = `python3 '${scriptPath}' '${args.join("' '")}'`;
        console.log(command);

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

  async compressFolder(folderPath: string): Promise<string> {
    const outputFilePath = `${folderPath}/dataset.zip`;
    const output = fs.createWriteStream(outputFilePath);
    const archive = archiver('zip', {
      zlib: { level: 9 }, // Compression level
    });

    return new Promise((resolve, reject) => {
      output.on('close', () => {
        resolve(outputFilePath);
      });

      archive.on('error', (err) => {
        reject(err);
      });

      archive.pipe(output);

      archive.directory(`${folderPath}/download`, false);

      archive.finalize();
    });
  }
}

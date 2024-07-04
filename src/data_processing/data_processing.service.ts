import { Injectable } from '@nestjs/common';
import { CassandraService } from 'src/cassandra/cassandra.service';
import { exec } from 'child_process';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class DataProcessingService {
  private script;
  constructor(
    private prisma: PrismaService,
    private cassandra: CassandraService,
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
}

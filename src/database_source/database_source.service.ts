import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { TemplateDto } from './dto';
import { CassandraService } from 'src/cassandra/cassandra.service';
import { Request } from 'express';

@Injectable()
export class DatabaseSourceService {
  constructor(
    private prisma: PrismaService,
    private cassandra: CassandraService,
  ) {}
  async list(request: Request) {
    const userId = request.auth.payload.sub;
    const requestList = await this.prisma.connectionRequest.findMany({
      where: {
        requestor: userId,
        status: 3,
      },
      include: {
        Project: true,
      },
    });

    const filteredList = requestList.map(async (request) => {
      const project = {
        projectId: request.Project.id,
        projectName: request.Project.name,
      };

      const query = `SELECT name, connect_date, status FROM sources WHERE id = ?`;
      const queryParams = [request.dbId];
      const result = await this.cassandra.executeQuery(query, queryParams);

      const researcherDb = result[0]
        ? {
            databaseName: result[0].name,
            connectDate: result[0].connect_date,
            sourceStatus: result[0].status,
          }
        : null;
      if (researcherDb) {
        return {
          ...project,
          ...researcherDb,
        };
      }
    });

    return await Promise.all(filteredList);
  }

  async getProjectName(projectId: string) {
    return await this.prisma.project.findUnique({
      where: {
        id: projectId,
      },
      select: {
        name: true,
      },
    });
  }

  async summary(projectId: string) {
    const dbId = this.findDbId(projectId);
    console.log(dbId);
    const details = this.getSampleData();

    const overall = {
      dateCreated: details.dateCreated,
      schemaCount: details.schemas.length,
      totalTableCount: details.schemas.reduce((total, schema) => {
        return total + schema.tables.length;
      }, 0),
      totalColCount: details.schemas.reduce((total, schema) => {
        return (
          total +
          schema.tables.reduce((acc, table) => acc + table.columns.length, 0)
        );
      }, 0),
    };
    const diagram = this.convertToDiagramCode(details.schemas);
    return { overall: overall, diagram: diagram };
  }

  async tables(projectId: string) {
    const dbId = this.findDbId(projectId);
    console.log(dbId);
    const details = this.getSampleData();
    const resultArray = [];

    details.schemas.forEach((schema) => {
      schema.tables.forEach((table) => {
        const tableInfo = {
          name: table.name,
          colCount: table.columns.length,
          schema: schema.name,
          columns: table.columns.map((column) => ({
            name: column.name,
            type: column.type,
            nullable: column.nullable,
            primary: column.primary,
          })),
        };
        resultArray.push(tableInfo);
      });
    });

    return resultArray;
  }

  async addTemplate(template: TemplateDto) {
    const dbId = this.findDbId(template.projectId);
    console.log(dbId);
    console.log(template.template);
  }

  async columns(projectId: string) {
    const dbId = this.findDbId(projectId);
    console.log(dbId);
    const details = this.getSampleData();

    const columnNames: string[] = [];

    details.schemas.forEach((schema) => {
      schema.tables.forEach((table) => {
        table.columns.forEach((column) => {
          columnNames.push(column.name);
        });
      });
    });

    return columnNames;
  }

  getSampleData() {
    return {
      dateCreated: new Date(),
      schemas: [
        {
          name: 'test1',
          desc: '',
          tables: [
            {
              name: 'health_round_bridge',
              columns: [
                {
                  name: 'public.health_round_id',
                  type: 'integer',
                  nullable: false,
                  primary: true,
                },
                {
                  name: 'person_id',
                  type: 'integer',
                  nullable: false,
                  primary: false,
                },
                {
                  name: 'searchopt',
                  type: 'smallint',
                  nullable: true,
                  primary: false,
                },
                {
                  name: 'searchopt1_barcode',
                  type: 'varchar',
                  nullable: true,
                  primary: false,
                },
                {
                  name: 'searchopt1_list',
                  type: 'integer',
                  nullable: true,
                  primary: false,
                },
              ],
            },
            {
              name: 'something',
              columns: [
                {
                  name: 'id',
                  type: 'integer',
                  nullable: false,
                  primary: true,
                },
              ],
            },
          ],
          relations: [
            {
              child: {
                table: 'health_round_bridge',
                column: 'person_id',
                cardinality: 'only one',
              },
              parent: {
                table: 'something',
                column: 'id',
                cardinality: 'one or more',
              },
              ref: 'has',
            },
          ],
        },
        {
          name: 'test2',
          desc: '',
          tables: [
            {
              name: 'another',
              columns: [
                {
                  name: 'another_id',
                  type: 'integer',
                  nullable: false,
                  primary: true,
                },
                {
                  name: 'blah',
                  type: 'string',
                  nullable: true,
                  primary: false,
                },
              ],
            },
          ],
          relations: [],
        },
      ],
    };
  }

  convertToDiagramCode(schemas: any): string {
    let diagramCode = 'erDiagram ';

    schemas.forEach((schema) => {
      schema.tables.forEach((table) => {
        const formattedTableName = this.formatDbNames(table.name);
        diagramCode += `${formattedTableName}["${schema.name}.${table.name}"] {`;

        table.columns.forEach((column) => {
          const formattedColName = this.formatDbNames(column.name);
          diagramCode += `  ${column.type} ${formattedColName}`;
          if (column.primary) {
            diagramCode += ' PK';
          } else {
            const matchingRelation = schema.relations.find(
              (relation) =>
                relation.child.table === table.name &&
                relation.child.column === column.name,
            );
            if (matchingRelation) {
              diagramCode += ' FK';
            }
          }
        });

        diagramCode += ' } ';
      });

      schema.relations.forEach((relation) => {
        const childTableName = this.formatDbNames(relation.child.table);
        const parentTableName = this.formatDbNames(relation.parent.table);
        diagramCode += `${parentTableName} ${relation.child.cardinality} to ${relation.parent.cardinality} ${childTableName} : ${relation.ref} `;
      });
    });

    return diagramCode;
  }

  formatDbNames(name: string): string {
    const dotIndex = name.indexOf('.');
    if (dotIndex != -1) {
      return name.substring(dotIndex + 1);
    }
    return name;
  }

  async findDbId(projectId: string) {
    const request = await this.prisma.connectionRequest.findUnique({
      where: {
        projectId: projectId,
      },
      select: {
        dbId: true,
      },
    });
    return request.dbId;
  }
}

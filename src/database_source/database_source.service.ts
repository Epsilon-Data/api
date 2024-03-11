import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { PermissionsDto, TemplateDto } from './dto';
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
        projectCustomId: request.Project.customId,
        projectName: request.Project.name,
      };

      const query = `SELECT id, connect_date, status FROM sources WHERE name = ? LIMIT 1`;
      const queryParams = [request.dbName];
      const result = await this.cassandra.executeQuery(query, queryParams);

      if (result[0].status == 3 && !request.dbId) {
        await this.prisma.connectionRequest.update({
          where: {
            dbName: request.dbName,
          },
          data: {
            dbId: result[0].id,
          },
        });
      }

      const researcherDb = result[0]
        ? {
            databaseName: request.dbName,
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

  async getProjectId(projectId: string) {
    return await this.prisma.project.findUnique({
      where: {
        id: projectId,
      },
      select: {
        customId: true,
      },
    });
  }

  async summary(projectId: string) {
    const dbId = await this.findDbId(projectId);
    const tableQuery = `SELECT table_name FROM tables WHERE source_id = ? ALLOW FILTERING`;
    const tableQueryParams = [dbId];
    const tableResult = await this.cassandra.executeQuery(
      tableQuery,
      tableQueryParams,
    );

    const schemasSet = new Set<string>();

    tableResult.forEach((row) => {
      const tableNameParts = row.table_name.split('.');
      if (tableNameParts.length > 1) {
        schemasSet.add(tableNameParts[0]);
      }
    });

    const numSchemas = schemasSet.size;

    const columnQuery = `SELECT COUNT(*) FROM columns WHERE source_id = ? ALLOW FILTERING`;
    const columnQueryParams = [dbId];
    const columnResult = await this.cassandra.executeQuery(
      columnQuery,
      columnQueryParams,
    );

    const overall = {
      schemaCount: numSchemas,
      totalTableCount: tableResult.length,
      totalColCount: columnResult[0].count,
    };

    const diagram = await this.convertToDiagramCode(dbId);
    return { overall: overall, diagram: diagram };
  }

  async tables(projectId: string) {
    const dbId = await this.findDbId(projectId);
    const tablesQuery = `SELECT table_name FROM tables WHERE source_id = ? ALLOW FILTERING`;
    const tablesQueryParams = [dbId];
    const tablesResult = await this.cassandra.executeQuery(
      tablesQuery,
      tablesQueryParams,
    );

    const resultArray = [];
    for (const row of tablesResult) {
      const columnsQuery = `SELECT column_name, type, nullable FROM columns WHERE source_id = ? AND table_name = ? ALLOW FILTERING`;
      const columnsParam = [dbId, row.table_name];
      const columnsResult = await this.cassandra.executeQuery(
        columnsQuery,
        columnsParam,
      );

      const constraintsQuery = `SELECT columns FROM constraints WHERE source_id = ? AND table_name = ? AND type IN ('PRIMARY KEY', 'UNIQUE') ALLOW FILTERING`;
      const constraintsParam = [dbId, row.table_name];
      const constraintsResult = await this.cassandra.executeQuery(
        constraintsQuery,
        constraintsParam,
      );

      const [schemaName, tableName] = row.table_name.split('.');
      const tableInfo = {
        name: tableName,
        colCount: columnsResult.length,
        schema: schemaName,
        columns: columnsResult.map((column) => ({
          name: column.column_name,
          type: column.type,
          nullable: column.nullable,
          primary: constraintsResult.some((constraint) =>
            constraint.columns.includes(column.column_name),
          ),
        })),
      };
      resultArray.push(tableInfo);
    }

    return resultArray;
  }

  async addTemplate(template: TemplateDto) {
    const dbId = await this.findDbId(template.projectId);
    const query = `UPDATE sources SET template = ? WHERE id = ?`;
    const queryParams = [template.template, dbId];
    return await this.cassandra.executeQuery(query, queryParams);
  }

  async template(projectId: string) {
    const dbId = await this.findDbId(projectId);
    const query = `SELECT template FROM sources WHERE id = ?`;
    const queryParams = [dbId];
    const result = await this.cassandra.executeQuery(query, queryParams);
    return result[0].template;
  }

  async addColumnMapping(template: TemplateDto) {
    const dbId = await this.findDbId(template.projectId);
    const query = `UPDATE sources SET column_mapping = ? WHERE id = ?`;
    const queryParams = [template.columnMapping, dbId];
    return await this.cassandra.executeQuery(query, queryParams);
  }

  async columns(projectId: string) {
    const dbId = await this.findDbId(projectId);
    const query = `SELECT column_name FROM columns WHERE source_id = ? ALLOW FILTERING`;
    const queryParams = [dbId];

    const result = await this.cassandra.executeQuery(query, queryParams);

    return result.map((row: any) => row.column_name);
  }

  async permissions(projectId: string) {
    const dbId = await this.findDbId(projectId);
    const query = `SELECT permissions FROM sources WHERE id = ?`;
    const queryParams = [dbId];
    const result = await this.cassandra.executeQuery(query, queryParams);
    return result[0].permissions;
  }

  async addPermissions(permissions: PermissionsDto) {
    const dbId = await this.findDbId(permissions.projectId);
    const query = `UPDATE sources SET permissions = ? WHERE id = ?`;
    const queryParams = [permissions.permissions, dbId];
    return await this.cassandra.executeQuery(query, queryParams);
  }

  async convertToDiagramCode(dbId: string): Promise<string> {
    const query = `SELECT erd FROM sources WHERE id = ?`;
    const queryParams = [dbId];
    const result = await this.cassandra.executeQuery(query, queryParams);
    const diagramCode = result[0].erd.replace(
      /"FOREIGN KEY \(.*\) REFERENCES .*\(.*\) ON UPDATE CASCADE ON DELETE CASCADE"/g,
      '""',
    );
    return diagramCode;
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
